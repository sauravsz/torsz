import { describe, it, expect } from "bun:test";
import {
  solveLinearProgramming,
  solveHungarianAssignment,
  solveTransportation,
  solveNetworkShortestRoute,
  solveNetworkMst,
  solveNetworkMaxFlow,
  solveCpmPert,
  solveInventoryControl,
  solveQueuing,
  solveZeroSumGame,
  solveLinearEquations,
} from "./solvers";
import {
  LpProblem,
  AssignmentProblem,
  TransportationProblem,
  NetworkEdge,
  CpmActivity,
  InventoryProblem,
  QueuingProblem,
  ZeroSumGameProblem,
} from "./types";

describe("TORA Operations Research Solvers", () => {
  // 1. Linear Programming
  it("solves 2-variable Linear Programming problem with Simplex & 2D Graphical", () => {
    const problem: LpProblem = {
      objective: "max",
      objectiveCoefficients: [5, 4],
      constraints: [
        { coefficients: [6, 4], operator: "<=", rhs: 24 },
        { coefficients: [1, 2], operator: "<=", rhs: 6 },
        { coefficients: [-1, 1], operator: "<=", rhs: 1 },
        { coefficients: [0, 1], operator: "<=", rhs: 2 },
      ],
      variableNames: ["x1", "x2"],
    };

    const sol = solveLinearProgramming(problem);
    expect(sol.status).toBe("optimal");
    expect(sol.objectiveValue).toBe(21);
    expect(sol.variableValues.find((v) => v.name === "x1")?.value).toBe(3);
    expect(sol.variableValues.find((v) => v.name === "x2")?.value).toBe(1.5);
    expect(sol.graphical).toBeDefined();
    expect(sol.graphical?.optimalPoint).toEqual([3, 1.5]);
    expect(sol.tableaus.length).toBeGreaterThan(0);
  });

  // 2. Transportation Model (Vogel's VAM)
  it("solves Transportation Model via Vogel's Approximation Method", () => {
    const problem: TransportationProblem = {
      sources: ["Plant 1", "Plant 2", "Plant 3"],
      destinations: ["Market 1", "Market 2", "Market 3", "Market 4"],
      supply: [15, 25, 10],
      demand: [5, 15, 15, 15],
      costs: [
        [10, 2, 20, 11],
        [12, 7, 9, 20],
        [4, 14, 16, 18],
      ],
    };

    const sol = solveTransportation(problem);
    expect(sol.isBalanced).toBe(true);
    expect(sol.totalCost).toBeGreaterThan(0);
    expect(sol.allocations.length).toBe(3);
  });

  // 3. Hungarian Assignment Model
  it("solves Hungarian Assignment Model with optimal pairings", () => {
    const problem: AssignmentProblem = {
      workers: ["W1", "W2", "W3", "W4"],
      jobs: ["J1", "J2", "J3", "J4"],
      costs: [
        [1, 4, 6, 3],
        [9, 7, 10, 9],
        [4, 5, 11, 7],
        [8, 7, 8, 5],
      ],
    };

    const sol = solveHungarianAssignment(problem);
    expect(sol.assignments.length).toBe(4);
    expect(sol.totalCost).toBeGreaterThan(0);
    const assignedJobs = new Set(sol.assignments.map((a) => a.job));
    expect(assignedJobs.size).toBe(4); // All jobs distinct
  });

  // 4. Dijkstra Shortest Route (Rent Car Problem)
  it("solves Rent Car Shortest Route Problem from Node 1 to Node 5", () => {
    const edges: NetworkEdge[] = [
      { from: 1, to: 2, cost: 4000 },
      { from: 1, to: 3, cost: 5400 },
      { from: 1, to: 4, cost: 9800 },
      { from: 2, to: 3, cost: 4300 },
      { from: 2, to: 4, cost: 6200 },
      { from: 2, to: 5, cost: 8700 },
      { from: 3, to: 4, cost: 4800 },
      { from: 3, to: 5, cost: 7100 },
      { from: 4, to: 5, cost: 4900 },
    ];

    const sol = solveNetworkShortestRoute(edges, "1", "5");
    expect(sol.totalMetric).toBe(12500);
    expect(sol.pathString).toBe("1 -> 3 -> 5");
  });

  // 5. Minimum Spanning Tree (Midwest Cable Problem)
  it("solves Midwest Cable Minimum Spanning Tree Problem", () => {
    const edges: NetworkEdge[] = [
      { from: 1, to: 2, cost: 1 },
      { from: 1, to: 3, cost: 5 },
      { from: 1, to: 4, cost: 7 },
      { from: 1, to: 5, cost: 9 },
      { from: 2, to: 3, cost: 6 },
      { from: 2, to: 4, cost: 4 },
      { from: 2, to: 5, cost: 3 },
      { from: 3, to: 4, cost: 5 },
      { from: 3, to: 6, cost: 10 },
      { from: 4, to: 5, cost: 8 },
      { from: 4, to: 6, cost: 3 },
    ];

    const sol = solveNetworkMst(edges);
    expect(sol.totalMetric).toBe(16);
    expect(sol.selectedEdges.length).toBe(5);
  });

  // 6. Maximal Flow (Edmonds-Karp)
  it("solves Maximal Flow network capacity and Min-Cut partition", () => {
    const edges: NetworkEdge[] = [
      { from: 1, to: 2, cost: 10 },
      { from: 1, to: 3, cost: 5 },
      { from: 2, to: 3, cost: 15 },
      { from: 2, to: 4, cost: 10 },
      { from: 3, to: 4, cost: 10 },
    ];

    const sol = solveNetworkMaxFlow(edges, "1", "4");
    expect(sol.totalMetric).toBe(15);
    expect(sol.minCut?.cutCapacity).toBe(15);
    expect(sol.minCut?.sourceSet).toContain("1");
    expect(sol.flowBreakdown?.length).toBeGreaterThan(0);
  });
  // 7. CPM / PERT Project Planning
  it("computes Project Planning Critical Path and Durations", () => {
    const activities: CpmActivity[] = [
      { id: "A", name: "Site Prep", predecessors: [], duration: 2 },
      { id: "B", name: "Foundation", predecessors: ["A"], duration: 4 },
      { id: "C", name: "Framing", predecessors: ["B"], duration: 10 },
      { id: "D", name: "Roofing", predecessors: ["C"], duration: 6 },
      { id: "E", name: "Electrical", predecessors: ["C"], duration: 4 },
      { id: "F", name: "Plumbing", predecessors: ["C"], duration: 5 },
      { id: "G", name: "Finish", predecessors: ["D", "E", "F"], duration: 7 },
    ];

    const sol = solveCpmPert(activities);
    expect(sol.projectDuration).toBe(29);
    expect(sol.criticalPath).toEqual(["A", "B", "C", "D", "G"]);
  });

  // 8. Inventory Control EOQ Models
  it("calculates Classic EOQ and Cycle Times", () => {
    const problem: InventoryProblem = {
      model: "classic-eoq",
      annualDemandD: 1000,
      orderingCostK: 100,
      holdingCostH: 2,
      unitPriceC: 10,
    };

    const sol = solveInventoryControl(problem);
    expect(sol.optimalOrderQtyY).toBe(316); // sqrt(2*100*1000/2) = 316.22
    expect(sol.annualHoldingCost).toBeCloseTo(316.22, 0);
    expect(sol.annualOrderingCost).toBeCloseTo(316.22, 0);
  });

  // 9. Queuing Analysis (M/M/1)
  it("calculates steady-state M/M/1 queuing metrics", () => {
    const problem: QueuingProblem = {
      model: "M/M/1",
      arrivalRateLambda: 2,
      serviceRateMu: 3,
      serversCountC: 1,
    };

    const sol = solveQueuing(problem);
    expect(sol.utilizationRho).toBe(0.667);
    expect(sol.avgInQueueLq).toBe(1.333);
    expect(sol.avgInSystemLs).toBe(2);
  });

  // 10. Zero-Sum Game Theory
  it("identifies Minimax/Maximin saddle points", () => {
    const problem: ZeroSumGameProblem = {
      player1Strategies: ["A1", "A2", "A3"],
      player2Strategies: ["B1", "B2", "B3", "B4"],
      payoffMatrix: [
        [3, -1, 4, 2],
        [-1, -3, -7, 0],
        [4, 0, 6, 3],
      ],
    };

    const sol = solveZeroSumGame(problem);
    expect(sol.hasSaddlePoint).toBe(true);
    expect(sol.gameValue).toBe(0);
    expect(sol.saddlePoint).toEqual({ row: 2, col: 1, value: 0 });
  });

  // 11. Linear Equations (Gauss-Jordan)
  it("solves simultaneous linear systems Ax = b", () => {
    const A = [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ];
    const b = [8, -11, -3];

    const sol = solveLinearEquations(A, b);
    expect(sol).toEqual([2, 3, -1]);
  });

  // 12. Edge Case: Disconnected graph in Dijkstra
  it("handles disconnected nodes gracefully in Dijkstra", () => {
    const edges: NetworkEdge[] = [
      { from: 1, to: 2, cost: 5 },
      { from: 3, to: 4, cost: 5 },
    ];
    const sol = solveNetworkShortestRoute(edges, "1", "4");
    expect(sol.pathString).toBe("No route exists between selected nodes");
    expect(sol.totalMetric).toBe(0);
  });

  // 13. Edge Case: Non-square Hungarian Assignment
  it("handles non-square matrices in Hungarian Assignment", () => {
    const problem: AssignmentProblem = {
      workers: ["W1", "W2"],
      jobs: ["J1", "J2", "J3"],
      costs: [
        [10, 5, 20],
        [15, 12, 8],
      ],
    };
    const sol = solveHungarianAssignment(problem);
    expect(sol.assignments.length).toBe(2);
    expect(sol.totalCost).toBeLessThanOrEqual(20);
  });

  // 14. Real-world 11-Station MST (Trans-Continental Data Grid Corporation)
  it("solves 11-station TCDG Minimum Spanning Tree problem with float weights", () => {
    const edges: NetworkEdge[] = [
      { from: "S1", to: "S2", cost: 24.6 },
      { from: "S1", to: "S3", cost: 31.2 },
      { from: "S1", to: "S4", cost: 19.8 },
      { from: "S2", to: "S3", cost: 14.5 },
      { from: "S2", to: "S5", cost: 27.9 },
      { from: "S2", to: "S6", cost: 33.4 },
      { from: "S3", to: "S4", cost: 22.1 },
      { from: "S3", to: "S6", cost: 18.7 },
      { from: "S3", to: "S7", cost: 29.3 },
      { from: "S4", to: "S7", cost: 26.5 },
      { from: "S4", to: "S8", cost: 35.9 },
      { from: "S5", to: "S6", cost: 12.8 },
      { from: "S5", to: "S9", cost: 21.4 },
      { from: "S6", to: "S7", cost: 16.3 },
      { from: "S6", to: "S9", cost: 23.7 },
      { from: "S6", to: "S10", cost: 30.6 },
      { from: "S7", to: "S8", cost: 20.2 },
      { from: "S7", to: "S10", cost: 17.9 },
      { from: "S8", to: "S10", cost: 28.4 },
      { from: "S8", to: "S11", cost: 25.1 },
      { from: "S9", to: "S10", cost: 15.6 },
      { from: "S9", to: "S11", cost: 34.8 },
      { from: "S10", to: "S11", cost: 13.9 },
    ];

    const sol = solveNetworkMst(edges);
    expect(sol.totalMetric).toBe(171.8);
    expect(sol.selectedEdges.length).toBe(10);
  });

  // 15. Large-scale 25-Station 100-Edge MST (GlobalSat Communications)
  it("solves 25-station 100-edge GlobalSat Minimum Spanning Tree problem", () => {
    const text = `N1-N2: 60.7\nN1-N6: 42.7\nN1-N8: 57.5\nN1-N13: 52.1\nN1-N16: 89.1\nN1-N19: 23.4\nN2-N3: 69.5\nN2-N4: 26.5\nN2-N6: 40.6\nN2-N9: 65.5\nN2-N13: 32.0\nN2-N15: 33.5\nN2-N19: 72.7\nN2-N22: 11.5\nN2-N23: 46.2\nN3-N4: 94.9\nN3-N8: 94.6\nN3-N10: 11.6\nN3-N13: 24.2\nN3-N14: 28.9\nN3-N16: 89.0\nN3-N18: 84.3\nN3-N25: 84.1\nN4-N8: 38.3\nN4-N10: 19.2\nN4-N13: 80.0\nN4-N20: 68.3\nN4-N22: 60.1\nN4-N23: 93.9\nN5-N13: 63.9\nN5-N14: 5.7\nN5-N15: 78.5\nN5-N17: 31.9\nN5-N20: 64.7\nN6-N10: 89.5\nN6-N12: 17.1\nN6-N25: 15.4\nN7-N8: 14.6\nN7-N10: 54.8\nN7-N13: 29.5\nN7-N15: 59.4\nN7-N17: 69.6\nN7-N20: 23.3\nN7-N21: 62.1\nN7-N22: 28.8\nN7-N23: 49.0\nN8-N12: 86.5\nN8-N20: 81.1\nN8-N24: 13.3\nN9-N14: 43.1\nN9-N20: 29.9\nN9-N21: 5.3\nN9-N22: 74.4\nN9-N23: 62.3\nN9-N25: 28.6\nN10-N11: 71.7\nN10-N13: 54.7\nN10-N17: 43.5\nN10-N20: 5.9\nN10-N21: 11.8\nN10-N22: 84.5\nN10-N23: 86.4\nN11-N12: 54.1\nN11-N13: 80.1\nN11-N15: 57.4\nN11-N17: 18.3\nN11-N18: 16.5\nN11-N20: 32.7\nN11-N21: 85.9\nN11-N23: 76.7\nN12-N13: 82.5\nN12-N15: 85.9\nN12-N17: 23.9\nN12-N20: 27.5\nN13-N15: 14.3\nN13-N16: 75.2\nN13-N17: 84.6\nN13-N18: 41.6\nN13-N21: 60.9\nN13-N24: 18.9\nN14-N15: 88.7\nN14-N21: 82.8\nN14-N23: 92.9\nN15-N18: 78.0\nN15-N19: 84.3\nN16-N20: 7.2\nN16-N21: 71.3\nN16-N24: 34.9\nN16-N25: 88.8\nN17-N19: 77.2\nN17-N20: 82.8\nN17-N21: 78.0\nN17-N23: 29.0\nN17-N25: 75.9\nN19-N20: 14.7\nN21-N24: 83.5\nN21-N25: 82.3\nN22-N25: 25.0\nN23-N24: 78.5\nN23-N25: 46.4`;
    const edgeRegex = /(?:node\s*|station\s*)?([A-Za-z0-9]+)\s*(?:->|–|—|-|to|,|\t)\s*(?:node\s*|station\s*)?([A-Za-z0-9]+)\s*(?::|=|\$|cost|weight|\s+)\s*([0-9,.]+)/gi;
    let match;
    const edges: NetworkEdge[] = [];
    while ((match = edgeRegex.exec(text)) !== null) {
      const from = match[1];
      const to = match[2];
      const cost = parseFloat(match[3].replace(/,/g, ""));
      if (from !== to && !isNaN(cost)) {
        edges.push({ from, to, cost });
      }
    }

    expect(edges.length).toBe(100);
    const sol = solveNetworkMst(edges);
    expect(sol.totalMetric).toBe(401.3);
    expect(sol.selectedEdges.length).toBe(24);
  });

  // 16. Quantity Discount Multi-Price Break EOQ Model
  it("solves Multi-Price Break Quantity Discount EOQ", () => {
    const problem: InventoryProblem = {
      model: "quantity-discounts",
      annualDemandD: 10000,
      orderingCostK: 50,
      holdingCostH: 2,
      unitPriceC: 10,
      priceBreaks: [
        { tierIndex: 1, minQty: 0, maxQty: 999, unitPrice: 10.0, holdingCostH: 2.0 },
        { tierIndex: 2, minQty: 1000, maxQty: 1999, unitPrice: 9.5, holdingCostH: 1.9 },
        { tierIndex: 3, minQty: 2000, unitPrice: 9.0, holdingCostH: 1.8 },
      ],
    };

    const sol = solveInventoryControl(problem);
    expect(sol.selectedPriceBreakTier).toBeDefined();
    expect(sol.totalAnnualCost).toBeLessThan(100000);
    expect(sol.priceBreakAnalysis?.length).toBe(3);
  });

  // 17. Finite Capacity Queuing Model (M/M/1/K)
  it("solves M/M/1/K Finite Capacity Queuing with blocking probability", () => {
    const problem: QueuingProblem = {
      model: "M/M/1",
      arrivalRateLambda: 3,
      serviceRateMu: 4,
      systemCapacityK: 5,
    };

    const sol = solveQueuing(problem);
    expect(sol.blockingProbabilityPk).toBeDefined();
    expect(sol.blockingProbabilityPk).toBeGreaterThan(0);
    expect(sol.effectiveArrivalRate).toBeLessThan(3);
    expect(sol.avgInSystemLs).toBeGreaterThan(0);
  });
});
