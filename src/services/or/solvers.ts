import {
  LpProblem,
  LpSolution,
  SimplexTableauIteration,
  GraphicalLpSolution,
  GraphicalCornerPoint,
  GraphicalLine,
  TransportationProblem,
  TransportationSolution,
  AssignmentProblem,
  AssignmentSolution,
  NetworkEdge,
  NetworkSolution,
  CpmActivity,
  CpmSolution,
  QueuingProblem,
  QueuingSolution,
  ZeroSumGameProblem,
  ZeroSumGameSolution,
  InventoryProblem,
  InventorySolution,
  PriceBreakTier,
} from "./types";

// ============================================================================
// 1. LINEAR PROGRAMMING (Two-Phase Simplex with Exact Dual Multipliers & Bland's Rule)
// ============================================================================
export function solveLinearProgramming(problem: LpProblem): LpSolution {
  const numVars = problem.objectiveCoefficients.length;
  const numConstraints = problem.constraints.length;
  const varNames = problem.variableNames && problem.variableNames.length === numVars
    ? [...problem.variableNames]
    : Array.from({ length: numVars }, (_, i) => `x${i + 1}`);

  const isMax = problem.objective === "max";
  // Internal minimization: if max, negate user objective
  const userObj = problem.objectiveCoefficients.map((c: number) => (isMax ? -c : c));

  interface ColInfo {
    name: string;
    isArtificial: boolean;
  }

  const cols: ColInfo[] = varNames.map((name) => ({
    name,
    isArtificial: false,
  }));

  interface ConstraintBuildInfo {
    coeffs: number[];
    rhs: number;
    slackCol: number;
    surplusCol: number;
    artCol: number;
    flippedSign: boolean;
  }

  const basicIndices: number[] = [];
  const consInfo: ConstraintBuildInfo[] = [];

  for (let i = 0; i < numConstraints; i++) {
    let { coefficients, operator, rhs } = problem.constraints[i];
    let row = [...coefficients];
    while (row.length < numVars) row.push(0);

    let flippedSign = false;

    // Homogeneous >= 0 -> <= 0 to avoid artificial variable on redundant bounds
    if (operator === ">=" && Math.abs(rhs) < 1e-9) {
      row = row.map((x) => -x);
      operator = "<=";
    }

    // Normalize RHS >= 0
    if (rhs < -1e-9) {
      row = row.map((x) => -x);
      rhs = -rhs;
      operator = operator === "<=" ? ">=" : operator === ">=" ? "<=" : "=";
      flippedSign = true;
    }

    let slackCol = -1;
    let surplusCol = -1;
    let artCol = -1;

    if (operator === "<=") {
      slackCol = cols.length;
      cols.push({ name: `s${i + 1}`, isArtificial: false });
      basicIndices.push(slackCol);
    } else if (operator === ">=") {
      surplusCol = cols.length;
      cols.push({ name: `e${i + 1}`, isArtificial: false });
      artCol = cols.length;
      cols.push({ name: `a${i + 1}`, isArtificial: true });
      basicIndices.push(artCol);
    } else {
      artCol = cols.length;
      cols.push({ name: `a${i + 1}`, isArtificial: true });
      basicIndices.push(artCol);
    }

    consInfo.push({ coeffs: row, rhs, slackCol, surplusCol, artCol, flippedSign });
  }

  const totalCols = cols.length;
  const A_rows: number[][] = Array.from({ length: numConstraints }, () => new Array(totalCols).fill(0));
  const b_vec: number[] = new Array(numConstraints).fill(0);

  for (let i = 0; i < numConstraints; i++) {
    const info = consInfo[i];
    for (let j = 0; j < numVars; j++) {
      A_rows[i][j] = info.coeffs[j];
    }
    b_vec[i] = info.rhs;
    if (info.slackCol !== -1) A_rows[i][info.slackCol] = 1;
    if (info.surplusCol !== -1) A_rows[i][info.surplusCol] = -1;
    if (info.artCol !== -1) A_rows[i][info.artCol] = 1;
  }

  const artificialCols = cols.map((c, i) => (c.isArtificial ? i : -1)).filter((i) => i !== -1);
  const tableaus: SimplexTableauIteration[] = [];
  let isUnbounded = false;
  let isInfeasible = false;
  let iterations = 0;
  const maxIter = Math.max(500, numConstraints * numVars * 10);

  // --------------------------------------------------------------------------
  // PHASE 1 (Minimize sum of artificial variables)
  // --------------------------------------------------------------------------
  if (artificialCols.length > 0) {
    const p1Tableau = Array.from({ length: numConstraints + 1 }, () => Array(totalCols + 1).fill(0));
    for (let i = 0; i < numConstraints; i++) {
      for (let j = 0; j < totalCols; j++) p1Tableau[i][j] = A_rows[i][j];
      p1Tableau[i][totalCols] = b_vec[i];
    }

    for (let j = 0; j < totalCols; j++) {
      let sum = 0;
      for (let i = 0; i < numConstraints; i++) {
        if (cols[basicIndices[i]]?.isArtificial) sum += p1Tableau[i][j];
      }
      p1Tableau[numConstraints][j] = (cols[j].isArtificial ? 1 : 0) - sum;
    }
    let p1SumRhs = 0;
    for (let i = 0; i < numConstraints; i++) {
      if (cols[basicIndices[i]]?.isArtificial) p1SumRhs += b_vec[i];
    }
    p1Tableau[numConstraints][totalCols] = -p1SumRhs;

    let p1Iter = 0;
    const p1Headers = [...cols.map((c) => c.name), "RHS"];

    while (p1Iter < maxIter) {
      let pivotCol = -1;
      let minVal = -1e-6;
      for (let j = 0; j < totalCols; j++) {
        if (p1Tableau[numConstraints][j] < minVal) {
          minVal = p1Tableau[numConstraints][j];
          pivotCol = j;
        }
      }

      const ratios: (number | null)[] = [];
      let pivotRow = -1;
      let minRatio = Infinity;
      if (pivotCol !== -1) {
        for (let i = 0; i < numConstraints; i++) {
          const a_ij = p1Tableau[i][pivotCol];
          if (a_ij > 1e-6) {
            const ratio = p1Tableau[i][totalCols] / a_ij;
            ratios.push(ratio);
            if (ratio < minRatio - 1e-9) {
              minRatio = ratio;
              pivotRow = i;
            } else if (Math.abs(ratio - minRatio) <= 1e-9 && pivotRow !== -1) {
              // Bland's rule tie-breaking: choose basic variable with smaller index
              if (basicIndices[i] < basicIndices[pivotRow]) {
                pivotRow = i;
              }
            }
          } else {
            ratios.push(null);
          }
        }
      }

      tableaus.push({
        iteration: iterations,
        basicVars: basicIndices.map((idx) => (idx >= 0 ? cols[idx]?.name || `x${idx}` : "—")),
        headers: [...p1Headers],
        rows: p1Tableau.slice(0, numConstraints).map((r) => [...r]),
        zRow: [...p1Tableau[numConstraints]],
        enteringVar: pivotCol !== -1 ? p1Headers[pivotCol] : undefined,
        leavingVar: pivotRow !== -1 && basicIndices[pivotRow] >= 0 ? cols[basicIndices[pivotRow]]?.name : undefined,
        pivotRowIdx: pivotRow !== -1 ? pivotRow : undefined,
        pivotColIdx: pivotCol !== -1 ? pivotCol : undefined,
        ratios: ratios.length > 0 ? ratios : undefined,
      });

      if (pivotCol === -1 || pivotRow === -1) break;

      const pVal = p1Tableau[pivotRow][pivotCol];
      for (let j = 0; j <= totalCols; j++) p1Tableau[pivotRow][j] /= pVal;
      basicIndices[pivotRow] = pivotCol;

      for (let i = 0; i <= numConstraints; i++) {
        if (i !== pivotRow) {
          const factor = p1Tableau[i][pivotCol];
          for (let j = 0; j <= totalCols; j++) p1Tableau[i][j] -= factor * p1Tableau[pivotRow][j];
        }
      }
      p1Iter++;
      iterations++;
    }

    // Check feasibility: if optimal W > 1e-4, the LP is infeasible
    if (Math.abs(p1Tableau[numConstraints][totalCols]) > 1e-4) {
      isInfeasible = true;
    }

    for (let i = 0; i < numConstraints; i++) {
      for (let j = 0; j < totalCols; j++) A_rows[i][j] = p1Tableau[i][j];
      b_vec[i] = p1Tableau[i][totalCols];
    }
  }

  // --------------------------------------------------------------------------
  // Phase 1 cleanup: pivot out any artificial variables still in the basis
  // (degenerate case — artificial is basic at zero level after Phase 1 optimal = 0)
  // --------------------------------------------------------------------------
  for (let i = 0; i < numConstraints; i++) {
    if (basicIndices[i] >= 0 && cols[basicIndices[i]]?.isArtificial) {
      // Find a NON-BASIC, NON-ARTIFICIAL column with a non-zero entry in this row
      let pivotCol = -1;
      for (let j = 0; j < cols.length; j++) {
        if (!cols[j].isArtificial && !basicIndices.includes(j) && Math.abs(A_rows[i][j]) > 1e-9) {
          pivotCol = j;
          break;
        }
      }
      if (pivotCol !== -1) {
        // Perform pivot on A_rows/b_vec to make this column the basic variable for row i
        const pivotVal = A_rows[i][pivotCol];
        for (let j = 0; j < cols.length; j++) A_rows[i][j] /= pivotVal;
        b_vec[i] /= pivotVal;
        for (let r = 0; r < numConstraints; r++) {
          if (r !== i && Math.abs(A_rows[r][pivotCol]) > 1e-12) {
            const factor = A_rows[r][pivotCol];
            for (let j = 0; j < cols.length; j++) A_rows[r][j] -= factor * A_rows[i][j];
            b_vec[r] -= factor * b_vec[i];
          }
        }
        basicIndices[i] = pivotCol;
      } else {
        // Row i is completely redundant for all real variables
        basicIndices[i] = -1;
      }
    }
  }

  // --------------------------------------------------------------------------
  // PHASE 2 (Solve with user objective function)
  // --------------------------------------------------------------------------
  const nonArtIndices = cols.map((_, i) => i).filter((i) => !cols[i].isArtificial);
  const p2Cols = nonArtIndices.map((i) => cols[i]);
  const p2TotalCols = p2Cols.length;
  const p2Headers = [...p2Cols.map((c) => c.name), "RHS"];

  const tableau = Array.from({ length: numConstraints + 1 }, () => Array(p2TotalCols + 1).fill(0));
  for (let i = 0; i < numConstraints; i++) {
    for (let j = 0; j < p2TotalCols; j++) {
      tableau[i][j] = A_rows[i][nonArtIndices[j]];
    }
    tableau[i][p2TotalCols] = b_vec[i];
  }

  const p2BasicIndices = basicIndices.map((bi) => {
    if (bi < 0) return -1;
    const idx = nonArtIndices.indexOf(bi);
    return idx !== -1 ? idx : -1;
  });

  // Calculate Phase 2 reduced costs: c_j - sum(c_B * A_ij)
  for (let j = 0; j < p2TotalCols; j++) {
    const origColIdx = nonArtIndices[j];
    const userCost = origColIdx < numVars ? userObj[origColIdx] : 0;
    let sum = 0;
    for (let i = 0; i < numConstraints; i++) {
      if (p2BasicIndices[i] >= 0) {
        const bOrigCol = nonArtIndices[p2BasicIndices[i]];
        const bCost = bOrigCol < numVars ? userObj[bOrigCol] : 0;
        sum += bCost * tableau[i][j];
      }
    }
    tableau[numConstraints][j] = userCost - sum;
  }

  let p2InitialZ = 0;
  for (let i = 0; i < numConstraints; i++) {
    if (p2BasicIndices[i] >= 0) {
      const bOrigCol = nonArtIndices[p2BasicIndices[i]];
      const bCost = bOrigCol < numVars ? userObj[bOrigCol] : 0;
      p2InitialZ += bCost * b_vec[i];
    }
  }
  tableau[numConstraints][p2TotalCols] = -p2InitialZ;

  let p2Iter = 0;
  while (p2Iter < maxIter && !isInfeasible) {
    let pivotCol = -1;
    let minVal = -1e-6;
    for (let j = 0; j < p2TotalCols; j++) {
      if (tableau[numConstraints][j] < minVal) {
        minVal = tableau[numConstraints][j];
        pivotCol = j;
      }
    }

    const ratios: (number | null)[] = [];
    let pivotRow = -1;
    let minRatio = Infinity;
    if (pivotCol !== -1) {
      for (let i = 0; i < numConstraints; i++) {
        const a_ij = tableau[i][pivotCol];
        if (a_ij > 1e-6) {
          const ratio = tableau[i][p2TotalCols] / a_ij;
          ratios.push(ratio);
          if (ratio < minRatio - 1e-9) {
            minRatio = ratio;
            pivotRow = i;
          } else if (Math.abs(ratio - minRatio) <= 1e-9 && pivotRow !== -1) {
            // Bland's rule tie-breaking
            if (p2BasicIndices[i] < p2BasicIndices[pivotRow]) {
              pivotRow = i;
            }
          }
        } else {
          ratios.push(null);
        }
      }
    }

    tableaus.push({
      iteration: iterations,
      basicVars: p2BasicIndices.map((idx) => (idx >= 0 ? p2Cols[idx]?.name || `x${idx}` : "—")),
      headers: [...p2Headers],
      rows: tableau.slice(0, numConstraints).map((r) => [...r]),
      zRow: [...tableau[numConstraints]],
      enteringVar: pivotCol !== -1 ? p2Headers[pivotCol] : undefined,
      leavingVar: pivotRow !== -1 && p2BasicIndices[pivotRow] >= 0 ? p2Cols[p2BasicIndices[pivotRow]]?.name : undefined,
      pivotRowIdx: pivotRow !== -1 ? pivotRow : undefined,
      pivotColIdx: pivotCol !== -1 ? pivotCol : undefined,
      ratios: ratios.length > 0 ? ratios : undefined,
    });

    if (pivotCol !== -1 && pivotRow === -1) {
      isUnbounded = true;
      break;
    }
    if (pivotCol === -1) {
      break; // Optimal reached
    }

    const pVal = tableau[pivotRow][pivotCol];
    for (let j = 0; j <= p2TotalCols; j++) tableau[pivotRow][j] /= pVal;
    p2BasicIndices[pivotRow] = pivotCol;

    for (let i = 0; i <= numConstraints; i++) {
      if (i !== pivotRow) {
        const factor = tableau[i][pivotCol];
        for (let j = 0; j <= p2TotalCols; j++) tableau[i][j] -= factor * tableau[pivotRow][j];
      }
    }
    p2Iter++;
    iterations++;
  }

  // Extract decision variable values
  const varMap: Record<string, number> = {};
  for (const name of varNames) varMap[name] = 0;

  for (let i = 0; i < numConstraints; i++) {
    if (p2BasicIndices[i] >= 0) {
      const colName = p2Cols[p2BasicIndices[i]]?.name;
      if (varNames.includes(colName)) {
        varMap[colName] = Math.max(0, tableau[i][p2TotalCols]);
      }
    }
  }

  const optimalZ = varNames.reduce((sum, name, idx) => {
    return sum + (problem.objectiveCoefficients[idx] || 0) * (varMap[name] || 0);
  }, 0);

  // Compute exact Dual Multipliers (Shadow Prices) via B^T y = c_B
  let dualVector: number[] = new Array(numConstraints).fill(0);
  if (!isInfeasible && !isUnbounded) {
    try {
      // Build basis matrix B of standard form (m x m)
            const B_matrix: number[][] = Array.from({ length: numConstraints }, () => new Array(numConstraints).fill(0));
      const cB_vector: number[] = new Array(numConstraints).fill(0);

      for (let i = 0; i < numConstraints; i++) {
        const basicCol = p2BasicIndices[i];
        if (basicCol >= 0) {
          const origIdx = nonArtIndices[basicCol];
          // Get column from initial constraint matrix A_init
          for (let r = 0; r < numConstraints; r++) {
            const info = consInfo[r];
            let coeff = 0;
            if (origIdx < numVars) coeff = info.coeffs[origIdx];
            else if (origIdx === info.slackCol) coeff = 1;
            else if (origIdx === info.surplusCol) coeff = -1;
            B_matrix[r][i] = coeff;
          }
          cB_vector[i] = origIdx < numVars ? userObj[origIdx] : 0;
        } else {
          B_matrix[i][i] = 1;
          cB_vector[i] = 0;
        }
      }

      // Transpose of B
      const BT: number[][] = Array.from({ length: numConstraints }, (_, r) =>
        Array.from({ length: numConstraints }, (_, c) => B_matrix[c][r])
      );
      dualVector = solveLinearEquations(BT, cB_vector);
    } catch {
      // Fallback: extract from tableau objective row directly
      dualVector = problem.constraints.map((c: { operator: string }, i: number) => {
        const slackColName = c.operator === "<=" ? `s${i + 1}` : `e${i + 1}`;
        const colIdx = p2Cols.findIndex((col) => col.name === slackColName);
        return colIdx !== -1 ? Math.abs(tableau[numConstraints][colIdx]) : 0;
      });
    }
  }

  // Compute dual prices and constraint slacks for each user constraint
  const dualPrices = problem.constraints.map((c: { coefficients: number[]; operator: string; rhs: number }, i: number) => {
    const lhsVal = c.coefficients.reduce((s: number, coeff: number, j: number) => s + coeff * (varMap[varNames[j]] || 0), 0);
    const slackVal = Math.abs(c.rhs - lhsVal);

    let rawShadow = Math.abs(dualVector[i] || 0);
    // If dual multiplier was derived, take absolute value for display (standard OR textbook convention)
    if (isNaN(rawShadow) || !isFinite(rawShadow)) rawShadow = 0;

    return {
      constraint: `Constraint ${i + 1} (${c.operator} ${c.rhs})`,
      shadowPrice: Math.round(rawShadow * 1000) / 1000,
      slack: Math.round(slackVal * 1000) / 1000,
    };
  });

  // 2D Graphical Solver
  let graphical: GraphicalLpSolution | undefined;
  if (numVars === 2) {
    graphical = solveGraphical2D(problem, isUnbounded);
  }

  const finalStatus = isInfeasible ? "infeasible" : isUnbounded ? "unbounded" : "optimal";

  return {
    status: finalStatus,
    objectiveValue: isUnbounded ? Infinity : isInfeasible ? 0 : Math.round(optimalZ * 1000) / 1000,
    variableValues: varNames.map((name) => ({
      name,
      value: Math.round((varMap[name] || 0) * 1000) / 1000,
    })),
    iterationsCount: iterations,
    tableaus,
    graphical,
    dualPrices,
  };
}

