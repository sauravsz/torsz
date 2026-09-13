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
// 1. Linear Programming (Simplex Method & 2D Graphical)
// ==========================================
export function solveLinearProgramming(problem: LpProblem): LpSolution {
  const numVars = problem.objectiveCoefficients.length;
  const numConstraints = problem.constraints.length;
  const varNames = problem.variableNames || Array.from({ length: numVars }, (_, i) => `x${i + 1}`);

  const isMax = problem.objective === "max";
  const objCoeffs = problem.objectiveCoefficients.map((c) => (isMax ? c : -c));

  // Tableau columns: [x1, x2, ..., s1, s2, ..., RHS]
  const totalSlack = numConstraints;
  const headers = [...varNames, ...Array.from({ length: totalSlack }, (_, i) => `s${i + 1}`), "RHS"];
  const tableauCols = headers.length;
  const tableauRows = numConstraints + 1;

  let currentTableau: number[][] = Array.from({ length: tableauRows }, () =>
    Array(tableauCols).fill(0)
  );

  let basicVars: string[] = [];

  for (let i = 0; i < numConstraints; i++) {
    const c = problem.constraints[i];
    for (let j = 0; j < numVars; j++) {
      currentTableau[i][j] = c.coefficients[j] || 0;
    }
    currentTableau[i][numVars + i] = 1;
    currentTableau[i][tableauCols - 1] = c.rhs;
    basicVars.push(`s${i + 1}`);
  }

  // Objective row (Z row)
  for (let j = 0; j < numVars; j++) {
    currentTableau[tableauRows - 1][j] = -objCoeffs[j];
  }

  const tableaus: SimplexTableauIteration[] = [];
  let iterations = 0;
  const maxIterations = 50;

  while (iterations < maxIterations) {
    // Check optimality: find entering variable (most negative in Z row)
    let pivotCol = -1;
    let minVal = -1e-6;

    for (let j = 0; j < tableauCols - 1; j++) {
      if (currentTableau[tableauRows - 1][j] < minVal) {
        minVal = currentTableau[tableauRows - 1][j];
        pivotCol = j;
      }
    }

    const ratios: (number | null)[] = [];
    let pivotRow = -1;
    let minRatio = Infinity;

    if (pivotCol !== -1) {
      for (let i = 0; i < numConstraints; i++) {
        const coeff = currentTableau[i][pivotCol];
        if (coeff > 1e-6) {
          const ratio = currentTableau[i][tableauCols - 1] / coeff;
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

    // Snapshot iteration tableau
    tableaus.push({
      iteration: iterations,
      basicVars: [...basicVars],
      headers: [...headers],
      rows: currentTableau.slice(0, numConstraints).map((r) => [...r]),
      zRow: [...currentTableau[tableauRows - 1]],
      enteringVar: pivotCol !== -1 ? headers[pivotCol] : undefined,
      leavingVar: pivotRow !== -1 ? basicVars[pivotRow] : undefined,
      pivotRowIdx: pivotRow !== -1 ? pivotRow : undefined,
      pivotColIdx: pivotCol !== -1 ? pivotCol : undefined,
      ratios: ratios.length > 0 ? ratios : undefined,
    });

    if (pivotCol === -1 || pivotRow === -1) {
      break;
    }

    // Pivot operation
    const pivotVal = currentTableau[pivotRow][pivotCol];
    for (let j = 0; j < tableauCols; j++) {
      currentTableau[pivotRow][j] /= pivotVal;
    }

    basicVars[pivotRow] = headers[pivotCol];

    for (let i = 0; i < tableauRows; i++) {
      if (i !== pivotRow) {
        const factor = currentTableau[i][pivotCol];
        for (let j = 0; j < tableauCols; j++) {
          currentTableau[i][j] -= factor * currentTableau[pivotRow][j];
        }
      }
    }

    iterations++;
  }

  // Extract variables
  const varMap: Record<string, number> = {};
  for (const name of varNames) varMap[name] = 0;

  for (let i = 0; i < numConstraints; i++) {
    const varName = basicVars[i];
    if (varNames.includes(varName)) {
      varMap[varName] = Math.max(0, currentTableau[i][tableauCols - 1]);
    }
  }

  const optimalZ = isMax
    ? currentTableau[tableauRows - 1][tableauCols - 1]
    : -currentTableau[tableauRows - 1][tableauCols - 1];

  // Dual shadow prices from slack columns
  const dualPrices = problem.constraints.map((c, i) => {
    const slackColIdx = numVars + i;
    const shadowPrice = Math.abs(currentTableau[tableauRows - 1][slackColIdx]);
    return {
      constraint: `Constraint ${i + 1} (${c.operator} ${c.rhs})`,
      shadowPrice: Math.round(shadowPrice * 1000) / 1000,
      slack: Math.round(currentTableau[i][tableauCols - 1] * 1000) / 1000,
    };
  });

  // 2D Graphical Solver (if 2 variables)
  let graphical: GraphicalLpSolution | undefined;
  if (numVars === 2) {
    graphical = solveGraphical2D(problem);
  }

  return {
    status: "optimal",
    objectiveValue: Math.round(optimalZ * 1000) / 1000,
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
  const lines: GraphicalLine[] = [];

  let maxX = 10;
  let maxY = 10;

  problem.constraints.forEach((c, idx) => {
    const a1 = c.coefficients[0] || 0;
    const a2 = c.coefficients[1] || 0;
    const rhs = c.rhs;

    const xInt = a1 !== 0 ? rhs / a1 : null;
    const yInt = a2 !== 0 ? rhs / a2 : null;
    const slope = a2 !== 0 ? -a1 / a2 : null;

    if (xInt && xInt > 0) maxX = Math.max(maxX, xInt * 1.3);
    if (yInt && yInt > 0) maxY = Math.max(maxY, yInt * 1.3);

    lines.push({
      label: `C${idx + 1}: ${a1}x₁ + ${a2}x₂ ${c.operator} ${rhs}`,
      xIntercept: xInt,
      yIntercept: yInt,
      slope,
      operator: c.operator,
      rhs,
      c1: a1,
      c2: a2,
    });
  });

  // Calculate intersection candidate points
  const candidatePoints: [number, number][] = [
    [0, 0],
    [0, maxY],
    [maxX, 0],
  ];

  // Axis intercepts
  lines.forEach((l) => {
    if (l.xIntercept && l.xIntercept >= 0) candidatePoints.push([l.xIntercept, 0]);
    if (l.yIntercept && l.yIntercept >= 0) candidatePoints.push([0, l.yIntercept]);
  });

  // Intersections between all line pairs
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const l1 = lines[i];
      const l2 = lines[j];
      const det = l1.c1 * l2.c2 - l1.c2 * l2.c1;
      if (Math.abs(det) > 1e-6) {
        const x1 = (l1.rhs * l2.c2 - l1.c2 * l2.rhs) / det;
        const x2 = (l1.c1 * l2.rhs - l1.rhs * l2.c1) / det;
        if (x1 >= 0 && x2 >= 0) {
          candidatePoints.push([x1, x2]);
        }
      }
    }
  }

  // Filter feasible points
  const feasiblePoints = candidatePoints.filter(([x1, x2]) => {
    if (x1 < -1e-6 || x2 < -1e-6) return false;
    return problem.constraints.every((c) => {
      const val = (c.coefficients[0] || 0) * x1 + (c.coefficients[1] || 0) * x2;
      if (c.operator === "<=") return val <= c.rhs + 1e-5;
      if (c.operator === ">=") return val >= c.rhs - 1e-5;
      return Math.abs(val - c.rhs) <= 1e-5;
    });
  });

  // Find optimal vertex
  let optimalPoint: [number, number] = [0, 0];
  let optimalZ = isMax ? -Infinity : Infinity;

  const cornerPoints: GraphicalCornerPoint[] = candidatePoints.map(([x1, x2]) => {
    const isFeasible = feasiblePoints.some(
      ([fx1, fx2]) => Math.abs(fx1 - x1) < 1e-4 && Math.abs(fx2 - x2) < 1e-4
    );
    const z = c1 * x1 + c2 * x2;
    return {
      x1: Math.round(x1 * 100) / 100,
      x2: Math.round(x2 * 100) / 100,
      zValue: Math.round(z * 100) / 100,
      isFeasible,
      isOptimal: false,
    };
  });

  feasiblePoints.forEach(([x1, x2]) => {
    const z = c1 * x1 + c2 * x2;
    if (isMax ? z > optimalZ : z < optimalZ) {
      optimalZ = z;
      optimalPoint = [x1, x2];
    }
  });

  cornerPoints.forEach((p) => {
    if (Math.abs(p.x1 - optimalPoint[0]) < 1e-3 && Math.abs(p.x2 - optimalPoint[1]) < 1e-3) {
      p.isOptimal = true;
    }
  });

  // Compute convex hull / ordered polygon vertices for feasible region
  const center = feasiblePoints.reduce(
    (acc, p) => [acc[0] + p[0] / feasiblePoints.length, acc[1] + p[1] / feasiblePoints.length],
    [0, 0]
  );

  const sortedFeasible = [...feasiblePoints].sort((a, b) => {
    const angleA = Math.atan2(a[1] - center[1], a[0] - center[0]);
    const angleB = Math.atan2(b[1] - center[1], b[0] - center[0]);
    return angleA - angleB;
  });

  return {
    lines,
    feasiblePolygon: sortedFeasible.map(([x1, x2]) => [Math.round(x1 * 100) / 100, Math.round(x2 * 100) / 100]),
    cornerPoints,
    optimalPoint: [Math.round(optimalPoint[0] * 100) / 100, Math.round(optimalPoint[1] * 100) / 100],
    optimalZ: Math.round(optimalZ * 100) / 100,
    maxX: Math.max(maxX, optimalPoint[0] * 1.4),
    maxY: Math.max(maxY, optimalPoint[1] * 1.4),
  };
}

// ==========================================
// 2. Hungarian Assignment Model
// ==========================================
export function solveHungarianAssignment(problem: AssignmentProblem): AssignmentSolution {
  const nRows = problem.workers.length;
  const nCols = problem.jobs.length;
  const n = Math.max(nRows, nCols);

  // Pad matrix to n x n if rectangular
  const matrix: number[][] = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      if (r < nRows && c < nCols) return problem.costs[r][c];
      return 0;
    })
  );

  const steps: { label: string; matrix: number[][] }[] = [];

  // Step 1: Row reduction
  for (let r = 0; r < n; r++) {
    const minVal = Math.min(...matrix[r]);
    for (let c = 0; c < n; c++) {
      matrix[r][c] -= minVal;
    }
  }
  steps.push({ label: "1. Row Reduction (Subtract Row Minima)", matrix: matrix.map((r) => [...r]) });

  // Step 2: Column reduction
  for (let c = 0; c < n; c++) {
    let minVal = Infinity;
    for (let r = 0; r < n; r++) {
      minVal = Math.min(minVal, matrix[r][c]);
    }
    for (let r = 0; r < n; r++) {
      matrix[r][c] -= minVal;
    }
  }
  steps.push({ label: "2. Column Reduction (Subtract Column Minima)", matrix: matrix.map((r) => [...r]) });

  // Maximum Bipartite Matching on Zero Elements using Augmenting Paths (Hopcroft-Karp / DFS)
  function findMaxMatching(costMat: number[][]): { matchRow: (number | null)[]; matchCol: (number | null)[] } {
    const matchRow: (number | null)[] = Array(n).fill(null);
    const matchCol: (number | null)[] = Array(n).fill(null);

    function dfs(u: number, visited: boolean[]): boolean {
      for (let v = 0; v < n; v++) {
        if (costMat[u][v] === 0 && !visited[v]) {
          visited[v] = true;
          if (matchCol[v] === null || dfs(matchCol[v]!, visited)) {
            matchRow[u] = v;
            matchCol[v] = u;
            return true;
          }
        }
      }
      return false;
    }

    for (let u = 0; u < n; u++) {
      const visited = Array(n).fill(false);
      dfs(u, visited);
    }

    return { matchRow, matchCol };
  }

  let iter = 0;
  const maxIters = 30;
  let currentMatching = findMaxMatching(matrix);

  while (iter < maxIters) {
    const matchCount = currentMatching.matchRow.filter((c) => c !== null).length;
    if (matchCount === n) {
      break; // Optimal matching of n zeros found
    }

    // Find minimum vertex cover using König's theorem
    const visitedRows = Array(n).fill(false);
    const visitedCols = Array(n).fill(false);

    function dfsCover(u: number) {
      visitedRows[u] = true;
      for (let v = 0; v < n; v++) {
        if (matrix[u][v] === 0 && !visitedCols[v]) {
          visitedCols[v] = true;
          const matchedRow = currentMatching.matchCol[v];
          if (matchedRow !== null && !visitedRows[matchedRow]) {
            dfsCover(matchedRow);
          }
        }
      }
    }

    for (let u = 0; u < n; u++) {
      if (currentMatching.matchRow[u] === null) {
        dfsCover(u);
      }
    }

    // Marked rows = visitedRows, marked cols = visitedCols
    // Covered rows = NOT visitedRows, Covered cols = visitedCols
    let theta = Infinity;
    for (let r = 0; r < n; r++) {
      if (visitedRows[r]) {
        for (let c = 0; c < n; c++) {
          if (!visitedCols[c]) {
            theta = Math.min(theta, matrix[r][c]);
          }
        }
      }
    }

    if (theta === Infinity || theta === 0) theta = 1;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (visitedRows[r] && !visitedCols[c]) {
          matrix[r][c] -= theta;
        } else if (!visitedRows[r] && visitedCols[c]) {
          matrix[r][c] += theta;
        }
      }
    }

    iter++;
    steps.push({
      label: `${steps.length + 1}. Minimum Line Covering & Matrix Shift (θ = ${theta})`,
      matrix: matrix.map((r) => [...r]),
    });

    currentMatching = findMaxMatching(matrix);
  }

  const assignedJobs = currentMatching.matchRow;
  const assignments: { worker: string; job: string; cost: number }[] = [];

  for (let r = 0; r < nRows; r++) {
    const worker = problem.workers[r];
    const jobIdx = assignedJobs[r] !== null ? assignedJobs[r]! : 0;
    const job = jobIdx < nCols ? problem.jobs[jobIdx] : "Dummy Job";
    const cost = jobIdx < nCols && r < nRows ? problem.costs[r][jobIdx] : 0;
    assignments.push({ worker, job, cost });
  }

  const totalCost = assignments.reduce((acc, a) => acc + a.cost, 0);

  return {
    assignments,
    totalCost,
    steps,
  };
}

