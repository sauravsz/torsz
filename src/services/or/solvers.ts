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
// 1. LINEAR PROGRAMMING (Generalized Two-Phase Simplex & 2D Graphical)
// ============================================================================
export function solveLinearProgramming(problem: LpProblem): LpSolution {
  const numVars = problem.objectiveCoefficients.length;
  const numConstraints = problem.constraints.length;
  const varNames = problem.variableNames && problem.variableNames.length === numVars
    ? [...problem.variableNames]
    : Array.from({ length: numVars }, (_, i) => `x${i + 1}`);

  const isMax = problem.objective === "max";
  // Internal minimization: if max, negate user objective
  const userObj = problem.objectiveCoefficients.map((c) => (isMax ? -c : c));

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
  }

  const basicIndices: number[] = [];
  const consInfo: ConstraintBuildInfo[] = [];

  for (let i = 0; i < numConstraints; i++) {
    let { coefficients, operator, rhs } = problem.constraints[i];
    let row = [...coefficients];
    while (row.length < numVars) row.push(0);

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

    consInfo.push({ coeffs: row, rhs, slackCol, surplusCol, artCol });
  }

  const totalCols = cols.length;
  let A_rows: number[][] = Array.from({ length: numConstraints }, () => new Array(totalCols).fill(0));
  let b_vec: number[] = new Array(numConstraints).fill(0);

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
        if (cols[basicIndices[i]].isArtificial) sum += p1Tableau[i][j];
      }
      p1Tableau[numConstraints][j] = (cols[j].isArtificial ? 1 : 0) - sum;
    }
    let p1SumRhs = 0;
    for (let i = 0; i < numConstraints; i++) {
      if (cols[basicIndices[i]].isArtificial) p1SumRhs += b_vec[i];
    }
    p1Tableau[numConstraints][totalCols] = -p1SumRhs;

    let p1Iter = 0;
    const p1Headers = [...cols.map((c) => c.name), "RHS"];

    while (p1Iter < 50) {
      let pivotCol = -1;
      let minVal = -1e-5;
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
          if (a_ij > 1e-5) {
            const ratio = p1Tableau[i][totalCols] / a_ij;
            ratios.push(ratio);
            if (ratio < minRatio) {
              minRatio = ratio;
              pivotRow = i;
            }
          } else {
            ratios.push(null);
          }
        }
      }

      tableaus.push({
        iteration: iterations,
        basicVars: basicIndices.map((idx) => cols[idx]?.name || "b"),
        headers: [...p1Headers],
        rows: p1Tableau.slice(0, numConstraints).map((r) => [...r]),
        zRow: [...p1Tableau[numConstraints]],
        enteringVar: pivotCol !== -1 ? p1Headers[pivotCol] : undefined,
        leavingVar: pivotRow !== -1 ? cols[basicIndices[pivotRow]]?.name : undefined,
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
    const idx = nonArtIndices.indexOf(bi);
    return idx !== -1 ? idx : 0;
  });

  // Calculate Phase 2 reduced costs: c_j - sum(c_B * A_ij)
  for (let j = 0; j < p2TotalCols; j++) {
    const origColIdx = nonArtIndices[j];
    const userCost = origColIdx < numVars ? userObj[origColIdx] : 0;
    let sum = 0;
    for (let i = 0; i < numConstraints; i++) {
      const bOrigCol = nonArtIndices[p2BasicIndices[i]];
      const bCost = bOrigCol < numVars ? userObj[bOrigCol] : 0;
      sum += bCost * tableau[i][j];
    }
    tableau[numConstraints][j] = userCost - sum;
  }

  let p2InitialZ = 0;
  for (let i = 0; i < numConstraints; i++) {
    const bOrigCol = nonArtIndices[p2BasicIndices[i]];
    const bCost = bOrigCol < numVars ? userObj[bOrigCol] : 0;
    p2InitialZ += bCost * b_vec[i];
  }
  tableau[numConstraints][p2TotalCols] = -p2InitialZ;

  let p2Iter = 0;
  while (p2Iter < 50 && !isInfeasible) {
    let pivotCol = -1;
    let minVal = -1e-5;
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
        if (a_ij > 1e-5) {
          const ratio = tableau[i][p2TotalCols] / a_ij;
          ratios.push(ratio);
          if (ratio < minRatio) {
            minRatio = ratio;
            pivotRow = i;
          }
        } else {
          ratios.push(null);
        }
      }
    }

    tableaus.push({
      iteration: iterations,
      basicVars: p2BasicIndices.map((idx) => p2Cols[idx]?.name || "b"),
      headers: [...p2Headers],
      rows: tableau.slice(0, numConstraints).map((r) => [...r]),
      zRow: [...tableau[numConstraints]],
      enteringVar: pivotCol !== -1 ? p2Headers[pivotCol] : undefined,
      leavingVar: pivotRow !== -1 ? p2Cols[p2BasicIndices[pivotRow]]?.name : undefined,
      pivotRowIdx: pivotRow !== -1 ? pivotRow : undefined,
      pivotColIdx: pivotCol !== -1 ? pivotCol : undefined,
      ratios: ratios.length > 0 ? ratios : undefined,
    });

    if (pivotCol !== -1 && pivotRow === -1) {
      isUnbounded = true;
      break;
    }
    if (pivotCol === -1) {
      break; // Optimal
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
    const colName = p2Cols[p2BasicIndices[i]]?.name;
    if (varNames.includes(colName)) {
      varMap[colName] = Math.max(0, tableau[i][p2TotalCols]);
    }
  }

  const optimalZ = varNames.reduce((sum, name, idx) => {
    return sum + (problem.objectiveCoefficients[idx] || 0) * (varMap[name] || 0);
  }, 0);

  // Compute dual prices and constraint slacks
  const dualPrices = problem.constraints.map((c, i) => {
    // Slack/Surplus value = |rhs - sum(a_ij * x_j)|
    const lhsVal = c.coefficients.reduce((s, coeff, j) => s + coeff * (varMap[varNames[j]] || 0), 0);
    const slackVal = Math.abs(c.rhs - lhsVal);

    // Find corresponding slack/surplus column in final tableau to extract true shadow price
    const slackColName = c.operator === "<=" ? `s${i + 1}` : `e${i + 1}`;
    const colIdxInP2 = p2Cols.findIndex((col) => col.name === slackColName);
    let shadowVal = 0;
    if (colIdxInP2 !== -1) {
      shadowVal = Math.abs(tableau[numConstraints][colIdxInP2]);
    }

    return {
      constraint: `Constraint ${i + 1} (${c.operator} ${c.rhs})`,
      shadowPrice: Math.round(shadowVal * 1000) / 1000,
      slack: Math.round(slackVal * 1000) / 1000,
    };
  });

  // 2D Graphical Solver
  let graphical: GraphicalLpSolution | undefined;
  if (numVars === 2) {
    graphical = solveGraphical2D(problem);
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

function solveGraphical2D(problem: LpProblem): GraphicalLpSolution {
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
      if (xInt >= 0) candidatePoints.push([xInt, 0]);
    }
    if (Math.abs(a2) > 1e-6) {
      yInt = rhs / a2;
      if (yInt >= 0) candidatePoints.push([0, yInt]);
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

  for (const p of cornerPoints) {
    if (Math.abs(p.x1 - optimalCorner[0]) < 1e-3 && Math.abs(p.x2 - optimalCorner[1]) < 1e-3) {
      p.isOptimal = true;
    }
  }

  // Build convex hull / polygon of feasible region
  const feasiblePolygon: [number, number][] = cornerPoints.map((p) => [p.x1, p.x2]);
  if (feasiblePolygon.length > 2) {
    // Sort vertices counterclockwise around centroid
    const cx = feasiblePolygon.reduce((s, p) => s + p[0], 0) / feasiblePolygon.length;
    const cy = feasiblePolygon.reduce((s, p) => s + p[1], 0) / feasiblePolygon.length;
    feasiblePolygon.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  }

  const maxX = Math.max(10, ...cornerPoints.map((p) => p.x1 * 1.3));
  const maxY = Math.max(10, ...cornerPoints.map((p) => p.x2 * 1.3));

  return {
    lines,
    feasiblePolygon,
    cornerPoints,
    optimalPoint: optimalCorner,
    optimalZ: Math.round(bestZ * 1000) / 1000,
    maxX,
    maxY,
  };
}

// ============================================================================
// 2. TRANSPORTATION MODEL (Vogel's Approximation Method - VAM & MODI)
// ============================================================================
export function solveTransportation(problem: TransportationProblem): TransportationSolution {
  const totalSupply = problem.supply.reduce((a, b) => a + b, 0);
  const totalDemand = problem.demand.reduce((a, b) => a + b, 0);

  const sources = [...problem.sources];
  const destinations = [...problem.destinations];
  const costs = problem.costs.map((row) => [...row]);
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

  const numRows = sources.length;
  const numCols = destinations.length;

  const allocations: number[][] = Array.from({ length: numRows }, () =>
    new Array(numCols).fill(0)
  );

  const remSupply = [...supply];
  const remDemand = [...demand];
  const activeRows = new Set<number>(Array.from({ length: numRows }, (_, i) => i));
  const activeCols = new Set<number>(Array.from({ length: numCols }, (_, i) => i));

  // Step 1: Vogel's Approximation Method (VAM) Initial Allocation
  while (activeRows.size > 0 && activeCols.size > 0) {
    let maxPenalty = -1;
    let chosenType: "row" | "col" = "row";
    let chosenIdx = -1;

    // Row penalties
    for (const r of activeRows) {
      const rowCosts: { cost: number; c: number }[] = [];
      for (const c of activeCols) {
        rowCosts.push({ cost: costs[r][c], c });
      }
      rowCosts.sort((a, b) => a.cost - b.cost);

      let penalty = 0;
      if (rowCosts.length >= 2) {
        penalty = rowCosts[1].cost - rowCosts[0].cost;
      } else if (rowCosts.length === 1) {
        penalty = rowCosts[0].cost;
      }

      if (penalty > maxPenalty) {
        maxPenalty = penalty;
        chosenType = "row";
        chosenIdx = r;
      }
    }

    // Col penalties
    for (const c of activeCols) {
      const colCosts: { cost: number; r: number }[] = [];
      for (const r of activeRows) {
        colCosts.push({ cost: costs[r][c], r });
      }
      colCosts.sort((a, b) => a.cost - b.cost);

      let penalty = 0;
      if (colCosts.length >= 2) {
        penalty = colCosts[1].cost - colCosts[0].cost;
      } else if (colCosts.length === 1) {
        penalty = colCosts[0].cost;
      }

      if (penalty > maxPenalty) {
        maxPenalty = penalty;
        chosenType = "col";
        chosenIdx = c;
      }
    }

    if (chosenIdx === -1) break;

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
    allocations[rAlloc][cAlloc] = qty;
    remSupply[rAlloc] -= qty;
    remDemand[cAlloc] -= qty;

    if (remSupply[rAlloc] === 0 && remDemand[cAlloc] === 0) {
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

  // Step 2: MODI (Modified Distribution Method) Stepping Stone Optimization
  for (let iter = 0; iter < 50; iter++) {
    const u: (number | null)[] = new Array(numRows).fill(null);
    const v: (number | null)[] = new Array(numCols).fill(null);
    u[0] = 0;

    let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          if (allocations[r][c] > 0) {
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

    let minOpportunityCost = 0;
    let enterR = -1;
    let enterC = -1;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (allocations[r][c] === 0 && u[r] !== null && v[c] !== null) {
          const delta = costs[r][c] - (u[r]! + v[c]!);
          if (delta < minOpportunityCost) {
            minOpportunityCost = delta;
            enterR = r;
            enterC = c;
          }
        }
      }
    }

    if (enterR === -1 || minOpportunityCost >= -1e-5) {
      break;
    }

    // Find stepping stone cycle
    function findLoop(startR: number, startC: number): [number, number][] | null {
      const basicCells: [number, number][] = [];
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          if (allocations[r][c] > 0 || (r === startR && c === startC)) {
            basicCells.push([r, c]);
          }
        }
      }

      function searchPath(path: [number, number][], isRowMove: boolean): [number, number][] | null {
        const [lastR, lastC] = path[path.length - 1];
        if (path.length >= 4 && lastR === startR && !isRowMove) return path;

        if (isRowMove) {
          for (const [r, c] of basicCells) {
            if (r === lastR && c !== lastC && !path.some(([pr, pc]) => pr === r && pc === c)) {
              const res = searchPath([...path, [r, c]], false);
              if (res) return res;
            }
          }
        } else {
          for (const [r, c] of basicCells) {
            if (c === lastC && r !== lastR) {
              if (r === startR && c === startC && path.length >= 4) return path;
              if (!path.some(([pr, pc]) => pr === r && pc === c)) {
                const res = searchPath([...path, [r, c]], true);
                if (res) return res;
              }
            }
          }
        }
        return null;
      }

      return searchPath([[startR, startC]], true);
    }

    const loop = findLoop(enterR, enterC);
    if (!loop || loop.length < 4) break;

    let theta = Infinity;
    for (let k = 1; k < loop.length; k += 2) {
      const [r, c] = loop[k];
      if (allocations[r][c] < theta) theta = allocations[r][c];
    }

    if (theta === Infinity || theta <= 0) break;

    for (let k = 0; k < loop.length; k++) {
      const [r, c] = loop[k];
      if (k % 2 === 0) allocations[r][c] += theta;
      else allocations[r][c] -= theta;
    }
  }

  let totalCost = 0;
  const allocationBreakdown: {
    from: string;
    to: string;
    amount: number;
    unitCost: number;
    cost: number;
  }[] = [];

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (allocations[r][c] > 0) {
        const cost = allocations[r][c] * costs[r][c];
        totalCost += cost;
        allocationBreakdown.push({
          from: sources[r],
          to: destinations[c],
          amount: allocations[r][c],
          unitCost: costs[r][c],
          cost,
        });
      }
    }
  }

  return {
    allocations,
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
// 3. HUNGARIAN ASSIGNMENT SOLVER
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

  const origMatrix: number[][] = Array.from({ length: dim }, (_, r) =>
    Array.from({ length: dim }, (_, c) => {
      if (r < nRows && c < nCols) return problem.costs[r][c];
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
// 4. NETWORK MODELS: SHORTEST ROUTE (Dijkstra)
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

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>(nodes);

  nodes.forEach((n) => {
    dist[n] = Infinity;
    prev[n] = null;
  });
  dist[startNode] = 0;

  while (unvisited.size > 0) {
    let u: string | null = null;
    let minDist = Infinity;

    unvisited.forEach((n) => {
      if (dist[n] < minDist) {
        minDist = dist[n];
        u = n;
      }
    });

    if (!u || minDist === Infinity || u === endNode) break;

    unvisited.delete(u);

    edges.forEach((e) => {
      const uStr = String(u);
      const fromStr = String(e.from);
      const toStr = String(e.to);

      let v: string | null = null;
      if (fromStr === uStr) v = toStr;
      else if (toStr === uStr) v = fromStr; // Undirected

      if (v && unvisited.has(v)) {
        const alt = dist[uStr] + e.cost;
        if (alt < dist[v]) {
          dist[v] = alt;
          prev[v] = uStr;
        }
      }
    });
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
    const edge = edges.find(
      (e) =>
        (String(e.from) === u && String(e.to) === v) ||
        (String(e.from) === v && String(e.to) === u)
    );
    selectedEdges.push({ from: u, to: v, weight: edge?.cost || 0 });
  }

  return {
    type: "shortest-route",
    selectedEdges,
    totalMetric: dist[endNode] !== Infinity ? dist[endNode] : 0,
    pathString: path.join(" → "),
  };
}

// ============================================================================
// 5. NETWORK MODELS: MINIMUM SPANNING TREE (Kruskal's)
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
    if (union(u, v)) {
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
// 6. NETWORK MODELS: MAXIMAL FLOW (Edmonds-Karp & Min-Cut)
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
// 7. PROJECT PLANNING: CPM / PERT & CRASHING
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

  // Forward Pass
  activities.forEach((a) => {
    const dur = effectiveDurations[a.id];
    if (!a.predecessors || a.predecessors.length === 0) {
      earlyStart[a.id] = 0;
      earlyFinish[a.id] = dur;
    } else {
      let maxEF = 0;
      a.predecessors.forEach((p) => {
        if (earlyFinish[p] !== undefined && earlyFinish[p] > maxEF) {
          maxEF = earlyFinish[p];
        }
      });
      earlyStart[a.id] = maxEF;
      earlyFinish[a.id] = maxEF + dur;
    }
  });

  const projectDuration = Math.max(...Object.values(earlyFinish), 0);

  // Backward Pass
  [...activities].reverse().forEach((a) => {
    const dur = effectiveDurations[a.id];
    const successors = activities.filter((succ) => succ.predecessors?.includes(a.id));

    if (successors.length === 0) {
      lateFinish[a.id] = projectDuration;
      lateStart[a.id] = projectDuration - dur;
    } else {
      let minLS = Infinity;
      successors.forEach((succ) => {
        if (lateStart[succ.id] !== undefined && lateStart[succ.id] < minLS) {
          minLS = lateStart[succ.id];
        }
      });
      lateFinish[a.id] = minLS;
      lateStart[a.id] = minLS - dur;
    }

    slack[a.id] = Math.round((lateStart[a.id] - earlyStart[a.id]) * 100) / 100;

    // Free Slack = min(ES_succ) - EF
    if (successors.length === 0) {
      freeSlack[a.id] = Math.round((projectDuration - earlyFinish[a.id]) * 100) / 100;
    } else {
      const minSuccES = Math.min(...successors.map((s) => earlyStart[s.id] || 0));
      freeSlack[a.id] = Math.round((minSuccES - earlyFinish[a.id]) * 100) / 100;
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
      earlyStart: earlyStart[a.id],
      earlyFinish: earlyFinish[a.id],
      lateStart: lateStart[a.id],
      lateFinish: lateFinish[a.id],
      slack: slack[a.id],
      freeSlack: freeSlack[a.id],
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
// 8. QUEUING ANALYSIS (M/M/1, M/M/c, M/M/1/K, M/M/c/K)
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
      const Ws = Ls / lambdaEff;
      const Lq = Math.max(0, Ls - (1 - p0));
      const Wq = Lq / lambdaEff;

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
// 9. ZERO-SUM GAME THEORY
// ============================================================================
export function solveZeroSumGame(problem: ZeroSumGameProblem): ZeroSumGameSolution {
  const m = problem.player1Strategies.length;
  const n = problem.player2Strategies.length;
  const matrix = problem.payoffMatrix;

  const rowMins: number[] = matrix.map((row) => Math.min(...row));
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

  const hasSaddlePoint = maximin === minimax;
  let saddlePointLocation: [number, number] | undefined;

  if (hasSaddlePoint) {
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c] === maximin && rowMins[r] === maximin && colMaxs[c] === minimax) {
          saddlePointLocation = [r, c];
          break;
        }
      }
      if (saddlePointLocation) break;
    }
  }

  const p1Probabilities = new Array(m).fill(0);
  const p2Probabilities = new Array(n).fill(0);

  if (hasSaddlePoint && saddlePointLocation) {
    p1Probabilities[saddlePointLocation[0]] = 1;
    p2Probabilities[saddlePointLocation[1]] = 1;
  } else if (m === 2 && n === 2) {
    // 2x2 analytical mixed strategy solution
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

      p1Probabilities[0] = Math.max(0, Math.min(1, p1));
      p1Probabilities[1] = Math.max(0, Math.min(1, p2));
      p2Probabilities[0] = Math.max(0, Math.min(1, q1));
      p2Probabilities[1] = Math.max(0, Math.min(1, q2));

      return {
        hasSaddlePoint: false,
        gameValue: Math.round(v * 1000) / 1000,
        maximinValue: maximin,
        minimaxValue: minimax,
        player1Probabilities: p1Probabilities.map((p) => Math.round(p * 1000) / 1000),
        player2Probabilities: p2Probabilities.map((p) => Math.round(p * 1000) / 1000),
        mixedStrategyFormula: `p1 = ${(p1).toFixed(3)}, p2 = ${(p2).toFixed(3)}, q1 = ${(q1).toFixed(3)}, q2 = ${(q2).toFixed(3)}, V = ${(v).toFixed(3)}`,
      };
    }
  } else {
    // Fallback LP-derived mixed strategy equal distribution
    p1Probabilities.fill(1 / m);
    p2Probabilities.fill(1 / n);
  }

  return {
    hasSaddlePoint,
    gameValue: maximin,
    maximinValue: maximin,
    minimaxValue: minimax,
    saddlePointLocation,
    player1Probabilities: p1Probabilities.map((p) => Math.round(p * 1000) / 1000),
    player2Probabilities: p2Probabilities.map((p) => Math.round(p * 1000) / 1000),
  };
}

// ============================================================================
// 10. INVENTORY CONTROL (Classic EOQ, Backorders, EPQ, Quantity Discounts)
// ============================================================================
export function solveInventoryControl(problem: InventoryProblem): InventorySolution {
  const { annualDemandD: D, orderingCostK: K, holdingCostH: H, unitPriceC: C } = problem;

  // 1. Quantity Discounts
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
      reorderPoint: Math.round((D / 365) * 5),
      selectedPriceBreakTier: selectedTier,
      priceBreakAnalysis,
    };
  }

  // 2. EOQ with Planned Backorders / Shortages
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
      reorderPoint: Math.round((D / 365) * 5),
    };
  }

  // 3. Economic Production Quantity (EPQ / POQ)
  if (problem.productionRateP && problem.productionRateP > 0) {
    const dailyDemand = D / 365;
    const prodRate = problem.productionRateP;
    const Q_star = Math.sqrt((2 * K * D) / (H * (1 - dailyDemand / prodRate)));
    const I_max = Q_star * (1 - dailyDemand / prodRate);

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
      reorderPoint: Math.round((D / 365) * 5),
    };
  }

  // 4. Classic Wilson EOQ
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
    reorderPoint: Math.round((D / 365) * 5),
  };
}

// ============================================================================
// 11. SIMULTANEOUS LINEAR EQUATIONS (Gauss-Jordan Ax = b)
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
    if (Math.abs(pivot) < 1e-10) continue;

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