// ============================================================================
// 2. 2D GRAPHICAL LINEAR PROGRAMMING (Convex Hull & Exact Geometry)
// ============================================================================
function solveGraphical2D(problem: LpProblem, isUnboundedSimplex = false): GraphicalLpSolution {
  const [c1, c2] = problem.objectiveCoefficients;
  const isMax = problem.objective === "max";
  const constraints = problem.constraints;

  const lines: GraphicalLine[] = [];
  const candidatePoints: [number, number][] = [];

  candidatePoints.push([0, 0]);

  for (let i = 0; i < constraints.length; i++) {
    const { coefficients, rhs } = constraints[i];
    const [a1, a2] = coefficients;

    let xInt: number | null = null;
    let yInt: number | null = null;

    if (Math.abs(a1) > 1e-6) {
      xInt = rhs / a1;
      if (xInt >= -1e-6) candidatePoints.push([Math.max(0, xInt), 0]);
    }
    if (Math.abs(a2) > 1e-6) {
      yInt = rhs / a2;
      if (yInt >= -1e-6) candidatePoints.push([0, Math.max(0, yInt)]);
    }

    lines.push({
      c1: a1,
      c2: a2,
      operator: constraints[i].operator,
      rhs,
      xIntercept: xInt,
      yIntercept: yInt,
      slope: Math.abs(a2) > 1e-6 ? -a1 / a2 : null,
      label: `C${i + 1}: ${a1}x₁ + ${a2}x₂ = ${rhs}`,
    });
  }

  // Intersections of all constraint pairs
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const [a1, a2] = constraints[i].coefficients;
      const r1 = constraints[i].rhs;
      const [b1, b2] = constraints[j].coefficients;
      const r2 = constraints[j].rhs;

      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) > 1e-6) {
        const x = (r1 * b2 - r2 * a2) / det;
        const y = (a1 * r2 - b1 * r1) / det;
        if (x >= -1e-6 && y >= -1e-6) {
          candidatePoints.push([Math.max(0, x), Math.max(0, y)]);
        }
      }
    }
  }

  // Filter feasible corner points
  const cornerPoints: GraphicalCornerPoint[] = [];
  let bestZ = isMax ? -Infinity : Infinity;
  let optimalCorner: [number, number] = [0, 0];

  for (const [x, y] of candidatePoints) {
    let feasible = true;
    for (const c of constraints) {
      const val = (c.coefficients[0] || 0) * x + (c.coefficients[1] || 0) * y;
      if (c.operator === "<=" && val > c.rhs + 1e-4) feasible = false;
      if (c.operator === ">=" && val < c.rhs - 1e-4) feasible = false;
      if (c.operator === "=" && Math.abs(val - c.rhs) > 1e-4) feasible = false;
      if (!feasible) break;
    }

    if (feasible) {
      const z = c1 * x + c2 * y;
      const roundedX = Math.round(x * 1000) / 1000;
      const roundedY = Math.round(y * 1000) / 1000;
      const roundedZ = Math.round(z * 1000) / 1000;

      if (!cornerPoints.some((p) => Math.abs(p.x1 - roundedX) < 1e-3 && Math.abs(p.x2 - roundedY) < 1e-3)) {
        cornerPoints.push({
          x1: roundedX,
          x2: roundedY,
          zValue: roundedZ,
          isFeasible: true,
          isOptimal: false,
        });
        if (isMax ? z > bestZ : z < bestZ) {
          bestZ = z;
          optimalCorner = [roundedX, roundedY];
        }
      }
    }
  }

  if (!isUnboundedSimplex) {
    for (const p of cornerPoints) {
      if (Math.abs(p.x1 - optimalCorner[0]) < 1e-3 && Math.abs(p.x2 - optimalCorner[1]) < 1e-3) {
        p.isOptimal = true;
      }
    }
  }

  // Andrew's Monotone Chain 2D Convex Hull
  function computeConvexHull(pts: [number, number][]): [number, number][] {
    if (pts.length <= 2) return [...pts];
    const sorted = [...pts].sort((a: [number, number], b: [number, number]) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);

    const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

    const lower: [number, number][] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: [number, number][] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  const rawHullPts: [number, number][] = cornerPoints.map((p: GraphicalCornerPoint) => [p.x1, p.x2]);
  const feasiblePolygon = computeConvexHull(rawHullPts);

  const maxX = Math.max(10, ...cornerPoints.map((p) => p.x1 * 1.3));
  const maxY = Math.max(10, ...cornerPoints.map((p) => p.x2 * 1.3));

  return {
    lines,
    feasiblePolygon,
    cornerPoints,
    optimalPoint: isUnboundedSimplex ? [0, 0] : optimalCorner,
    optimalZ: isUnboundedSimplex ? Infinity : Math.round(bestZ * 1000) / 1000,
    maxX,
    maxY,
  };
}

