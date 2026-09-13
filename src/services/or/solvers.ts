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
} from "./types";

// ==========================================
// 1. Linear Programming (Generalized Big-M Simplex Method & 2D Graphical)
// ==========================================
export function solveLinearProgramming(problem: LpProblem): LpSolution {
  const numVars = problem.objectiveCoefficients.length;
  const numConstraints = problem.constraints.length;
  const varNames = problem.variableNames || Array.from({ length: numVars }, (_, i) => `x${i + 1}`);

  const isMax = problem.objective === "max";
  // We minimize internally: if max, negate user objective
  const userObj = problem.objectiveCoefficients.map((c) => (isMax ? -c : c));

  interface ColInfo {
    name: string;
    cost: number;
    isArtificial: boolean;
  }

  const cols: ColInfo[] = varNames.map((name, i) => ({
    name,
    cost: userObj[i] || 0,
    isArtificial: false,
  }));

  const A_rows: number[][] = [];
  const b_vec: number[] = [];
  const basicIndices: number[] = [];
  const BIG_M = 1e4;

  for (let i = 0; i < numConstraints; i++) {
    let { coefficients, operator, rhs } = problem.constraints[i];
    let row = [...coefficients];
    while (row.length < numVars) row.push(0);

    // Make RHS >= 0
    if (rhs < 0) {
      row = row.map((x) => -x);
      rhs = -rhs;
      operator = operator === "<=" ? ">=" : operator === ">=" ? "<=" : "=";
    }

    if (operator === "<=") {
      // Add slack (+1)
      const slackCol = cols.length;
      cols.push({ name: `s${i + 1}`, cost: 0, isArtificial: false });
      row.push(1);
      for (let r = 0; r < A_rows.length; r++) A_rows[r].push(0);
      basicIndices.push(slackCol);
    } else if (operator === ">=") {
      // Add surplus (-1) and artificial (+1)
      cols.push({ name: `e${i + 1}`, cost: 0, isArtificial: false });
      row.push(-1);
      for (let r = 0; r < A_rows.length; r++) A_rows[r].push(0);

      const artCol = cols.length;
      cols.push({ name: `a${i + 1}`, cost: BIG_M, isArtificial: true });
      row.push(1);
      for (let r = 0; r < A_rows.length; r++) A_rows[r].push(0);
      basicIndices.push(artCol);
    } else {
      // Equality: Add artificial (+1)
      const artCol = cols.length;
      cols.push({ name: `a${i + 1}`, cost: BIG_M, isArtificial: true });
      row.push(1);
      for (let r = 0; r < A_rows.length; r++) A_rows[r].push(0);
      basicIndices.push(artCol);
    }

    while (row.length < cols.length) {
      row.splice(row.length - 1, 0, 0);
    }

    A_rows.push(row);
    b_vec.push(rhs);
  }

  const totalCols = cols.length;
  for (const r of A_rows) {
    while (r.length < totalCols) r.push(0);
  }

  // Build tableau: (numConstraints + 1) rows, (totalCols + 1) cols
  const tableau = Array.from({ length: numConstraints + 1 }, () => Array(totalCols + 1).fill(0));

  for (let i = 0; i < numConstraints; i++) {
    for (let j = 0; j < totalCols; j++) {
      tableau[i][j] = A_rows[i][j];
    }
    tableau[i][totalCols] = b_vec[i];
  }

  // Reduced costs in Z row: c_j - sum(c_B * A_ij)
  for (let j = 0; j < totalCols; j++) {
    let sum = 0;
    for (let i = 0; i < numConstraints; i++) {
      const basicCost = cols[basicIndices[i]].cost;
      sum += basicCost * tableau[i][j];
    }
    tableau[numConstraints][j] = cols[j].cost - sum;
  }

  // Initial objective RHS
  let initialZ = 0;
  for (let i = 0; i < numConstraints; i++) {
    initialZ += cols[basicIndices[i]].cost * b_vec[i];
  }
  tableau[numConstraints][totalCols] = -initialZ;

  const tableaus: SimplexTableauIteration[] = [];
  const headers = [...cols.map((c) => c.name), "RHS"];
  let iterations = 0;
  const maxIterations = 80;
  let isUnbounded = false;

  while (iterations < maxIterations) {
    // Entering variable (most negative reduced cost in min problem)
    let pivotCol = -1;
    let minVal = -1e-5;
    for (let j = 0; j < totalCols; j++) {
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
          const ratio = tableau[i][totalCols] / a_ij;
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

    // Record iteration tableau snapshot
    tableaus.push({
      iteration: iterations,
      basicVars: basicIndices.map((idx) => cols[idx].name),
      headers: [...headers],
      rows: tableau.slice(0, numConstraints).map((r) => [...r]),
      zRow: [...tableau[numConstraints]],
      enteringVar: pivotCol !== -1 ? headers[pivotCol] : undefined,
      leavingVar: pivotRow !== -1 ? cols[basicIndices[pivotRow]].name : undefined,
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

    // Pivot operation
    const pivotVal = tableau[pivotRow][pivotCol];
    for (let j = 0; j <= totalCols; j++) {
      tableau[pivotRow][j] /= pivotVal;
    }

    basicIndices[pivotRow] = pivotCol;

    for (let i = 0; i <= numConstraints; i++) {
      if (i !== pivotRow) {
        const factor = tableau[i][pivotCol];
        for (let j = 0; j <= totalCols; j++) {
          tableau[i][j] -= factor * tableau[pivotRow][j];
        }
      }
    }

    iterations++;
  }

  // Extract decision variable values
  const varMap: Record<string, number> = {};
  for (const name of varNames) varMap[name] = 0;

  for (let i = 0; i < numConstraints; i++) {
    const colIdx = basicIndices[i];
    const colName = cols[colIdx]?.name;
    if (varNames.includes(colName)) {
      varMap[colName] = Math.max(0, tableau[i][totalCols]);
    }
  }

  const optimalZ = varNames.reduce((sum, name, idx) => {
    return sum + (problem.objectiveCoefficients[idx] || 0) * (varMap[name] || 0);
  }, 0);
  // Dual shadow prices
  const dualPrices = problem.constraints.map((c, i) => {
    return {
      constraint: `Constraint ${i + 1} (${c.operator} ${c.rhs})`,
      shadowPrice: 0,
      slack: Math.round(tableau[i][totalCols] * 1000) / 1000,
    };
  });

  // 2D Graphical Solver (if 2 variables)
  let graphical: GraphicalLpSolution | undefined;
  if (numVars === 2) {
    graphical = solveGraphical2D(problem);
  }

  return {
    status: isUnbounded ? "unbounded" : "optimal",
    objectiveValue: isUnbounded ? Infinity : Math.round(optimalZ * 1000) / 1000,
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

  // Always include origin (0,0) as candidate
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

  // Filter feasible points
  const cornerPoints: GraphicalCornerPoint[] = [];
  let bestZ = isMax ? -Infinity : Infinity;
  let optimalCorner: [number, number] = [0, 0];

  for (const [x, y] of candidatePoints) {
    let feasible = true;
    for (const c of constraints) {
      const val = c.coefficients[0] * x + c.coefficients[1] * y;
      if (c.operator === "<=" && val > c.rhs + 1e-5) feasible = false;
      if (c.operator === ">=" && val < c.rhs - 1e-5) feasible = false;
      if (c.operator === "=" && Math.abs(val - c.rhs) > 1e-5) feasible = false;
      if (!feasible) break;
    }

    if (feasible) {
      const z = c1 * x + c2 * y;
      const roundedX = Math.round(x * 1000) / 1000;
      const roundedY = Math.round(y * 1000) / 1000;
      const roundedZ = Math.round(z * 1000) / 1000;

      // Deduplicate
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

  // Mark optimal point
  for (const p of cornerPoints) {
    if (Math.abs(p.x1 - optimalCorner[0]) < 1e-3 && Math.abs(p.x2 - optimalCorner[1]) < 1e-3) {
      p.isOptimal = true;
    }
  }

  // Sort corner points in angular order for polygon fill
  if (cornerPoints.length > 2) {
    const cx = cornerPoints.reduce((s, p) => s + p.x1, 0) / cornerPoints.length;
    const cy = cornerPoints.reduce((s, p) => s + p.x2, 0) / cornerPoints.length;
    cornerPoints.sort((a, b) => Math.atan2(a.x2 - cy, a.x1 - cx) - Math.atan2(b.x2 - cy, b.x1 - cx));
  }
  const allX = candidatePoints.map((p) => p[0]).filter((x) => x < 1000);
  const allY = candidatePoints.map((p) => p[1]).filter((y) => y < 1000);
  const maxX = allX.length > 0 ? Math.max(...allX, 5) * 1.25 : 20;
  const maxY = allY.length > 0 ? Math.max(...allY, 5) * 1.25 : 20;

  return {
    lines,
    feasiblePolygon: cornerPoints.map((p) => [p.x1, p.x2]),
    cornerPoints,
    optimalPoint: optimalCorner,
    optimalZ: Math.round(bestZ * 1000) / 1000,
    maxX,
    maxY,
  };
}

// ==========================================
// 2. Transportation Model (Vogel's Approximation Method - VAM)
// ==========================================
export function solveTransportation(problem: TransportationProblem): TransportationSolution {

  const totalSupply = problem.supply.reduce((a, b) => a + b, 0);
  const totalDemand = problem.demand.reduce((a, b) => a + b, 0);

  let sources = [...problem.sources];
  let destinations = [...problem.destinations];
  let costs = problem.costs.map((row) => [...row]);
  let supply = [...problem.supply];
  let demand = [...problem.demand];

  let dummyAdded: "supply" | "demand" | undefined;

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
    method: "Vogel's Approximation Method (VAM)",
    sources,
    destinations,
    costs,
    allocationBreakdown,
  };
}

// ==========================================
// 3. Hungarian Method for Assignment Problems
// ==========================================
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

  const matrix = origMatrix.map((r) => [...r]);

  // Step 1: Row Reduction
  for (let r = 0; r < dim; r++) {
    const minVal = Math.min(...matrix[r]);
    for (let c = 0; c < dim; c++) {
      matrix[r][c] -= minVal;
    }
  }

  // Step 2: Column Reduction
  for (let c = 0; c < dim; c++) {
    let minVal = Infinity;
    for (let r = 0; r < dim; r++) {
      if (matrix[r][c] < minVal) minVal = matrix[r][c];
    }
    for (let r = 0; r < dim; r++) {
      matrix[r][c] -= minVal;
    }
  }

  const rowMatch = new Array(dim).fill(-1);
  const colMatch = new Array(dim).fill(-1);

  function dfs(u: number, visited: boolean[]): boolean {
    for (let v = 0; v < dim; v++) {
      if (matrix[u][v] === 0 && !visited[v]) {
        visited[v] = true;
        if (colMatch[v] < 0 || dfs(colMatch[v], visited)) {
          rowMatch[u] = v;
          colMatch[v] = u;
          return true;
        }
      }
    }
    return false;
  }

  for (let u = 0; u < dim; u++) {
    const visited = new Array(dim).fill(false);
    dfs(u, visited);
  }

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

// ==========================================
// 4. Network Models: Shortest Route (Dijkstra)
// ==========================================
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

    // Neighbors
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

// ==========================================
// 5. Network Models: Minimum Spanning Tree (Kruskal's)
// ==========================================
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

// ==========================================
// 6. Network Models: Maximal Flow (Edmonds-Karp BFS with Min-Cut Partition)
// ==========================================
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
    originalCapacity[u][v] += e.cost;
    residualCapacity[u][v] += e.cost;
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

  // Min-Cut computation (BFS reachable from source)
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

  // Calculate flow on every original edge
  const selectedEdges: { from: string; to: string; weight: number; stepReason?: string }[] = [];
  const flowBreakdown: { from: string; to: string; flow: number; capacity: number }[] = [];

  edges.forEach((e) => {
    const u = String(e.from);
    const v = String(e.to);
    const cap = originalCapacity[u][v];
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

// ==========================================
// 7. Project Planning: CPM / PERT
// ==========================================
export function solveCpmPert(activities: CpmActivity[]): CpmSolution {
  const earlyStart: Record<string, number> = {};
  const earlyFinish: Record<string, number> = {};
  const lateStart: Record<string, number> = {};
  const lateFinish: Record<string, number> = {};
  const slack: Record<string, number> = {};

  const actMap = new Map<string, CpmActivity>();
  activities.forEach((a) => actMap.set(a.id, a));

  // Forward Pass
  activities.forEach((a) => {
    const dur = a.duration;
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
    const dur = a.duration;
    // Find successors
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

    slack[a.id] = lateStart[a.id] - earlyStart[a.id];
  });

  const criticalPath = activities.filter((a) => Math.abs(slack[a.id]) < 1e-5).map((a) => a.id);

  const schedule = activities.map((a) => ({
    id: a.id,
    name: a.name || a.id,
    duration: a.duration,
    earlyStart: earlyStart[a.id],
    earlyFinish: earlyFinish[a.id],
    lateStart: lateStart[a.id],
    lateFinish: lateFinish[a.id],
    slack: slack[a.id],
    isCritical: criticalPath.includes(a.id),
  }));

  return {
    projectDuration,
    criticalPath,
    activities: schedule,
    schedule,
  };
}

// ==========================================
// 8. Queuing Analysis (M/M/1, M/M/c, M/M/1/K)
// ==========================================
export function solveQueuing(problem: QueuingProblem): QueuingSolution {
  const { arrivalRateLambda: lambda, serviceRateMu: mu, serversCountC: c } = problem;

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

    return {
      utilizationRho: Math.round(rho * 1000) / 1000,
      probZeroP0: Math.round(p0 * 1000) / 1000,
      avgInQueueLq: Math.round(Lq * 1000) / 1000,
      avgInSystemLs: Math.round(Ls * 1000) / 1000,
      avgWaitQueueWq: Math.round(Wq * 1000) / 1000,
      avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
    };
  } else {
    const numServers = c ?? 1;
    const r = lambda / mu;
    const rho = r / numServers;

    // Iteratively compute terms: term[n] = (r^n / n!) using recurrence term[n] = term[n-1] * (r / n)
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

    return {
      utilizationRho: Math.round(rho * 1000) / 1000,
      probZeroP0: Math.round(p0 * 1000) / 1000,
      avgInQueueLq: Math.round(Lq * 1000) / 1000,
      avgInSystemLs: Math.round(Ls * 1000) / 1000,
      avgWaitQueueWq: Math.round(Wq * 1000) / 1000,
      avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
    };
  }
}

// ==========================================
// 9. Zero-Sum Games (Minimax / Maximin)
// ==========================================
export function solveZeroSumGame(problem: ZeroSumGameProblem): ZeroSumGameSolution {
  const m = problem.player1Strategies.length;
  const n = problem.player2Strategies.length;
  const matrix = problem.payoffMatrix;

  // Row minimums (Player 1 security levels)
  const rowMins: number[] = matrix.map((row) => Math.min(...row));
  const maximin = Math.max(...rowMins);

  // Column maximums (Player 2 minimum penalties)
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
  } else {
    // Equal distribution placeholder if no pure saddle point
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

// ==========================================
// 10. Inventory Control (EOQ)
// ==========================================
export function solveInventoryControl(problem: InventoryProblem): InventorySolution {
  const { annualDemandD: D, orderingCostK: K, holdingCostH: H, unitPriceC: C } = problem;

  if (problem.priceBreaks && problem.priceBreaks.length > 0) {
    let bestTotalCost = Infinity;
    let bestQty = 0;
    let selectedTier = problem.priceBreaks[0];

    for (const tier of problem.priceBreaks) {
      const tierUnitPrice = tier.unitPrice;
      const tierH = problem.holdingCostH > 0 && problem.holdingCostH < 1 ? problem.holdingCostH * tierUnitPrice : problem.holdingCostH;
      let Q = Math.sqrt((2 * K * D) / tierH);

      if (Q < tier.minQty) {
        Q = tier.minQty;
      } else if (tier.maxQty && Q > tier.maxQty) {
        Q = tier.maxQty;
      }

      const cost = (D / Q) * K + (Q / 2) * tierH + tierUnitPrice * D;
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
    };
  }

  // Wilson Classic EOQ: Q* = sqrt(2KD / H)
  const Q_star = Math.sqrt((2 * K * D) / H);
  const totalAnnualCost = (D / Q_star) * K + (Q_star / 2) * H + C * D;
  const cycleTimeMonths = (Q_star / D) * 12;

  return {
    optimalOrderQtyY: Math.round(Q_star),
    totalAnnualCost: Math.round(totalAnnualCost * 100) / 100,
    cycleTimeMonths: Math.round(cycleTimeMonths * 10) / 10,
    reorderPoint: Math.round((D / 365) * 5),
  };
}
// ==========================================
// 11. Simultaneous Linear Equations (Gauss-Jordan Ax = b)
// ==========================================
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