// ==========================================
// 3. Transportation Model (Vogel's VAM)
// ==========================================
export function solveTransportation(problem: TransportationProblem): TransportationSolution {
  const sources = [...problem.sources];
  const destinations = [...problem.destinations];
  const supply = [...problem.supply];
  const demand = [...problem.demand];
  const costs = problem.costs.map((row) => [...row]);

  const totalSupply = supply.reduce((a, b) => a + b, 0);
  const totalDemand = demand.reduce((a, b) => a + b, 0);
  let dummyAdded: "supply" | "demand" | null = null;

  if (totalSupply > totalDemand) {
    destinations.push("Dummy Demand");
    demand.push(totalSupply - totalDemand);
    for (let r = 0; r < costs.length; r++) {
      costs[r].push(0);
    }
    dummyAdded = "demand";
  } else if (totalDemand > totalSupply) {
    sources.push("Dummy Supply");
    supply.push(totalDemand - totalSupply);
    costs.push(Array(destinations.length).fill(0));
    dummyAdded = "supply";
  }

  const numS = sources.length;
  const numD = destinations.length;
  const allocations: number[][] = Array.from({ length: numS }, () => Array(numD).fill(0));

  const remSupply = [...supply];
  const remDemand = [...demand];
  const activeRows = new Set(Array.from({ length: numS }, (_, i) => i));
  const activeCols = new Set(Array.from({ length: numD }, (_, i) => i));

  while (activeRows.size > 0 && activeCols.size > 0) {
    if (activeRows.size === 1 && activeCols.size === 1) {
      const r = Array.from(activeRows)[0];
      const c = Array.from(activeCols)[0];
      const qty = Math.min(remSupply[r], remDemand[c]);
      allocations[r][c] = qty;
      break;
    }

    let maxPenalty = -1;
    let isRow = true;
    let selectedIdx = -1;

    for (const r of activeRows) {
      const availableCosts = Array.from(activeCols).map((c) => costs[r][c]).sort((a, b) => a - b);
      const penalty = availableCosts.length > 1 ? availableCosts[1] - availableCosts[0] : availableCosts[0];
      if (penalty > maxPenalty) {
        maxPenalty = penalty;
        isRow = true;
        selectedIdx = r;
      }
    }

    for (const c of activeCols) {
      const availableCosts = Array.from(activeRows).map((r) => costs[r][c]).sort((a, b) => a - b);
      const penalty = availableCosts.length > 1 ? availableCosts[1] - availableCosts[0] : availableCosts[0];
      if (penalty > maxPenalty) {
        maxPenalty = penalty;
        isRow = false;
        selectedIdx = c;
      }
    }

    if (isRow) {
      const r = selectedIdx;
      let minCost = Infinity;
      let targetCol = -1;
      for (const c of activeCols) {
        if (costs[r][c] < minCost) {
          minCost = costs[r][c];
          targetCol = c;
        }
      }
      const qty = Math.min(remSupply[r], remDemand[targetCol]);
      allocations[r][targetCol] = qty;
      remSupply[r] -= qty;
      remDemand[targetCol] -= qty;

      if (remSupply[r] === 0) activeRows.delete(r);
      if (remDemand[targetCol] === 0) activeCols.delete(targetCol);
    } else {
      const c = selectedIdx;
      let minCost = Infinity;
      let targetRow = -1;
      for (const r of activeRows) {
        if (costs[r][c] < minCost) {
          minCost = costs[r][c];
          targetRow = r;
        }
      }
      const qty = Math.min(remSupply[targetRow], remDemand[c]);
      allocations[targetRow][c] = qty;
      remSupply[targetRow] -= qty;
      remDemand[c] -= qty;

      if (remSupply[targetRow] === 0) activeRows.delete(targetRow);
      if (remDemand[c] === 0) activeCols.delete(c);
    }
  }

  let totalCost = 0;
  for (let r = 0; r < numS; r++) {
    for (let c = 0; c < numD; c++) {
      totalCost += allocations[r][c] * costs[r][c];
    }
  }

  return {
    allocations,
    totalCost,
    isBalanced: totalSupply === totalDemand,
    dummyAdded,
    method: "Vogel's Approximation Method (VAM)",
  };
}