// ============================================================================
// 3. TRANSPORTATION MODEL (Vogel's Approximation Method & Exact MODI with Spanning Tree)
// ============================================================================
export function solveTransportation(problem: TransportationProblem): TransportationSolution {
  const totalSupply = problem.supply.reduce((a, b) => a + b, 0);
  const totalDemand = problem.demand.reduce((a, b) => a + b, 0);

  const sources = [...problem.sources];
  const destinations = [...problem.destinations];
  const costs = problem.costs.map((row: number[]) => [...row]);
  const supply = [...problem.supply];
  const demand = [...problem.demand];

  let dummyAdded: "supply" | "demand" | null = null;

  if (totalSupply > totalDemand) {
    dummyAdded = "demand";
    destinations.push("Dummy Market");
    demand.push(totalSupply - totalDemand);
    costs.forEach((row) => row.push(0));
  } else if (totalDemand > totalSupply) {
    dummyAdded = "supply";
    sources.push("Dummy Plant");
    supply.push(totalDemand - totalSupply);
    costs.push(new Array(destinations.length).fill(0));
  }

  const m = sources.length;
  const n = destinations.length;

  const alloc: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  const isBasic: boolean[][] = Array.from({ length: m }, () => new Array(n).fill(false));

  const remSupply = [...supply];
  const remDemand = [...demand];
  const activeRows = new Set<number>(Array.from({ length: m }, (_, i) => i));
  const activeCols = new Set<number>(Array.from({ length: n }, (_, i) => i));

  // Step 1: Vogel's Approximation Method (VAM) Initial Basic Feasible Allocation
  while (activeRows.size > 0 && activeCols.size > 0) {
    if (activeRows.size === 1 && activeCols.size === 1) {
      const r = Array.from(activeRows)[0];
      const c = Array.from(activeCols)[0];
      const qty = Math.min(remSupply[r], remDemand[c]);
      alloc[r][c] = qty;
      isBasic[r][c] = true;
      activeRows.delete(r);
      activeCols.delete(c);
      break;
    }

    let maxPenalty = -1;
    let chosenType: "row" | "col" = "row";
    let chosenIdx = -1;

    // Row penalties
    for (const r of activeRows) {
      const rowCosts: { cost: number; c: number }[] = [];
      for (const c of activeCols) rowCosts.push({ cost: costs[r][c], c });
      rowCosts.sort((a: { cost: number }, b: { cost: number }) => a.cost - b.cost);
      const penalty = rowCosts.length >= 2 ? rowCosts[1].cost - rowCosts[0].cost : rowCosts[0]?.cost || 0;
      if (penalty > maxPenalty) {
        maxPenalty = penalty;
        chosenType = "row";
        chosenIdx = r;
      }
    }

    // Col penalties
    for (const c of activeCols) {
      const colCosts: { cost: number; r: number }[] = [];
      for (const r of activeRows) colCosts.push({ cost: costs[r][c], r });
      colCosts.sort((a: { cost: number }, b: { cost: number }) => a.cost - b.cost);
      const penalty = colCosts.length >= 2 ? colCosts[1].cost - colCosts[0].cost : colCosts[0]?.cost || 0;
      if (penalty > maxPenalty) {
        maxPenalty = penalty;
        chosenType = "col";
        chosenIdx = c;
      }
    }

    let rAlloc = -1;
    let cAlloc = -1;

    if (chosenType === "row") {
      rAlloc = chosenIdx;
      let minCost = Infinity;
      for (const c of activeCols) {
        if (costs[rAlloc][c] < minCost) {
          minCost = costs[rAlloc][c];
          cAlloc = c;
        }
      }
    } else {
      cAlloc = chosenIdx;
      let minCost = Infinity;
      for (const r of activeRows) {
        if (costs[r][cAlloc] < minCost) {
          minCost = costs[r][cAlloc];
          rAlloc = r;
        }
      }
    }

    const qty = Math.min(remSupply[rAlloc], remDemand[cAlloc]);
    alloc[rAlloc][cAlloc] = qty;
    isBasic[rAlloc][cAlloc] = true;
    remSupply[rAlloc] -= qty;
    remDemand[cAlloc] -= qty;

    if (remSupply[rAlloc] === 0 && remDemand[cAlloc] === 0) {
      // Degeneracy: cross out row, leave column active with 0 demand so basis remains connected
      if (activeRows.size > 1) {
        activeRows.delete(rAlloc);
      } else {
        activeCols.delete(cAlloc);
      }
    } else if (remSupply[rAlloc] === 0) {
      activeRows.delete(rAlloc);
    } else {
      activeCols.delete(cAlloc);
    }
  }

  // Ensure exactly m + n - 1 basic cells that form a spanning tree without cycles
  function countBasic(): number {
    let count = 0;
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        if (isBasic[r][c]) count++;
      }
    }
    return count;
  }

  function hasCycle(): boolean {
    const adjR: number[][] = Array.from({ length: m }, () => []);
    const adjC: number[][] = Array.from({ length: n }, () => []);
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        if (isBasic[r][c]) {
          adjR[r].push(c);
          adjC[c].push(r);
        }
      }
    }
    const visited = new Set<string>();
    function dfs(u: number, isRow: boolean, parentU: number | null): boolean {
      const key = `${isRow ? "r" : "c"}_${u}`;
      if (visited.has(key)) return true;
      visited.add(key);
      const neighbors = isRow ? adjR[u] : adjC[u];
      for (const v of neighbors) {
        if (v === parentU) continue;
        if (dfs(v, !isRow, u)) return true;
      }
      return false;
    }
    for (let r = 0; r < m; r++) {
      if (!visited.has(`r_${r}`)) {
        if (dfs(r, true, null)) return true;
      }
    }
    return false;
  }

  // Add dummy basic cells if count < m + n - 1
  while (countBasic() < m + n - 1) {
    let added = false;
    for (let r = 0; r < m && !added; r++) {
      for (let c = 0; c < n && !added; c++) {
        if (!isBasic[r][c]) {
          isBasic[r][c] = true;
          if (!hasCycle()) {
            added = true;
          } else {
            isBasic[r][c] = false;
          }
        }
      }
    }
    if (!added) break;
  }

  // Step 2: MODI (Modified Distribution Method) Stepping Stone Optimization
  for (let iter = 0; iter < 100; iter++) {
    const u: (number | null)[] = new Array(m).fill(null);
    const v: (number | null)[] = new Array(n).fill(null);

    // Compute potentials u_i, v_j across all connected components
    for (let rootR = 0; rootR < m; rootR++) {
      if (u[rootR] === null) {
        for (let c = 0; c < n; c++) {
          if (isBasic[rootR][c] && v[c] !== null) {
            u[rootR] = costs[rootR][c] - v[c]!;
            break;
          }
        }
        if (u[rootR] === null) {
          u[rootR] = 0;
        }

        let changed = true;
        while (changed) {
          changed = false;
          for (let r = 0; r < m; r++) {
            for (let c = 0; c < n; c++) {
              if (isBasic[r][c]) {
                if (u[r] !== null && v[c] === null) {
                  v[c] = costs[r][c] - u[r]!;
                  changed = true;
                } else if (u[r] === null && v[c] !== null) {
                  u[r] = costs[r][c] - v[c]!;
                  changed = true;
                }
              }
            }
          }
        }
      }
    }

    // Opportunity costs Delta_ij = c_ij - (u_i + v_j)
    let minDelta = -1e-6;
    let enterR = -1;
    let enterC = -1;

    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        if (!isBasic[r][c] && u[r] !== null && v[c] !== null) {
          const delta = costs[r][c] - (u[r]! + v[c]!);
          if (delta < minDelta) {
            minDelta = delta;
            enterR = r;
            enterC = c;
          }
        }
      }
    }

    if (enterR === -1) {
      break; // Optimal!
    }

    // Find stepping stone closed cycle through basic cells + (enterR, enterC)
    function findCycle(startR: number, startC: number): [number, number][] | null {
      const basicList: [number, number][] = [];
      for (let r = 0; r < m; r++) {
        for (let c = 0; c < n; c++) {
          if (isBasic[r][c] || (r === startR && c === startC)) {
            basicList.push([r, c]);
          }
        }
      }

      function dfs(path: [number, number][], isRowMove: boolean): [number, number][] | null {
        const [currR, currC] = path[path.length - 1];
        if (path.length >= 4) {
          if (isRowMove && currR === startR && currC !== startC) return path;
          if (!isRowMove && currC === startC && currR !== startR) return path;
        }

        if (isRowMove) {
          for (const [r, c] of basicList) {
            if (r === currR && c !== currC && !path.some(([pr, pc]) => pr === r && pc === c)) {
              const res = dfs([...path, [r, c]], false);
              if (res) return res;
            }
          }
        } else {
          for (const [r, c] of basicList) {
            if (c === currC && r !== currR && !path.some(([pr, pc]) => pr === r && pc === c)) {
              const res = dfs([...path, [r, c]], true);
              if (res) return res;
            }
          }
        }
        return null;
      }

      let res = dfs([[startR, startC]], true);
      if (!res) res = dfs([[startR, startC]], false);
      return res;
    }

    const cycle = findCycle(enterR, enterC);
    if (!cycle || cycle.length < 4) break;

    // Odd positions in cycle are subtracted
    let theta = Infinity;
    let leaveR = -1;
    let leaveC = -1;

    for (let k = 1; k < cycle.length; k += 2) {
      const [r, c] = cycle[k];
      if (alloc[r][c] < theta) {
        theta = alloc[r][c];
        leaveR = r;
        leaveC = c;
      }
    }

    if (theta === Infinity) break;

    // Shift allocations along the cycle
    for (let k = 0; k < cycle.length; k++) {
      const [r, c] = cycle[k];
      if (k % 2 === 0) alloc[r][c] += theta;
      else alloc[r][c] -= theta;
    }

    isBasic[enterR][enterC] = true;
    isBasic[leaveR][leaveC] = false;
  }

  let totalCost = 0;
  const allocationBreakdown: {
    from: string;
    to: string;
    amount: number;
    unitCost: number;
    cost: number;
  }[] = [];

  for (let r = 0; r < m; r++) {
    for (let c = 0; c < n; c++) {
      if (alloc[r][c] > 0) {
        const cost = alloc[r][c] * costs[r][c];
        totalCost += cost;
        allocationBreakdown.push({
          from: sources[r],
          to: destinations[c],
          amount: alloc[r][c],
          unitCost: costs[r][c],
          cost,
        });
      }
    }
  }

  return {
    allocations: alloc,
    totalCost,
    isBalanced: totalSupply === totalDemand,
    dummyAdded,
    method: "Vogel's Approximation Method (VAM) with MODI Optimality",
    sources,
    destinations,
    costs,
    allocationBreakdown,
  };
}

