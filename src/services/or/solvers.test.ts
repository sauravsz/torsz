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
  it("solves Maximal Flow network capacity", () => {
    const edges: NetworkEdge[] = [
      { from: 1, to: 2, cost: 10 },
      { from: 1, to: 3, cost: 5 },
      { from: 2, to: 3, cost: 15 },
      { from: 2, to: 4, cost: 10 },
      { from: 3, to: 4, cost: 10 },
    ];

    const sol = solveNetworkMaxFlow(edges, "1", "4");
    expect(sol.totalMetric).toBe(15);
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
});