// ==========================================
// 4. Network Models: Shortest Route & MST & Max Flow
// ==========================================
export function solveNetworkShortestRoute(
  edges: NetworkEdge[],
  startNode: string,
  endNode: string
): NetworkSolution {
  const adj: Record<string, { to: string; cost: number }[]> = {};
  for (const e of edges) {
    const u = String(e.from);
    const v = String(e.to);
    if (!adj[u]) adj[u] = [];
    if (!adj[v]) adj[v] = [];
    adj[u].push({ to: v, cost: e.cost });
    adj[v].push({ to: u, cost: e.cost });
  }

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const node of Object.keys(adj)) {
    dist[node] = Infinity;
    prev[node] = null;
    unvisited.add(node);
  }

  dist[startNode] = 0;

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let minDist = Infinity;

    for (const node of unvisited) {
      if (dist[node] < minDist) {
        minDist = dist[node];
        curr = node;
      }
    }

    if (!curr || minDist === Infinity) break;
    if (curr === endNode) break;

    unvisited.delete(curr);

    for (const neighbor of adj[curr] || []) {
      if (unvisited.has(neighbor.to)) {
        const alt = dist[curr] + neighbor.cost;
        if (alt < dist[neighbor.to]) {
          dist[neighbor.to] = alt;
          prev[neighbor.to] = curr;
        }
      }
    }
  }

  if (dist[endNode] === undefined || dist[endNode] === Infinity) {
    return {
      type: "shortest-route",
      selectedEdges: [],
      totalMetric: 0,
      pathString: "No route exists between selected nodes",
    };
  }

  const path: string[] = [];
  let curr: string | null = endNode;
  while (curr !== null) {
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
    totalMetric: dist[endNode] || 0,
    pathString: path.join(" -> "),
  };
}