// ============================================================================
// 4. HUNGARIAN ASSIGNMENT SOLVER (Jonker-Volgenant Optimal Matching)
// ============================================================================
export function solveHungarianAssignment(problem: AssignmentProblem): AssignmentSolution {
  const nRows = problem.workers.length;
  const nCols = problem.jobs.length;
  const dim = Math.max(nRows, nCols);

  const workers = [...problem.workers];
  while (workers.length < dim) {
    workers.push(`Worker ${workers.length + 1} (Dummy)`);
  }

  const jobs = [...problem.jobs];
  while (jobs.length < dim) {
    jobs.push(`Job ${jobs.length + 1} (Dummy)`);
  }

  let minVal = 0;
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      if (problem.costs[r][c] < minVal) minVal = problem.costs[r][c];
    }
  }
  const shift = minVal < 0 ? -minVal : 0;

  const origMatrix: number[][] = Array.from({ length: dim }, (_, r) =>
    Array.from({ length: dim }, (_, c) => {
      if (r < nRows && c < nCols) {
        return problem.costs[r][c] + shift;
      }
      return 0;
    })
  );

  // Jonker-Volgenant potential algorithm (optimal O(N^3) matching)
  const u: number[] = new Array(dim + 1).fill(0);
  const v: number[] = new Array(dim + 1).fill(0);
  const p: number[] = new Array(dim + 1).fill(0);
  const way: number[] = new Array(dim + 1).fill(0);

  for (let i = 1; i <= dim; i++) {
    p[0] = i;
    let j0 = 0;
    const minv: number[] = new Array(dim + 1).fill(Infinity);
    const used: boolean[] = new Array(dim + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= dim; j++) {
        if (!used[j]) {
          const cur = origMatrix[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }
      for (let j = 0; j <= dim; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const rowMatch = new Array(dim).fill(-1);
  for (let j = 1; j <= dim; j++) {
    if (p[j] > 0) {
      rowMatch[p[j] - 1] = j - 1;
    }
  }

  // Reduced matrix representation
  const matrix = origMatrix.map((row, r) => row.map((val, c) => Math.max(0, val - u[r + 1] - v[c + 1])));

  const assignments: { worker: string; job: string; cost: number }[] = [];
  let totalCost = 0;

  for (let r = 0; r < nRows; r++) {
    const c = rowMatch[r];
    if (c !== -1 && c < nCols) {
      const cost = problem.costs[r][c];
      totalCost += cost;
      assignments.push({
        worker: problem.workers[r],
        job: problem.jobs[c],
        cost,
      });
    }
  }

  return {
    assignments,
    totalCost,
    reducedMatrix: matrix,
    dim,
    workers,
    jobs,
  };
}

// ============================================================================
// 5. NETWORK MODELS: SHORTEST ROUTE (Dijkstra with Parallel Edge Resolution)
// ============================================================================
export function solveNetworkShortestRoute(
  edges: NetworkEdge[],
  startNode: string,
  endNode: string
): NetworkSolution {
  const nodes = new Set<string>();
  edges.forEach((e) => {
    nodes.add(String(e.from));
    nodes.add(String(e.to));
  });

  if (!nodes.has(startNode)) nodes.add(startNode);
  if (!nodes.has(endNode)) nodes.add(endNode);

  function runDijkstra(directed: boolean) {
    const d: Record<string, number> = {};
    const p: Record<string, string | null> = {};
    const unvis = new Set<string>(nodes);

    nodes.forEach((n) => {
      d[n] = Infinity;
      p[n] = null;
    });
    d[startNode] = 0;

    while (unvis.size > 0) {
      let u: string | null = null;
      let minDist = Infinity;

      unvis.forEach((n) => {
        if (d[n] < minDist) {
          minDist = d[n];
          u = n;
        }
      });

      if (!u || minDist === Infinity || u === endNode) break;

      unvis.delete(u);

      edges.forEach((e) => {
        const uStr = String(u);
        const fromStr = String(e.from);
        const toStr = String(e.to);

        let v: string | null = null;
        if (fromStr === uStr) v = toStr;
        else if (!directed && toStr === uStr) v = fromStr;

        if (v && unvis.has(v)) {
          const alt = d[uStr] + e.cost;
          if (alt < d[v]) {
            d[v] = alt;
            p[v] = uStr;
          }
        }
      });
    }
    return { dist: d, prev: p };
  }

  let { dist, prev } = runDijkstra(true);
  let isDirected = true;
  if (dist[endNode] === Infinity) {
    ({ dist, prev } = runDijkstra(false));
    isDirected = false;
  }

  if (dist[endNode] === Infinity) {
    return {
      type: "shortest-route",
      selectedEdges: [],
      totalMetric: 0,
      pathString: `No path between ${startNode} and ${endNode}`,
    };
  }

  const path: string[] = [];
  let curr: string | null = endNode;
  while (curr) {
    path.unshift(curr);
    curr = prev[curr];
  }

  const selectedEdges: { from: string; to: string; weight: number }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i];
    const v = path[i + 1];
    const matchingEdges = edges.filter(
      (e) =>
        (String(e.from) === u && String(e.to) === v) ||
        (!isDirected && String(e.from) === v && String(e.to) === u)
    );
    const bestEdge = matchingEdges.reduce(
      (best, cur) => (cur.cost < best.cost ? cur : best),
      matchingEdges[0]
    );
    selectedEdges.push({ from: u, to: v, weight: bestEdge?.cost ?? 0 });
  }

  return {
    type: "shortest-route",
    selectedEdges,
    totalMetric: dist[endNode] !== Infinity ? dist[endNode] : 0,
    pathString: path.join(" → "),
  };
}

// ============================================================================
// 6. NETWORK MODELS: MINIMUM SPANNING TREE (Kruskal's)
// ============================================================================
export function solveNetworkMst(edges: NetworkEdge[]): NetworkSolution {
  const sortedEdges = [...edges].sort((a, b) => a.cost - b.cost);
  const parent: Record<string, string> = {};

  function find(i: string): string {
    if (!parent[i]) parent[i] = i;
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }

  function union(i: string, j: string): boolean {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
      return true;
    }
    return false;
  }

  const selectedEdges: { from: string; to: string; weight: number }[] = [];
  let totalCost = 0;

  for (const e of sortedEdges) {
    const u = String(e.from);
    const v = String(e.to);
    if (u !== v && union(u, v)) {
      selectedEdges.push({ from: u, to: v, weight: e.cost });
      totalCost += e.cost;
    }
  }

  return {
    type: "minimum-spanning-tree",
    selectedEdges,
    totalMetric: Math.round(totalCost * 100) / 100,
    pathString: selectedEdges.map((e) => `${e.from}-${e.to} (${e.weight})`).join(", "),
  };
}

