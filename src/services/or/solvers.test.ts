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
import {
  extractTransportationProblem,
  extractAssignmentProblem,
} from "../ocrMatrixParser";

describe("TORA Operations Research Multi-Scenario Test Suite", () => {
  // 1. Linear Programming (2D Graphical & Simplex)
  it("solves standard 2-variable maximization LP", () => {
    const lp: LpProblem = {
      objective: "max",
      objectiveCoefficients: [3, 5],
      constraints: [
        { coefficients: [1, 0], operator: "<=", rhs: 4 },
        { coefficients: [0, 2], operator: "<=", rhs: 12 },
        { coefficients: [3, 2], operator: "<=", rhs: 18 },
      ],
    };
    const sol = solveLinearProgramming(lp);
    expect(sol.status).toBe("optimal");
    expect(sol.objectiveValue).toBe(36); // x1=2, x2=6 -> 3(2)+5(6)=36
  });

  it("solves minimization LP with >= constraints", () => {
    const lp: LpProblem = {
      objective: "min",
      objectiveCoefficients: [4, 2],
      constraints: [
        { coefficients: [3, 1], operator: ">=", rhs: 27 },
        { coefficients: [1, 1], operator: ">=", rhs: 21 },
        { coefficients: [1, 2], operator: ">=", rhs: 30 },
      ],
    };
    const sol = solveLinearProgramming(lp);
    expect(sol.status).toBe("optimal");
    expect(sol.objectiveValue).toBeLessThanOrEqual(50);
  });
  it("solves 9-variable Weighted Moving Average MAD Error Minimization Goal Programming LP", () => {
    const lp: LpProblem = {
      objective: "min",
      objectiveCoefficients: [0, 0, 0, 1, 1, 1, 1, 1, 1],
      variableNames: ["w1", "w2", "w3", "e4+", "e4-", "e5+", "e5-", "e6+", "e6-"],
      constraints: [
        { coefficients: [270, 241, 331, -1, 1, 0, 0, 0, 0], operator: "=", rhs: 299 },
        { coefficients: [241, 331, 299, 0, 0, -1, 1, 0, 0], operator: "=", rhs: 360 },
        { coefficients: [331, 299, 360, 0, 0, 0, 0, -1, 1], operator: "=", rhs: 340 },
        { coefficients: [1, 1, 1, 0, 0, 0, 0, 0, 0], operator: "=", rhs: 1 },
        { coefficients: [0, -1, 1, 0, 0, 0, 0, 0, 0], operator: ">=", rhs: 0 },
        { coefficients: [-1, 1, 0, 0, 0, 0, 0, 0, 0], operator: ">=", rhs: 0 },
      ],
    };
    const sol = solveLinearProgramming(lp);
    expect(sol.status).toBe("optimal");
    expect(sol.objectiveValue).toBeCloseTo(51.311, 1);
    const w1Val = sol.variableValues.find(v => v.name === "w1")?.value || 0;
    const w2Val = sol.variableValues.find(v => v.name === "w2")?.value || 0;
    const w3Val = sol.variableValues.find(v => v.name === "w3")?.value || 0;
    expect(w1Val).toBeCloseTo(0, 2);
    expect(w2Val).toBeCloseTo(0.356, 2);
    expect(w3Val).toBeCloseTo(0.644, 2);
  });
  it("detects unbounded feasible region in Simplex method", () => {
    const lp: LpProblem = {
      objective: "max",
      objectiveCoefficients: [2, 1],
      constraints: [
        { coefficients: [1, -1], operator: "<=", rhs: 10 },
        { coefficients: [2, 0], operator: "<=", rhs: 40 },
      ],
    };
    const sol = solveLinearProgramming(lp);
    expect(sol.status).toBe("unbounded");
    expect(sol.objectiveValue).toBe(Infinity);
  });

  // 2. Transportation Model (Vogel's VAM)
  it("solves balanced 3x4 transportation matrix with VAM", () => {
    const trans: TransportationProblem = {
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
    const sol = solveTransportation(trans);
    expect(sol.isBalanced).toBe(true);
    expect(sol.totalCost).toBe(475); // VAM total cost
  });

  it("solves unbalanced transportation problem (excess supply)", () => {
    const trans: TransportationProblem = {
      sources: ["Plant A", "Plant B"],
      destinations: ["City 1", "City 2"],
      supply: [60, 40],
      demand: [50, 30], // Total supply = 100, Demand = 80
      costs: [
        [5, 8],
        [4, 7],
      ],
    };
    const sol = solveTransportation(trans);
    expect(sol.isBalanced).toBe(false);
    expect(sol.dummyAdded).toBe("demand");
    expect(sol.totalCost).toBeGreaterThan(0);
  });

  it("extracts and parses markdown transportation tables", () => {
    const mdTable = `
| Source | Dest 1 | Dest 2 | Supply |
| Plant 1 | 8 | 6 | 50 |
| Plant 2 | 4 | 7 | 40 |
| Demand | 60 | 30 | |
`;
    const parsed = extractTransportationProblem(mdTable);
    expect(parsed).not.toBeNull();
    expect(parsed?.sources.length).toBe(2);
    expect(parsed?.destinations.length).toBe(2);
    expect(parsed?.supply).toEqual([50, 40]);
    expect(parsed?.demand).toEqual([60, 30]);
  });

  // 3. Hungarian Assignment Model
  it("solves 4x4 minimum cost worker assignment", () => {
    const assign: AssignmentProblem = {
      workers: ["W1", "W2", "W3", "W4"],
      jobs: ["J1", "J2", "J3", "J4"],
      costs: [
        [9, 2, 7, 8],
        [6, 4, 3, 7],
        [5, 8, 1, 8],
        [7, 6, 9, 4],
      ],
    };
    const sol = solveHungarianAssignment(assign);
    expect(sol.totalCost).toBe(13); // W1->J2(2), W2->J1(6), W3->J3(1), W4->J4(4) = 13
    expect(sol.assignments.length).toBe(4);
  });

  it("extracts markdown assignment tables", () => {
    const table = `
| Worker | Job 1 | Job 2 | Job 3 |
| Alice | 10 | 15 | 20 |
| Bob | 12 | 8 | 14 |
| Charlie | 9 | 12 | 11 |
`;
    const parsed = extractAssignmentProblem(table);
    expect(parsed).not.toBeNull();
    expect(parsed?.workers).toEqual(["Alice", "Bob", "Charlie"]);
    expect(parsed?.jobs).toEqual(["Job 1", "Job 2", "Job 3"]);
  });

  // 4. Network Models (Dijkstra, Kruskal MST, Edmonds-Karp)
  it("solves Shortest Route (Dijkstra)", () => {
    const edges: NetworkEdge[] = [
      { from: "1", to: "2", cost: 100 },
      { from: "1", to: "3", cost: 30 },
      { from: "2", to: "4", cost: 20 },
      { from: "3", to: "2", cost: 40 },
      { from: "3", to: "4", cost: 60 },
    ];
    const sol = solveNetworkShortestRoute(edges, "1", "4");
    expect(sol.totalMetric).toBe(90); // 1 -> 3 (30) -> 2 (40) -> 4 (20) = 90
  });

  it("solves Minimum Spanning Tree (Kruskal MST)", () => {
    const edges: NetworkEdge[] = [
      { from: "1", to: "2", cost: 4 },
      { from: "1", to: "3", cost: 2 },
      { from: "2", to: "3", cost: 1 },
      { from: "2", to: "4", cost: 5 },
      { from: "3", to: "4", cost: 8 },
      { from: "3", to: "5", cost: 10 },
      { from: "4", to: "5", cost: 2 },
    ];
    const sol = solveNetworkMst(edges);
    expect(sol.totalMetric).toBe(10); // 2-3 (1) + 1-3 (2) + 4-5 (2) + 2-4 (5) = 10
    expect(sol.selectedEdges.length).toBe(4);
  });

  it("solves Maximal Flow with Edmonds-Karp and Min-Cut", () => {
    const edges: NetworkEdge[] = [
      { from: "s", to: "a", cost: 10 },
      { from: "s", to: "b", cost: 5 },
      { from: "a", to: "b", cost: 15 },
      { from: "a", to: "t", cost: 10 },
      { from: "b", to: "t", cost: 10 },
    ];
    const sol = solveNetworkMaxFlow(edges, "s", "t");
    expect(sol.totalMetric).toBe(15);
    expect(sol.minCut?.cutCapacity).toBe(15);
  });

  // 5. CPM / PERT Project Planning
  it("computes CPM Critical Path and Slacks", () => {
    const activities: CpmActivity[] = [
      { id: "A", name: "Design", predecessors: [], duration: 5 },
      { id: "B", name: "Prototype", predecessors: ["A"], duration: 3 },
      { id: "C", name: "Test", predecessors: ["A"], duration: 7 },
      { id: "D", name: "Deploy", predecessors: ["B", "C"], duration: 2 },
    ];
    const sol = solveCpmPert(activities);
    expect(sol.projectDuration).toBe(14); // A(5) + C(7) + D(2) = 14
    expect(sol.criticalPath).toContain("A");
    expect(sol.criticalPath).toContain("C");
    expect(sol.criticalPath).toContain("D");
  });

  // 6. Inventory Control (EOQ)
  it("solves Classic EOQ", () => {
    const inv: InventoryProblem = {
      model: "classic-eoq",
      annualDemandD: 1000,
      orderingCostK: 100,
      holdingCostH: 2,
      unitPriceC: 50,
    };
    const sol = solveInventoryControl(inv);
    expect(sol.optimalOrderQtyY).toBe(316); // sqrt(200000/2) = 316.22
    expect(sol.totalAnnualCost).toBeGreaterThan(50000);
  });

  it("solves EOQ with Quantity Discounts", () => {
    const inv: InventoryProblem = {
      model: "quantity-discounts",
      annualDemandD: 5000,
      orderingCostK: 49,
      holdingCostH: 0.2, // 20%
      unitPriceC: 5,
      priceBreaks: [
        { minQty: 1, maxQty: 999, unitPrice: 5.0 },
        { minQty: 1000, maxQty: 1999, unitPrice: 4.8 },
        { minQty: 2000, unitPrice: 4.5 },
      ],
    };
    const sol = solveInventoryControl(inv);
    expect(sol.selectedPriceBreakTier).toBeDefined();
    expect(sol.optimalOrderQtyY).toBeGreaterThanOrEqual(1000);
  });

  // 7. Queuing Analysis (M/M/1 & M/M/c/K)
  it("solves single-server M/M/1 queue", () => {
    const queue: QueuingProblem = {
      model: "M/M/1",
      serversCountC: 1,
      arrivalRateLambda: 3,
      serviceRateMu: 5,
    };
    const sol = solveQueuing(queue);
    expect(sol.utilizationRho).toBe(0.6); // 3/5 = 0.6
    expect(sol.avgInSystemLs).toBe(1.5); // 3/(5-3) = 1.5
    expect(sol.probZeroP0).toBe(0.4); // 1 - 0.6 = 0.4
  });

  it("solves finite capacity M/M/1/K queue", () => {
    const queue: QueuingProblem = {
      model: "M/M/1",
      serversCountC: 1,
      arrivalRateLambda: 4,
      serviceRateMu: 5,
      systemCapacityK: 3,
    };
    const sol = solveQueuing(queue);
    expect(sol.blockingProbabilityPk).toBeDefined();
    expect(sol.effectiveArrivalRate).toBeLessThanOrEqual(4);
  });

  // 8. Zero-Sum Games (Payoff Matrix)
  it("detects saddle point in matrix game", () => {
    const game: ZeroSumGameProblem = {
      player1Strategies: ["A1", "A2", "A3"],
      player2Strategies: ["B1", "B2", "B3"],
      payoffMatrix: [
        [1, 2, 4],
        [2, 3, 5],
        [0, 1, 3],
      ],
    };
    const sol = solveZeroSumGame(game);
    expect(sol.hasSaddlePoint).toBe(true);
    expect(sol.gameValue).toBe(2);
  });

  // 9. Linear Equations (Gauss-Jordan)
  it("solves 3x3 simultaneous linear equations Ax = b", () => {
    const A = [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ];
    const b = [8, -11, -3];
    const x = solveLinearEquations(A, b);
    expect(x).toEqual([2, 3, -1]); // 2(2)+3-(-1)=8, -3(2)-3+2(-1)=-11, -2(2)+3+2(-1)=-3
  });
});