export function solveNetworkMst(edges: NetworkEdge[]): NetworkSolution {
  const sorted = [...edges].sort((a, b) => a.cost - b.cost);
  const parent: Record<string, string> = {};

  const find = (i: string): string => {
    if (!parent[i]) parent[i] = i;
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  };

  const union = (i: string, j: string): boolean => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootI] = rootJ;
      return true;
    }
    return false;
  };

  const selectedEdges: { from: string; to: string; weight: number; stepReason?: string }[] = [];
  let totalWeight = 0;

  for (const e of sorted) {
    const u = String(e.from);
    const v = String(e.to);
    if (union(u, v)) {
      selectedEdges.push({
        from: u,
        to: v,
        weight: e.cost,
        stepReason: `Selected edge (${u}-${v}) with weight ${e.cost}`,
      });
      totalWeight += e.cost;
    }
  }

  return {
    type: "minimum-spanning-tree",
    selectedEdges,
    totalMetric: Math.round(totalWeight * 100) / 100,
    pathString: selectedEdges.map((e) => `${e.from}-${e.to}`).join(", "),
  };
}

export function solveNetworkMaxFlow(
  edges: NetworkEdge[],
  source: string,
  sink: string
): NetworkSolution {
  const normSource = String(source).trim();
  const normSink = String(sink).trim();

  // Edmonds-Karp with residual graph tracking and initial capacity preservation
  const originalCapacity: Record<string, Record<string, number>> = {};
  const residualCapacity: Record<string, Record<string, number>> = {};
  const nodes = new Set<string>();

  for (const e of edges) {
    const u = String(e.from).trim();
    const v = String(e.to).trim();
    const cap = Math.max(0, e.capacity !== undefined ? e.capacity : e.cost);
    nodes.add(u);
    nodes.add(v);

    if (!originalCapacity[u]) originalCapacity[u] = {};
    if (!originalCapacity[v]) originalCapacity[v] = {};
    if (!residualCapacity[u]) residualCapacity[u] = {};
    if (!residualCapacity[v]) residualCapacity[v] = {};

    originalCapacity[u][v] = (originalCapacity[u][v] || 0) + cap;
    residualCapacity[u][v] = (residualCapacity[u][v] || 0) + cap;
    if (residualCapacity[v][u] === undefined) residualCapacity[v][u] = 0;
  }

  // Handle case where source or sink are not in node set
  if (!nodes.has(normSource) || !nodes.has(normSink) || normSource === normSink) {
    return {
      type: "maximal-flow",
      selectedEdges: [],
      totalMetric: 0,
      pathString: "Source or Sink node invalid / disconnected in network topology.",
      flowBreakdown: [],
    };
  }

  let maxFlow = 0;

  // Edmonds-Karp BFS to find shortest augmenting path in terms of edge count
  while (true) {
    const parent: Record<string, string | null> = {};
    for (const n of nodes) parent[n] = null;
    const queue: string[] = [normSource];

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (u === normSink) break;

      const neighbors = Object.keys(residualCapacity[u] || {});
      for (const v of neighbors) {
        if (parent[v] === null && v !== normSource && residualCapacity[u][v] > 0) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }

    if (parent[normSink] === null) break; // No augmenting path exists

    // Calculate bottleneck capacity along path
    let pathFlow = Infinity;
    let curr = normSink;
    while (curr !== normSource) {
      const p = parent[curr]!;
      pathFlow = Math.min(pathFlow, residualCapacity[p][curr]);
      curr = p;
    }

    // Augment flow and update forward/backward residual capacities
    curr = normSink;
    while (curr !== normSource) {
      const p = parent[curr]!;
      residualCapacity[p][curr] -= pathFlow;
      residualCapacity[curr][p] += pathFlow;
      curr = p;
    }

    maxFlow += pathFlow;
  }

  // Compute actual net flow along each original edge
  const flowBreakdown: { from: string; to: string; flow: number; capacity: number }[] = [];
  const selectedEdges: { from: string; to: string; weight: number; stepReason?: string }[] = [];

  for (const u of Object.keys(originalCapacity)) {
    for (const v of Object.keys(originalCapacity[u])) {
      const origCap = originalCapacity[u][v];
      if (origCap > 0) {
        const remainingCap = residualCapacity[u]?.[v] || 0;
        const actualFlow = Math.max(0, origCap - remainingCap);
        flowBreakdown.push({
          from: u,
          to: v,
          flow: actualFlow,
          capacity: origCap,
        });

        if (actualFlow > 0) {
          selectedEdges.push({
            from: u,
            to: v,
            weight: actualFlow,
            stepReason: `Flow: ${actualFlow} / ${origCap}`,
          });
        }
      }
    }
  }

  // Find Min-Cut partition using BFS on final residual graph from source
  const reachableFromSource = new Set<string>();
  const cutQueue = [normSource];
  reachableFromSource.add(normSource);

  while (cutQueue.length > 0) {
    const u = cutQueue.shift()!;
    for (const v of Object.keys(residualCapacity[u] || {})) {
      if (!reachableFromSource.has(v) && residualCapacity[u][v] > 0) {
        reachableFromSource.add(v);
        cutQueue.push(v);
      }
    }
  }

  const sourceSet = Array.from(reachableFromSource).sort();
  const sinkSet = Array.from(nodes).filter((n) => !reachableFromSource.has(n)).sort();

  return {
    type: "maximal-flow",
    selectedEdges,
    totalMetric: maxFlow,
    pathString: `Maximal Throughput: ${maxFlow} units | Min-Cut: S = {${sourceSet.join(", ")}} | T = {${sinkSet.join(", ")}}`,
    flowBreakdown,
    minCut: {
      sourceSet,
      sinkSet,
      cutCapacity: maxFlow,
    },
  };
}