// ============================================================================
// 7. NETWORK MODELS: MAXIMAL FLOW (Edmonds-Karp & Min-Cut)
// ============================================================================
export function solveNetworkMaxFlow(
  edges: NetworkEdge[],
  source: string,
  sink: string
): NetworkSolution {
  const nodes = new Set<string>();
  edges.forEach((e) => {
    nodes.add(String(e.from));
    nodes.add(String(e.to));
  });

  const originalCapacity: Record<string, Record<string, number>> = {};
  const residualCapacity: Record<string, Record<string, number>> = {};

  nodes.forEach((u) => {
    originalCapacity[u] = {};
    residualCapacity[u] = {};
    nodes.forEach((v) => {
      originalCapacity[u][v] = 0;
      residualCapacity[u][v] = 0;
    });
  });

  edges.forEach((e) => {
    const u = String(e.from);
    const v = String(e.to);
    const cap = e.capacity !== undefined ? e.capacity : e.cost;
    originalCapacity[u][v] += cap;
    residualCapacity[u][v] += cap;
  });

  let maxFlow = 0;

  function bfsPath(): { path: string[]; flow: number } | null {
    const parent: Record<string, string | null> = {};
    const visited = new Set<string>([source]);
    const queue: string[] = [source];

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (u === sink) break;

      for (const v of nodes) {
        if (!visited.has(v) && residualCapacity[u][v] > 1e-6) {
          visited.add(v);
          parent[v] = u;
          queue.push(v);
        }
      }
    }

    if (!visited.has(sink)) return null;

    let pathFlow = Infinity;
    let curr = sink;
    while (curr !== source) {
      const prev = parent[curr]!;
      pathFlow = Math.min(pathFlow, residualCapacity[prev][curr]);
      curr = prev;
    }

    const path: string[] = [];
    curr = sink;
    while (curr) {
      path.unshift(curr);
      curr = parent[curr] || "";
      if (curr === source) {
        path.unshift(source);
        break;
      }
    }

    return { path, flow: pathFlow };
  }

  while (true) {
    const result = bfsPath();
    if (!result) break;

    const { path, flow } = result;
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      residualCapacity[u][v] -= flow;
      residualCapacity[v][u] += flow;
    }
    maxFlow += flow;
  }

  // Min-Cut partition
  const sourceSet = new Set<string>();
  const cutQueue = [source];
  sourceSet.add(source);

  while (cutQueue.length > 0) {
    const u = cutQueue.shift()!;
    for (const v of nodes) {
      if (!sourceSet.has(v) && residualCapacity[u][v] > 1e-6) {
        sourceSet.add(v);
        cutQueue.push(v);
      }
    }
  }

  const sinkSet = new Set<string>();
  nodes.forEach((n) => {
    if (!sourceSet.has(n)) sinkSet.add(n);
  });

  const selectedEdges: { from: string; to: string; weight: number; stepReason?: string }[] = [];
  const flowBreakdown: { from: string; to: string; flow: number; capacity: number }[] = [];

  edges.forEach((e) => {
    const u = String(e.from);
    const v = String(e.to);
    const cap = e.capacity !== undefined ? e.capacity : e.cost;
    const rem = residualCapacity[u][v];
    const flow = Math.max(0, cap - rem);

    if (flow > 0) {
      selectedEdges.push({ from: u, to: v, weight: flow, stepReason: `${flow}/${cap}` });
    }
    flowBreakdown.push({ from: u, to: v, flow, capacity: cap });
  });

  return {
    type: "maximal-flow",
    selectedEdges,
    totalMetric: maxFlow,
    flowBreakdown,
    minCut: {
      sourceSet: Array.from(sourceSet),
      sinkSet: Array.from(sinkSet),
      cutCapacity: maxFlow,
    },
  };
}