// ==========================================
// 5. Project Planning (CPM / PERT)
// ==========================================
export function solveCpmPert(activities: CpmActivity[]): CpmSolution {
  const earlyStart: Record<string, number> = {};
  const earlyFinish: Record<string, number> = {};
  const actDurations: Record<string, number> = {};

  let totalProjectVariance = 0;

  for (const a of activities) {
    let dur = a.duration;
    if (a.optimisticA !== undefined && a.mostLikelyM !== undefined && a.pessimisticB !== undefined) {
      // PERT 3-Time mean and variance
      dur = (a.optimisticA + 4 * a.mostLikelyM + a.pessimisticB) / 6;
      const variance = Math.pow((a.pessimisticB - a.optimisticA) / 6, 2);
      totalProjectVariance += variance;
    }
    actDurations[a.id] = Math.round(dur * 100) / 100;
  }

  // Forward Pass
  for (const a of activities) {
    const dur = actDurations[a.id];
    if (!a.predecessors || a.predecessors.length === 0) {
      earlyStart[a.id] = 0;
      earlyFinish[a.id] = dur;
    } else {
      let maxEF = 0;
      for (const p of a.predecessors) {
        maxEF = Math.max(maxEF, earlyFinish[p] || 0);
      }
      earlyStart[a.id] = maxEF;
      earlyFinish[a.id] = Math.round((maxEF + dur) * 100) / 100;
    }
  }

  const projectDuration = Math.max(...Object.values(earlyFinish), 0);

  // Backward Pass
  const lateFinish: Record<string, number> = {};
  const lateStart: Record<string, number> = {};
  const successors: Record<string, string[]> = {};
  for (const a of activities) successors[a.id] = [];
  for (const a of activities) {
    for (const p of a.predecessors || []) {
      if (successors[p]) successors[p].push(a.id);
    }
  }

  const reversed = [...activities].reverse();
  for (const a of reversed) {
    const dur = actDurations[a.id];
    const succs = successors[a.id] || [];
    if (succs.length === 0) {
      lateFinish[a.id] = projectDuration;
      lateStart[a.id] = Math.round((projectDuration - dur) * 100) / 100;
    } else {
      let minLS = Infinity;
      for (const s of succs) {
        minLS = Math.min(minLS, lateStart[s]);
      }
      lateFinish[a.id] = minLS;
      lateStart[a.id] = Math.round((minLS - dur) * 100) / 100;
    }
  }

  const activityResults = activities.map((a) => {
    const dur = actDurations[a.id];
    const es = earlyStart[a.id] || 0;
    const ef = earlyFinish[a.id] || 0;
    const ls = lateStart[a.id] || 0;
    const lf = lateFinish[a.id] || 0;
    const slack = Math.round((ls - es) * 100) / 100;

    return {
      id: a.id,
      duration: dur,
      earlyStart: es,
      earlyFinish: ef,
      lateStart: ls,
      lateFinish: lf,
      slack,
      isCritical: Math.abs(slack) < 1e-4,
    };
  });

  const criticalPath = activityResults.filter((a) => a.isCritical).map((a) => a.id);

  return {
    activities: activityResults,
    criticalPath,
    projectDuration,
    projectVariance: Math.round(totalProjectVariance * 100) / 100,
    projectStdDev: Math.round(Math.sqrt(totalProjectVariance) * 100) / 100,
  };
}

// ==========================================
// 6. Inventory Control (EOQ Models)
// ==========================================
export function solveInventoryControl(problem: InventoryProblem): InventorySolution {
  const D = problem.annualDemandD;
  const K = problem.orderingCostK;
  const h = problem.holdingCostH;
  const c = problem.unitPriceC;

  if (problem.model === "quantity-discounts" && problem.priceBreaks && problem.priceBreaks.length > 0) {
    const tiers = problem.priceBreaks.map((tier, idx) => {
      const tierPrice = tier.unitPrice;
      const tierHolding = tier.holdingCostH || (h / c) * tierPrice || h;
      const calculatedEoq = Math.sqrt((2 * K * D) / tierHolding);

      let feasibleQty = calculatedEoq;
      let isFeasible = true;

      if (calculatedEoq < tier.minQty) {
        feasibleQty = tier.minQty;
        isFeasible = false;
      } else if (tier.maxQty !== undefined && calculatedEoq > tier.maxQty) {
        feasibleQty = tier.maxQty;
        isFeasible = false;
      }

      const annualOrdering = (K * D) / feasibleQty;
      const annualHolding = (tierHolding * feasibleQty) / 2;
      const totalCost = tierPrice * D + annualOrdering + annualHolding;

      return {
        tierIndex: idx + 1,
        minQty: tier.minQty,
        maxQty: tier.maxQty,
        unitPrice: tierPrice,
        holdingCostH: tierHolding,
        eoqCalculated: Math.round(calculatedEoq),
        isFeasible,
        totalCost: Math.round(totalCost * 100) / 100,
        orderQty: Math.round(feasibleQty),
      };
    });

    // Find tier with lowest total cost
    let bestTier = tiers[0];
    for (const t of tiers) {
      if (t.totalCost < bestTier.totalCost) {
        bestTier = t;
      }
    }

    const optimalOrderQtyY = bestTier.orderQty;
    const t0Days = (optimalOrderQtyY / D) * 365;
    const annualOrderingCost = (K * D) / optimalOrderQtyY;
    const annualHoldingCost = ((bestTier.holdingCostH || h) * optimalOrderQtyY) / 2;

    return {
      optimalOrderQtyY,
      cycleTimeT0Days: Math.round(t0Days * 10) / 10,
      annualOrderingCost: Math.round(annualOrderingCost * 100) / 100,
      annualHoldingCost: Math.round(annualHoldingCost * 100) / 100,
      totalAnnualCost: bestTier.totalCost,
      selectedPriceBreakTier: bestTier.tierIndex,
      priceBreakAnalysis: tiers.map((t) => ({
        tierIndex: t.tierIndex,
        minQty: t.minQty,
        maxQty: t.maxQty,
        unitPrice: t.unitPrice,
        holdingCostH: t.holdingCostH,
        eoqCalculated: t.eoqCalculated,
        isFeasible: t.isFeasible,
        totalCost: t.totalCost,
      })),
    };
  }

  if (problem.model === "classic-eoq" || !problem.shortageCostP) {
    const yStar = Math.sqrt((2 * K * D) / h);
    const t0Days = (yStar / D) * 365;
    const annualOrdering = (K * D) / yStar;
    const annualHolding = (h * yStar) / 2;
    const totalCost = c * D + annualOrdering + annualHolding;

    return {
      optimalOrderQtyY: Math.round(yStar),
      cycleTimeT0Days: Math.round(t0Days * 10) / 10,
      annualOrderingCost: Math.round(annualOrdering * 100) / 100,
      annualHoldingCost: Math.round(annualHolding * 100) / 100,
      totalAnnualCost: Math.round(totalCost * 100) / 100,
    };
  } else {
    // EOQ with Backorders / Planned Shortages
    const p = problem.shortageCostP;
    const yStar = Math.sqrt(((2 * K * D) / h) * ((h + p) / p));
    const sStar = (h * yStar) / (h + p); // max shortage
    const t0Days = (yStar / D) * 365;
    const annualOrdering = (K * D) / yStar;
    const annualHolding = (h * Math.pow(yStar - sStar, 2)) / (2 * yStar);
    const annualShortage = (p * Math.pow(sStar, 2)) / (2 * yStar);
    const totalCost = c * D + annualOrdering + annualHolding + annualShortage;

    return {
      optimalOrderQtyY: Math.round(yStar),
      cycleTimeT0Days: Math.round(t0Days * 10) / 10,
      maxShortageS: Math.round(sStar),
      annualOrderingCost: Math.round(annualOrdering * 100) / 100,
      annualHoldingCost: Math.round(annualHolding * 100) / 100,
      annualShortageCost: Math.round(annualShortage * 100) / 100,
      totalAnnualCost: Math.round(totalCost * 100) / 100,
    };
  }
}