// ============================================================================
// 8. PROJECT PLANNING: CPM / PERT & CRASHING
// ============================================================================
export function solveCpmPert(activities: CpmActivity[]): CpmSolution {
  const earlyStart: Record<string, number> = {};
  const earlyFinish: Record<string, number> = {};
  const lateStart: Record<string, number> = {};
  const lateFinish: Record<string, number> = {};
  const slack: Record<string, number> = {};
  const freeSlack: Record<string, number> = {};

  const actMap = new Map<string, CpmActivity>();
  activities.forEach((a) => actMap.set(a.id, a));

  // Compute expected durations if 3-time estimates are provided
  const effectiveDurations: Record<string, number> = {};
  const activityVariances: Record<string, number> = {};

  activities.forEach((a) => {
    if (a.optimisticA !== undefined && a.mostLikelyM !== undefined && a.pessimisticB !== undefined) {
      const te = (a.optimisticA + 4 * a.mostLikelyM + a.pessimisticB) / 6;
      const v = Math.pow((a.pessimisticB - a.optimisticA) / 6, 2);
      effectiveDurations[a.id] = Math.round(te * 100) / 100;
      activityVariances[a.id] = Math.round(v * 1000) / 1000;
    } else {
      effectiveDurations[a.id] = a.duration;
      activityVariances[a.id] = 0;
    }
  });

  // Topological sort (Kahn's algorithm)
  const inDegree: Record<string, number> = {};
  const successorsMap: Record<string, string[]> = {};
  activities.forEach((a) => {
    inDegree[a.id] = (a.predecessors || []).length;
    successorsMap[a.id] = [];
  });
  activities.forEach((a) => {
    (a.predecessors || []).forEach((p) => {
      if (successorsMap[p]) successorsMap[p].push(a.id);
    });
  });
  const topoOrder: string[] = [];
  const queue: string[] = activities.filter((a) => inDegree[a.id] === 0).map((a) => a.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);
    (successorsMap[current] || []).forEach((succ) => {
      inDegree[succ]--;
      if (inDegree[succ] === 0) queue.push(succ);
    });
  }

  // If cyclic graph exists, append remaining activities safely
  if (topoOrder.length < activities.length) {
    const remaining = activities.filter((a) => !topoOrder.includes(a.id)).map((a) => a.id);
    topoOrder.push(...remaining);
  }

  // Forward Pass
  topoOrder.forEach((id) => {
    const a = actMap.get(id);
    const dur = effectiveDurations[id] ?? 0;
    if (!a || !a.predecessors || a.predecessors.length === 0) {
      earlyStart[id] = 0;
      earlyFinish[id] = dur;
    } else {
      let maxEF = 0;
      a.predecessors.forEach((p) => {
        if (earlyFinish[p] !== undefined && earlyFinish[p] > maxEF) {
          maxEF = earlyFinish[p];
        }
      });
      earlyStart[id] = maxEF;
      earlyFinish[id] = maxEF + dur;
    }
  });

  const projectDuration = Math.max(...Object.values(earlyFinish), 0);

  // Backward Pass
  [...topoOrder].reverse().forEach((id) => {
    const dur = effectiveDurations[id] ?? 0;
    const succs = activities.filter((succ) => succ.predecessors?.includes(id));

    if (succs.length === 0) {
      lateFinish[id] = projectDuration;
      lateStart[id] = projectDuration - dur;
    } else {
      let minLS = Infinity;
      succs.forEach((succ) => {
        if (lateStart[succ.id] !== undefined && lateStart[succ.id] < minLS) {
          minLS = lateStart[succ.id];
        }
      });
      lateFinish[id] = minLS === Infinity ? projectDuration : minLS;
      lateStart[id] = lateFinish[id] - dur;
    }

    slack[id] = Math.round((lateStart[id] - earlyStart[id]) * 100) / 100;

    // Free Slack = min_{succ}(ES_succ) - EF
    if (succs.length === 0) {
      freeSlack[id] = Math.max(0, Math.round((projectDuration - earlyFinish[id]) * 100) / 100);
    } else {
      const minSuccES = Math.min(...succs.map((s) => earlyStart[s.id] ?? projectDuration));
      freeSlack[id] = Math.max(0, Math.round((minSuccES - earlyFinish[id]) * 100) / 100);
    }
  });

  const criticalPath = activities.filter((a) => Math.abs(slack[a.id]) < 1e-4).map((a) => a.id);

  let projectVariance = 0;
  criticalPath.forEach((id) => {
    projectVariance += activityVariances[id] || 0;
  });
  const projectStdDev = Math.round(Math.sqrt(projectVariance) * 100) / 100;

  const schedule = activities.map((a) => {
    const crashCostSlope = a.normalTime && a.crashTime && a.normalCost && a.crashCost && a.normalTime > a.crashTime
      ? (a.crashCost - a.normalCost) / (a.normalTime - a.crashTime)
      : undefined;

    return {
      id: a.id,
      name: a.name || a.id,
      duration: effectiveDurations[a.id],
      earlyStart: earlyStart[a.id] ?? 0,
      earlyFinish: earlyFinish[a.id] ?? 0,
      lateStart: lateStart[a.id] ?? 0,
      lateFinish: lateFinish[a.id] ?? 0,
      slack: slack[a.id] ?? 0,
      freeSlack: freeSlack[a.id] ?? 0,
      isCritical: criticalPath.includes(a.id),
      expectedTime: effectiveDurations[a.id],
      variance: activityVariances[a.id],
      crashCostPerUnit: crashCostSlope ? Math.round(crashCostSlope * 100) / 100 : undefined,
    };
  });

  return {
    projectDuration: Math.round(projectDuration * 100) / 100,
    criticalPath,
    projectVariance: Math.round(projectVariance * 1000) / 1000,
    projectStdDev,
    activities: schedule,
    schedule,
  };
}