// ==========================================
// 7. Queuing Analysis (M/M/1 & M/M/c & M/M/c/K)
// ==========================================
export function solveQueuing(problem: QueuingProblem): QueuingSolution {
  const lambda = problem.arrivalRateLambda;
  const mu = problem.serviceRateMu;
  const c = problem.serversCountC || 1;
  const K = problem.systemCapacityK;

  // Finite Capacity Queue (M/M/1/K or M/M/c/K)
  if (K !== undefined && K > 0) {
    const r = lambda / mu;

    if (c === 1) {
      const rho = r;
      let p0: number;
      if (Math.abs(rho - 1) < 1e-6) {
        p0 = 1 / (K + 1);
      } else {
        p0 = (1 - rho) / (1 - Math.pow(rho, K + 1));
      }

      const pK = p0 * Math.pow(rho, K);
      const lambdaEff = lambda * (1 - pK);

      let Ls: number;
      if (Math.abs(rho - 1) < 1e-6) {
        Ls = K / 2;
      } else {
        Ls = (rho * (1 - (K + 1) * Math.pow(rho, K) + K * Math.pow(rho, K + 1))) / ((1 - rho) * (1 - Math.pow(rho, K + 1)));
      }

      const Lq = Ls - (1 - p0);
      const Ws = Ls / lambdaEff;
      const Wq = Lq / lambdaEff;

      return {
        utilizationRho: Math.round((1 - p0) * 1000) / 1000,
        probZeroP0: Math.round(p0 * 1000) / 1000,
        avgInQueueLq: Math.round(Math.max(0, Lq) * 1000) / 1000,
        avgInSystemLs: Math.round(Ls * 1000) / 1000,
        avgWaitQueueWq: Math.round(Math.max(0, Wq) * 1000) / 1000,
        avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
        blockingProbabilityPk: Math.round(pK * 1000) / 1000,
        effectiveArrivalRate: Math.round(lambdaEff * 1000) / 1000,
      };
    }
  }

  if (lambda >= c * mu) {
    throw new Error(`Unstable queue: Arrival rate (λ=${lambda}) exceeds service capacity (c*μ=${c * mu}).`);
  }

  if (c === 1) {
    const rho = lambda / mu;
    const Lq = (lambda * lambda) / (mu * (mu - lambda));
    const Ls = lambda / (mu - lambda);
    const Wq = Lq / lambda;
    const Ws = 1 / (mu - lambda);
    const p0 = 1 - rho;

    return {
      utilizationRho: Math.round(rho * 1000) / 1000,
      probZeroP0: Math.round(p0 * 1000) / 1000,
      avgInQueueLq: Math.round(Lq * 1000) / 1000,
      avgInSystemLs: Math.round(Ls * 1000) / 1000,
      avgWaitQueueWq: Math.round(Wq * 1000) / 1000,
      avgWaitSystemWs: Math.round(Ws * 1000) / 1000,
    };
  } else {
    const r = lambda / mu;
    const rho = r / c;

    let sumTerms = 0;
    let fact = 1;
    for (let n = 0; n < c; n++) {
      if (n > 0) fact *= n;
      sumTerms += Math.pow(r, n) / fact;
    }
    fact *= c;
    const lastTerm = Math.pow(r, c) / (fact * (1 - rho));
    const p0 = 1 / (sumTerms + lastTerm);

    const Lq = (p0 * Math.pow(r, c) * rho) / (fact * Math.pow(1 - rho, 2));
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
// 8. Zero-Sum Games (Payoff Matrix)
// ==========================================
export function solveZeroSumGame(problem: ZeroSumGameProblem): ZeroSumGameSolution {
  const n = problem.payoffMatrix[0].length;
  const rowMinima = problem.payoffMatrix.map((row) => Math.min(...row));
  const maximin = Math.max(...rowMinima);
  const bestRow = rowMinima.indexOf(maximin);

  const colMaxima = Array.from({ length: n }, (_, c) =>
    Math.max(...problem.payoffMatrix.map((row) => row[c]))
  );
  const minimax = Math.min(...colMaxima);
  const bestCol = colMaxima.indexOf(minimax);

  const hasSaddlePoint = maximin === minimax;

  return {
    hasSaddlePoint,
    saddlePoint: hasSaddlePoint
      ? { row: bestRow, col: bestCol, value: maximin }
      : undefined,
    maximinValue: maximin,
    minimaxValue: minimax,
    gameValue: hasSaddlePoint ? maximin : (maximin + minimax) / 2,
  };
}

// ==========================================
// 9. Linear Equations (Gauss-Jordan Elimination)
// ==========================================
export function solveLinearEquations(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("Singular linear system or infinite solutions.");
    }

    for (let j = i; j <= n; j++) {
      M[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = i; j <= n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }

  return M.map((row) => Math.round(row[n] * 1000) / 1000);
}