// ============================================================================
// 9. QUEUING ANALYSIS (M/M/1, M/M/c, M/M/1/K, M/M/c/K Exact Finite Queues)
// ============================================================================
export function solveQueuing(problem: QueuingProblem): QueuingSolution {
  const { arrivalRateLambda: lambda, serviceRateMu: mu, serversCountC: c = 1 } = problem;

  if (c === 1) {
    const rho = lambda / mu;
    if (rho >= 1 && !problem.systemCapacityK) {
      return {
        utilizationRho: Math.round(rho * 1000) / 1000,
        probZeroP0: 0,
        avgInQueueLq: Infinity,
        avgInSystemLs: Infinity,
        avgWaitQueueWq: Infinity,
        avgWaitSystemWs: Infinity,
      };
    }

    if (problem.systemCapacityK && problem.systemCapacityK > 0) {
      const K = problem.systemCapacityK;
      const p0 = Math.abs(rho - 1) < 1e-6 ? 1 / (K + 1) : (1 - rho) / (1 - Math.pow(rho, K + 1));
      const pK = p0 * Math.pow(rho, K);
      const lambdaEff = lambda * (1 - pK);
      const Ls = Math.abs(rho - 1) < 1e-6
        ? K / 2
        : (rho * (1 - (K + 1) * Math.pow(rho, K) + K * Math.pow(rho, K + 1))) / ((1 - rho) * (1 - Math.pow(rho, K + 1)));
      const Ws = lambdaEff > 0 ? Ls / lambdaEff : 0;
      const Lq = Math.max(0, Ls - (1 - p0));
      const Wq = lambdaEff > 0 ? Lq / lambdaEff : 0;

      return {
        utilizationRho: Math.round(rho * 1000) / 1000,
        probZeroP0: Math.round(p0 * 1000) / 1000,
        avgInQueueLq: Math.round(Lq * 1000) / 1000,
        avgInSystemLs: Math.round(Ls * 1000) / 1000,
        avgWaitQueueWq: Math.round(Wq * 1000) / 1000,
        avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
        blockingProbabilityPk: Math.round(pK * 1000) / 1000,
        effectiveArrivalRate: Math.round(lambdaEff * 1000) / 1000,
      };
    }

    const p0 = 1 - rho;
    const Ls = rho / (1 - rho);
    const Lq = (rho * rho) / (1 - rho);
    const Ws = 1 / (mu - lambda);
    const Wq = lambda / (mu * (mu - lambda));

    const totalHourlyCost = problem.serverCostPerHourCs && problem.waitingCostPerHourCw
      ? 1 * problem.serverCostPerHourCs + Ls * problem.waitingCostPerHourCw
      : undefined;

    return {
      utilizationRho: Math.round(rho * 1000) / 1000,
      probZeroP0: Math.round(p0 * 1000) / 1000,
      avgInQueueLq: Math.round(Lq * 1000) / 1000,
      avgInSystemLs: Math.round(Ls * 1000) / 1000,
      avgWaitQueueWq: Math.round(Wq * 1000) / 1000,
      avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
      totalHourlyCost: totalHourlyCost ? Math.round(totalHourlyCost * 100) / 100 : undefined,
    };
  } else {
    const numServers = c;
    const r = lambda / mu;
    const rho = r / numServers;

    if (problem.systemCapacityK && problem.systemCapacityK > 0) {
      // M/M/c/K finite capacity multi-server queue
      const effK = Math.max(numServers, problem.systemCapacityK);
      let sumTerms = 1.0;
      let currentTerm = 1.0;
      for (let n = 1; n < numServers; n++) {
        currentTerm *= r / n;
        sumTerms += currentTerm;
      }
      const termC = currentTerm * (r / numServers); // r^c / c!
      let sumGeo = 0;
      for (let n = numServers; n <= effK; n++) {
        sumGeo += Math.pow(rho, n - numServers);
      }
      const p0 = 1 / (sumTerms + termC * sumGeo);
      const pK = p0 * termC * Math.pow(rho, effK - numServers);
      const lambdaEff = lambda * (1 - pK);

      let Lq = 0;
      if (Math.abs(rho - 1) < 1e-6) {
        Lq = (p0 * termC * (effK - numServers) * (effK - numServers + 1)) / 2;
      } else {
        const N = effK - numServers;
        const num = 1 - Math.pow(rho, N + 1) - (1 - rho) * (N + 1) * Math.pow(rho, N);
        Lq = (p0 * termC * rho * num) / Math.pow(1 - rho, 2);
      }
      Lq = Math.max(0, Lq);
      const Wq = lambdaEff > 0 ? Lq / lambdaEff : 0;
      const Ws = Wq + 1 / mu;
      const Ls = lambdaEff * Ws;

      return {
        utilizationRho: Math.round(rho * 1000) / 1000,
        probZeroP0: Math.round(p0 * 1000) / 1000,
        avgInQueueLq: Math.round(Lq * 1000) / 1000,
        avgInSystemLs: Math.round(Ls * 1000) / 1000,
        avgWaitQueueWq: Math.round(Wq * 1000) / 1000,
        avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
        blockingProbabilityPk: Math.round(pK * 1000) / 1000,
        effectiveArrivalRate: Math.round(lambdaEff * 1000) / 1000,
      };
    }

    if (rho >= 1) {
      return {
        utilizationRho: Math.round(rho * 1000) / 1000,
        probZeroP0: 0,
        avgInQueueLq: Infinity,
        avgInSystemLs: Infinity,
        avgWaitQueueWq: Infinity,
        avgWaitSystemWs: Infinity,
      };
    }

    let sumTerms = 1.0;
    let currentTerm = 1.0;
    for (let n = 1; n < numServers; n++) {
      currentTerm *= r / n;
      sumTerms += currentTerm;
    }
    const termC = currentTerm * (r / numServers);
    const lastTerm = termC / (1 - rho);
    const p0 = 1 / (sumTerms + lastTerm);
    const Lq = (p0 * termC * rho) / Math.pow(1 - rho, 2);
    const Ls = Lq + r;
    const Wq = Lq / lambda;
    const Ws = Wq + 1 / mu;

    const totalHourlyCost = problem.serverCostPerHourCs && problem.waitingCostPerHourCw
      ? numServers * problem.serverCostPerHourCs + Ls * problem.waitingCostPerHourCw
      : undefined;

    return {
      utilizationRho: Math.round(rho * 1000) / 1000,
      probZeroP0: Math.round(p0 * 1000) / 1000,
      avgInQueueLq: Math.round(Lq * 1000) / 1000,
      avgInSystemLs: Math.round(Ls * 1000) / 1000,
      avgWaitQueueWq: Math.round(Wq * 1000) / 1000,
      avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
      totalHourlyCost: totalHourlyCost ? Math.round(totalHourlyCost * 100) / 100 : undefined,
    };
  }
}

// ============================================================================
// 10. ZERO-SUM GAME THEORY (Pure Saddle, 2x2 Analytical & General m x n Linear Programming)
// ============================================================================
export function solveZeroSumGame(problem: ZeroSumGameProblem): ZeroSumGameSolution {
  const m = problem.player1Strategies.length;
  const n = problem.player2Strategies.length;
  const matrix = problem.payoffMatrix;

  const rowMins: number[] = matrix.map((row: number[]) => Math.min(...row));
  const maximin = Math.max(...rowMins);

  const colMaxs: number[] = [];
  for (let c = 0; c < n; c++) {
    let maxVal = -Infinity;
    for (let r = 0; r < m; r++) {
      if (matrix[r][c] > maxVal) maxVal = matrix[r][c];
    }
    colMaxs.push(maxVal);
  }
  const minimax = Math.min(...colMaxs);

  const hasSaddlePoint = Math.abs(maximin - minimax) < 1e-5;
  let saddlePointLocation: [number, number] | undefined;

  if (hasSaddlePoint) {
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        if (Math.abs(matrix[r][c] - maximin) < 1e-5 && Math.abs(rowMins[r] - maximin) < 1e-5 && Math.abs(colMaxs[c] - minimax) < 1e-5) {
          saddlePointLocation = [r, c];
          break;
        }
      }
      if (saddlePointLocation) break;
    }
    const p1 = new Array(m).fill(0);
    const p2 = new Array(n).fill(0);
    if (saddlePointLocation) {
      p1[saddlePointLocation[0]] = 1;
      p2[saddlePointLocation[1]] = 1;
    }
    return {
      hasSaddlePoint: true,
      gameValue: maximin,
      maximinValue: maximin,
      minimaxValue: minimax,
      saddlePointLocation,
      player1Probabilities: p1,
      player2Probabilities: p2,
    };
  }

  // 2x2 analytical mixed strategy solution
  if (m === 2 && n === 2) {
    const a11 = matrix[0][0];
    const a12 = matrix[0][1];
    const a21 = matrix[1][0];
    const a22 = matrix[1][1];

    const denom = (a11 + a22) - (a12 + a21);
    if (Math.abs(denom) > 1e-6) {
      const p1 = (a22 - a21) / denom;
      const p2 = 1 - p1;
      const q1 = (a22 - a12) / denom;
      const q2 = 1 - q1;
      const v = (a11 * a22 - a12 * a21) / denom;

      if (p1 >= -1e-6 && p1 <= 1 + 1e-6 && q1 >= -1e-6 && q1 <= 1 + 1e-6) {
        return {
          hasSaddlePoint: false,
          gameValue: Math.round(v * 1000) / 1000,
          maximinValue: maximin,
          minimaxValue: minimax,
          player1Probabilities: [Math.max(0, Math.min(1, Math.round(p1 * 1000) / 1000)), Math.max(0, Math.min(1, Math.round(p2 * 1000) / 1000))],
          player2Probabilities: [Math.max(0, Math.min(1, Math.round(q1 * 1000) / 1000)), Math.max(0, Math.min(1, Math.round(q2 * 1000) / 1000))],
          mixedStrategyFormula: `p1 = ${(p1).toFixed(3)}, p2 = ${(p2).toFixed(3)}, q1 = ${(q1).toFixed(3)}, q2 = ${(q2).toFixed(3)}, V = ${(v).toFixed(3)}`,
        };
      }
    }
  }

  // General m x n Zero-Sum Game via Linear Programming
  try {
    let minVal = Infinity;
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c] < minVal) minVal = matrix[r][c];
      }
    }
    const shift = minVal <= 0 ? -minVal + 1 : 0;
    const A_prime = matrix.map((row: number[]) => row.map((val: number) => val + shift));

    // Player 1 LP: Min sum(x_i) s.t. sum_i A'_ij * x_i >= 1
    const p1Lp: LpProblem = {
      objective: "min",
      objectiveCoefficients: new Array(m).fill(1),
      variableNames: Array.from({ length: m }, (_, i) => `x${i + 1}`),
      constraints: Array.from({ length: n }, (_, j) => ({
        coefficients: Array.from({ length: m }, (_, i) => A_prime[i][j]),
        operator: ">=" as const,
        rhs: 1,
      })),
    };
    const p1Sol = solveLinearProgramming(p1Lp);
    const sumX = p1Sol.objectiveValue;
    const V_prime = sumX > 0 ? 1 / sumX : 0;
    const gameValue = V_prime - shift;
    const p1Probs = p1Sol.variableValues.map((v: { value: number }) => Math.max(0, Math.round(v.value * V_prime * 1000) / 1000));

    // Player 2 LP: Max sum(y_j) s.t. sum_j A'_ij * y_j <= 1
    const p2Lp: LpProblem = {
      objective: "max",
      objectiveCoefficients: new Array(n).fill(1),
      variableNames: Array.from({ length: n }, (_, j) => `y${j + 1}`),
      constraints: Array.from({ length: m }, (_, i) => ({
        coefficients: Array.from({ length: n }, (_, j) => A_prime[i][j]),
        operator: "<=" as const,
        rhs: 1,
      })),
    };
    const p2Sol = solveLinearProgramming(p2Lp);
    const sumY = p2Sol.objectiveValue;
    const V2_prime = sumY > 0 ? 1 / sumY : 0;
    const p2Probs = p2Sol.variableValues.map((v: { value: number }) => Math.max(0, Math.round(v.value * V2_prime * 1000) / 1000));

    return {
      hasSaddlePoint: false,
      gameValue: Math.round(gameValue * 1000) / 1000,
      maximinValue: maximin,
      minimaxValue: minimax,
      player1Probabilities: p1Probs,
      player2Probabilities: p2Probs,
    };
  } catch {
    const p1 = new Array(m).fill(Math.round((1 / m) * 1000) / 1000);
    const p2 = new Array(n).fill(Math.round((1 / n) * 1000) / 1000);
    return {
      hasSaddlePoint: false,
      gameValue: maximin,
      maximinValue: maximin,
      minimaxValue: minimax,
      player1Probabilities: p1,
      player2Probabilities: p2,
    };
  }
}

// ============================================================================
// 11. INVENTORY CONTROL (Classic EOQ, Backorders, EPQ, Quantity Discounts, Newsvendor)
// ============================================================================
export function solveInventoryControl(problem: InventoryProblem): InventorySolution {
  const { annualDemandD: D, orderingCostK: K, holdingCostH: H, unitPriceC: C } = problem;
  const leadTimeDays = problem.leadTimeDaysL !== undefined ? problem.leadTimeDaysL : 5;
  const reorderPoint = Math.round((D / 365) * leadTimeDays);

  // 1. Newsvendor Single-Period Perishable Inventory
  if (problem.model === "newsvendor") {
    const costC = C;
    const priceP = problem.shortageCostP && problem.shortageCostP > costC
      ? problem.shortageCostP
      : problem.orderingCostK && problem.orderingCostK > costC
      ? problem.orderingCostK
      : costC * 1.5;
    const salvageS = problem.salvageValueS ?? 0;

    const Cu = priceP - costC; // Underage cost (profit lost per unit)
    const Co = costC - salvageS; // Overage cost (loss per unsold unit)
    const criticalFractile = Cu / (Cu + Co);

    const meanD = D;
    const stdDev = Math.round(meanD * 0.25);

    function normInv(p: number): number {
      if (p <= 0) return -Infinity;
      if (p >= 1) return Infinity;
      if (p === 0.5) return 0;
      const a = [2.515517, 0.802853, 0.010328];
      const b = [1.432788, 0.189269, 0.001308];
      const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
      const num = a[0] + a[1] * t + a[2] * t * t;
      const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
      const z = t - num / den;
      return p < 0.5 ? -z : z;
    }

    const zScore = normInv(criticalFractile);
    const Q_star = Math.max(0, Math.round(meanD + zScore * stdDev));
    const totalCost = Math.round(Q_star * costC * 100) / 100;

    return {
      optimalOrderQtyY: Q_star,
      criticalFractile: Math.round(criticalFractile * 1000) / 1000,
      totalAnnualCost: totalCost,
      cycleTimeMonths: 1,
      reorderPoint: Q_star,
    };
  }

  // 2. Quantity Discounts
  if (problem.priceBreaks && problem.priceBreaks.length > 0) {
    let bestTotalCost = Infinity;
    let bestQty = 0;
    let selectedTier = problem.priceBreaks[0];
    const priceBreakAnalysis: PriceBreakTier[] = [];

    for (const tier of problem.priceBreaks) {
      const tierUnitPrice = tier.unitPrice;
      const tierH = problem.holdingCostH > 0 && problem.holdingCostH < 1
        ? problem.holdingCostH * tierUnitPrice
        : problem.holdingCostH;
      let Q = Math.sqrt((2 * K * D) / tierH);

      const feasible = Q >= tier.minQty && (!tier.maxQty || Q <= tier.maxQty);
      if (Q < tier.minQty) {
        Q = tier.minQty;
      } else if (tier.maxQty && Q > tier.maxQty) {
        Q = tier.maxQty;
      }

      const cost = (D / Q) * K + (Q / 2) * tierH + tierUnitPrice * D;
      priceBreakAnalysis.push({
        ...tier,
        eoqCalculated: Math.round(Q),
        isFeasible: feasible,
        totalCost: Math.round(cost * 100) / 100,
      });

      if (cost < bestTotalCost) {
        bestTotalCost = cost;
        bestQty = Q;
        selectedTier = tier;
      }
    }

    return {
      optimalOrderQtyY: Math.round(bestQty),
      totalAnnualCost: Math.round(bestTotalCost * 100) / 100,
      cycleTimeMonths: Math.round((bestQty / D) * 12 * 10) / 10,
      reorderPoint,
      selectedPriceBreakTier: selectedTier,
      priceBreakAnalysis,
    };
  }

  // 3. EOQ with Planned Backorders / Shortages
  if (problem.shortageCostP && problem.shortageCostP > 0) {
    const P = problem.shortageCostP;
    const Q_star = Math.sqrt(((2 * K * D) / H) * ((H + P) / P));
    const S_star = Q_star * (H / (H + P)); // Maximum shortage
    const I_max = Q_star * (P / (H + P)); // Maximum inventory level

    const annualOrdering = (D / Q_star) * K;
    const annualHolding = (Math.pow(I_max, 2) / (2 * Q_star)) * H;
    const annualShortage = (Math.pow(S_star, 2) / (2 * Q_star)) * P;
    const totalCost = annualOrdering + annualHolding + annualShortage + C * D;

    return {
      optimalOrderQtyY: Math.round(Q_star),
      maxShortageS: Math.round(S_star),
      maxInventoryLevel: Math.round(I_max),
      annualOrderingCost: Math.round(annualOrdering * 100) / 100,
      annualHoldingCost: Math.round(annualHolding * 100) / 100,
      annualShortageCost: Math.round(annualShortage * 100) / 100,
      totalAnnualCost: Math.round(totalCost * 100) / 100,
      cycleTimeMonths: Math.round((Q_star / D) * 12 * 10) / 10,
      reorderPoint,
    };
  }

  // 4. Economic Production Quantity (EPQ / POQ)
  if (problem.productionRateP && problem.productionRateP > 0) {
    const prodRate = problem.productionRateP;
    const dpRatio = D / prodRate;
    const safeRatio = dpRatio < 1 ? dpRatio : 0.99;
    const Q_star = Math.sqrt((2 * K * D) / (H * (1 - safeRatio)));
    const I_max = Q_star * (1 - safeRatio);

    const annualOrdering = (D / Q_star) * K;
    const annualHolding = (I_max / 2) * H;
    const totalCost = annualOrdering + annualHolding + C * D;

    return {
      optimalOrderQtyY: Math.round(Q_star),
      maxInventoryLevel: Math.round(I_max),
      annualOrderingCost: Math.round(annualOrdering * 100) / 100,
      annualHoldingCost: Math.round(annualHolding * 100) / 100,
      totalAnnualCost: Math.round(totalCost * 100) / 100,
      cycleTimeMonths: Math.round((Q_star / D) * 12 * 10) / 10,
      reorderPoint,
    };
  }

  // 5. Classic Wilson EOQ
  const Q_star = Math.sqrt((2 * K * D) / H);
  const annualOrdering = (D / Q_star) * K;
  const annualHolding = (Q_star / 2) * H;
  const totalAnnualCost = annualOrdering + annualHolding + C * D;
  const cycleTimeMonths = (Q_star / D) * 12;

  return {
    optimalOrderQtyY: Math.round(Q_star),
    annualOrderingCost: Math.round(annualOrdering * 100) / 100,
    annualHoldingCost: Math.round(annualHolding * 100) / 100,
    totalAnnualCost: Math.round(totalAnnualCost * 100) / 100,
    cycleTimeMonths: Math.round(cycleTimeMonths * 10) / 10,
    reorderPoint,
  };
}

// ============================================================================
// 12. SIMULTANEOUS LINEAR EQUATIONS (Gauss-Jordan Ax = b)
// ============================================================================
export function solveLinearEquations(matrixA: number[][], vectorB: number[]): number[] {
  const n = matrixA.length;
  const M = matrixA.map((row, i) => [...row, vectorB[i]]);

  for (let i = 0; i < n; i++) {
    // Partial row pivoting
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxVal) {
        maxVal = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    if (maxRow !== i) {
      const temp = M[i];
      M[i] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-11) continue;

    for (let j = 0; j <= n; j++) {
      M[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = 0; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  return M.map((row) => Math.round(row[n] * 1000) / 1000);
}
