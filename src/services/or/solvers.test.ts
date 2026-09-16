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
  extractLinearProgramming,
  extractCpmActivities,
  extractInventoryProblem,
  extractQueuingProblem,
  extractZeroSumGame,
  extractLinearEquations,
} from "../orTextParsers";
import {
  extractTransportationProblem,
  extractAssignmentProblem,
} from "../ocrMatrixParser";
import { extractNetworkEdges, classifyOrProblemFromText } from "../ocr";
import { BENCHMARKS } from "../orBenchmarks";

describe("TORA Operations Research Multi-Scenario & Textbook Benchmark Suite", () => {
  // ==========================================================================
  // 1. LINEAR PROGRAMMING (Simplex, 2D Graphical, Shadow Prices, NLP & Tables)
  // ==========================================================================
  describe("Linear Programming", () => {
    it("solves Reddy Mikks standard 2-variable maximization LP (Taha)", () => {
      const benchmark = BENCHMARKS.lp.find((b) => b.id === "taha-reddy-mikks")!;
      const sol = solveLinearProgramming(benchmark.data);
      expect(sol.status).toBe("optimal");
      expect(sol.objectiveValue).toBe(21);
      const x1 = sol.variableValues.find((v) => v.name.includes("x1"))?.value || 0;
      const x2 = sol.variableValues.find((v) => v.name.includes("x2"))?.value || 0;
      expect(x1).toBe(3);
      expect(x2).toBe(1.5);
      expect(sol.graphical).toBeDefined();
      expect(sol.dualPrices).toBeDefined();
      expect(sol.dualPrices?.length).toBe(4);
    });

    it("solves Wyndor Glass Co. 2-variable product mix (Hillier & Lieberman)", () => {
      const benchmark = BENCHMARKS.lp.find((b) => b.id === "hillier-wyndor-glass")!;
      const sol = solveLinearProgramming(benchmark.data);
      expect(sol.status).toBe("optimal");
      expect(sol.objectiveValue).toBe(36);
      const x1 = sol.variableValues.find((v) => v.name.includes("x1"))?.value || 0;
      const x2 = sol.variableValues.find((v) => v.name.includes("x2"))?.value || 0;
      expect(x1).toBe(2);
      expect(x2).toBe(6);
    });

    it("solves Stigler nutrition minimization LP with >= constraints (Taha)", () => {
      const benchmark = BENCHMARKS.lp.find((b) => b.id === "taha-stigler-diet")!;
      const sol = solveLinearProgramming(benchmark.data);
      expect(sol.status).toBe("optimal");
      expect(sol.objectiveValue).toBe(48);
      const x1 = sol.variableValues.find((v) => v.name.includes("x1"))?.value || 0;
      const x2 = sol.variableValues.find((v) => v.name.includes("x2"))?.value || 0;
      expect(x1).toBe(3);
      expect(x2).toBe(18);
    });

    it("solves 9-variable Weighted Moving Average MAD Error Minimization Goal Programming LP (Balakrishnan)", () => {
      const benchmark = BENCHMARKS.lp.find((b) => b.id === "wma-goal-programming")!;
      const sol = solveLinearProgramming(benchmark.data);
      expect(sol.status).toBe("optimal");
      expect(sol.objectiveValue).toBeCloseTo(51.311, 1);
      const w1Val = sol.variableValues.find((v) => v.name === "w1")?.value || 0;
      const w2Val = sol.variableValues.find((v) => v.name === "w2")?.value || 0;
      const w3Val = sol.variableValues.find((v) => v.name === "w3")?.value || 0;
      expect(w1Val).toBeCloseTo(0, 2);
      expect(w2Val).toBeCloseTo(0.356, 2);
      expect(w3Val).toBeCloseTo(0.644, 2);
    });

    it("extracts and solves narrative NLP word problems (Flair Furniture - Balakrishnan)", () => {
      const text = `
        A company manufactures two products: tables and chairs.
        Each table requires 4 hours of carpentry and 2 hours of painting.
        Each chair requires 3 hours of carpentry and 1 hour of painting.
        Total carpentry hours available is 240, and painting hours available is 100.
        Profit per table is $70 and profit per chair is $50.
        Formulate and solve to maximize total profit.
      `;
      const lp = extractLinearProgramming(text);
      expect(lp).not.toBeNull();
      expect(lp?.objective).toBe("max");
      expect(lp?.objectiveCoefficients.length).toBe(2);
      expect(lp?.constraints.length).toBe(2);

      const sol = solveLinearProgramming(lp!);
      expect(sol.status).toBe("optimal");
      expect(sol.objectiveValue).toBe(4100);
      const tables = sol.variableValues.find((v) => v.name.toLowerCase().includes("table"))?.value || 0;
      const chairs = sol.variableValues.find((v) => v.name.toLowerCase().includes("chair"))?.value || 0;
      expect(tables).toBe(30);
      expect(chairs).toBe(40);
    });

    it("extracts and solves tabular LP markdown tables", () => {
      const tableText = `
        | Department | Tables | Chairs | Available Capacity |
        | Carpentry  | 4      | 3      | 240                |
        | Painting   | 2      | 1      | 100                |
        | Profit ($) | 70     | 50     |                    |
      `;
      const lp = extractLinearProgramming(tableText);
      expect(lp).not.toBeNull();
      const sol = solveLinearProgramming(lp!);
      expect(sol.status).toBe("optimal");
      expect(sol.objectiveValue).toBe(4100);
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
    });
  });

  // ==========================================================================
  // 2. TRANSPORTATION MODEL (Vogel's VAM & Balanced/Unbalanced)
  // ==========================================================================
  describe("Transportation Models", () => {
    it("solves MG Auto 3x4 balanced transportation with VAM (Taha)", () => {
      const benchmark = BENCHMARKS.trans.find((b) => b.id === "taha-mg-auto")!;
      const sol = solveTransportation(benchmark.data);
      expect(sol.isBalanced).toBe(true);
      expect(sol.totalCost).toBeLessThanOrEqual(475);
      expect(sol.allocations.length).toBe(3);
      expect(sol.allocations[0].length).toBe(4);
    });

    it("solves Foster Generators regional distribution (Balakrishnan)", () => {
      const benchmark = BENCHMARKS.trans.find((b) => b.id === "balakrishnan-foster-generators")!;
      const sol = solveTransportation(benchmark.data);
      expect(sol.isBalanced).toBe(true);
      expect(sol.totalCost).toBe(39500);
    });

    it("solves unbalanced transportation problem with dummy market (Meridian)", () => {
      const benchmark = BENCHMARKS.trans.find((b) => b.id === "meridian-unbalanced")!;
      const sol = solveTransportation(benchmark.data);
      expect(sol.isBalanced).toBe(false);
      expect(sol.dummyAdded).toBe("demand");
      expect(sol.allocations.length).toBe(3);
      expect(sol.allocations[0].length).toBe(5); // 4 original + 1 dummy
    });

    it("extracts and parses markdown transportation tables with supply and demand", () => {
      const mdTable = `
| Plant \\ Market | Market 1 | Market 2 | Market 3 | Supply |
| Plant 1 | 10 | 2 | 20 | 15 |
| Plant 2 | 12 | 7 | 9 | 25 |
| Demand | 5 | 15 | 20 | |
      `;
      const trans = extractTransportationProblem(mdTable);
      expect(trans).not.toBeNull();
      expect(trans?.sources).toEqual(["Plant 1", "Plant 2"]);
      expect(trans?.destinations).toEqual(["Market 1", "Market 2", "Market 3"]);
      expect(trans?.supply).toEqual([15, 25]);
      expect(trans?.demand).toEqual([5, 15, 20]);
    });
  });

  // ==========================================================================
  // 3. HUNGARIAN ASSIGNMENT MODEL
  // ==========================================================================
  describe("Hungarian Assignment", () => {
    it("solves 4x4 minimum cost worker-to-machine matching (Taha)", () => {
      const benchmark = BENCHMARKS.assign.find((b) => b.id === "taha-job-matching")!;
      const sol = solveHungarianAssignment(benchmark.data);
      expect(sol.assignments.length).toBe(4);
      expect(sol.totalCost).toBe(21);
    });

    it("solves Facility Maintenance Crew Assignment (Balakrishnan)", () => {
      const benchmark = BENCHMARKS.assign.find((b) => b.id === "balakrishnan-crew-assignment")!;
      const sol = solveHungarianAssignment(benchmark.data);
      expect(sol.assignments.length).toBe(4);
      expect(sol.totalCost).toBe(275);
    });

    it("extracts markdown assignment tables", () => {
      const md = `
| Worker | Job 1 | Job 2 | Job 3 |
| W1 | 9 | 2 | 7 |
| W2 | 6 | 4 | 3 |
| W3 | 5 | 8 | 1 |
      `;
      const assign = extractAssignmentProblem(md);
      expect(assign).not.toBeNull();
      expect(assign?.workers.length).toBe(3);
      expect(assign?.jobs.length).toBe(3);
      expect(assign?.costs[0]).toEqual([9, 2, 7]);
    });
  });

  // ==========================================================================
  // 4. NETWORK MODELS (Dijkstra, Kruskal MST, Edmonds-Karp Max-Flow)
  // ==========================================================================
  describe("Network Models", () => {
    it("solves Equipment Replacement via Shortest Route Dijkstra (Taha)", () => {
      const benchmark = BENCHMARKS.network.find((b) => b.id === "taha-rent-car")!;
      const sol = solveNetworkShortestRoute(benchmark.data.edges, "1", "5");
      expect(sol.totalMetric).toBe(12500);
      expect(sol.pathString).toContain("1 → 3 → 5");
    });

    it("solves Regional Cable Minimum Spanning Tree via Kruskal (Hillier & Lieberman)", () => {
      const benchmark = BENCHMARKS.network.find((b) => b.id === "hillier-cable-mst")!;
      const sol = solveNetworkMst(benchmark.data.edges);
      expect(sol.totalMetric).toBe(11);
      expect(sol.selectedEdges.length).toBe(4);
    });

    it("solves Trans-Continental Pipeline Maximal Flow with Edmonds-Karp (Taha)", () => {
      const benchmark = BENCHMARKS.network.find((b) => b.id === "taha-oil-maxflow")!;
      const sol = solveNetworkMaxFlow(benchmark.data.edges, "1", "5");
      expect(sol.totalMetric).toBe(45);
      expect(sol.minCut).toBeDefined();
      expect(sol.minCut?.cutCapacity).toBe(45);
    });

    it("extracts network edges from edge-list table and solves Smart commute most reliable route (Taha)", () => {
      const text = `
Since torsz's OCR/classifier expects a solvable model, here's the question reframed for its **Shortest Route (Dijkstra)** solver — the "most reliable route" trick is converting each probability to a distance via −log₁₀(p), so minimizing total distance = maximizing the product of probabilities.

**Problem statement**
Smart drives daily to work. Having just completed a course in network analysis, Smart is able to determine the shortest route to work. Unfortunately, the selected route is heavily patrolled by police, and w/ all the fines paid for speeding, the shortest route may not be the best choice. Smart has thus decided to choose a route that maximises the probability of not being stopped by police.

**Network — Source: Node 1, Sink: Node 7**

| From | To | Probability | Distance (−log₁₀ p) |
|---|---|---|---|
| 1 | 2 | 0.2 | 0.69897 |
| 1 | 3 | 0.9 | 0.04576 |
| 2 | 3 | 0.6 | 0.2185 |
| 2 | 4 | 0.8 | 0.09691 |
| 3 | 4 | 0.1 | 1 |
| 3 | 5 | 0.3 | 0.5288 |
| 4 | 5 | 0.4 | 0.39794 |
| 4 | 6 | 0.35 | 0.45593 |
| 5 | 7 | 0.25 | 0.60206 |
| 6 | 7 | 0.5 | 0.30103 |

**Objective:** minimize total distance from Node 1 to Node 7 — this identifies the route with the highest overall probability of not being stopped by police.
      `;
      const { edges, startNode, endNode } = extractNetworkEdges(text);
      expect(edges.length).toBe(10);
      expect(startNode).toBe("1");
      expect(endNode).toBe("7");

      const sol = solveNetworkShortestRoute(edges, startNode, endNode);
      expect(sol.pathString).toBe("1 → 3 → 5 → 7");
      expect(sol.totalMetric).toBeCloseTo(1.17662, 4);
    });
    it("extracts and solves Three-Jug / Juggling Jugs puzzle as shortest route model (Taha)", () => {
      const text = `
        Three-Jug Puzzle (Juggling Jugs Problem):
        An 8-gallon jug is filled with fluid. Given two empty 5- and 3-gallon jugs, divide the 8 gallons
        of fluid into two equal parts using only the three jugs. What is the smallest number of transfers
        (decantations) needed to achieve this result?
      `;
      const { edges, startNode, endNode } = extractNetworkEdges(text);
      expect(edges.length).toBeGreaterThan(20);
      expect(startNode).toBe("(8,0,0)");
      expect(endNode).toBe("(4,4,0)");

      const sol = solveNetworkShortestRoute(edges, startNode, endNode);
      expect(sol.totalMetric).toBe(7);
      expect(sol.pathString).toBe("(8,0,0) → (3,5,0) → (3,2,3) → (6,2,0) → (6,0,2) → (1,5,2) → (1,4,3) → (4,4,0)");
    });

    it("extracts network edges from tuple list and arrow statements", () => {
      const text = `
        Network flow problem:
        (1, 2, 20), (1, 3, 30), (2, 3, 10), (2, 4, 15), (3, 4, 10), (3, 5, 20), (4, 5, 25).
        Find maximal flow from node 1 to node 5.
      `;
      const { edges, startNode, endNode } = extractNetworkEdges(text);
      expect(edges.length).toBe(7);
      expect(startNode).toBe("1");
      expect(endNode).toBe("5");
    });
  });

  // ==========================================================================
  // 5. CPM / PERT PROJECT PLANNING & CRASHING
  // ==========================================================================
  describe("Project Planning (CPM / PERT)", () => {
    it("computes CPM Critical Path and Slacks for General Foundry (Balakrishnan)", () => {
      const benchmark = BENCHMARKS.cpm.find((b) => b.id === "balakrishnan-general-foundry")!;
      const sol = solveCpmPert(benchmark.data);
      expect(sol.projectDuration).toBe(16);
      expect(sol.criticalPath).toEqual(["A", "B", "D", "G", "H"]);
      expect(sol.projectVariance).toBeGreaterThan(0);
      expect(sol.projectStdDev).toBeGreaterThan(0);
    });

    it("extracts CPM activities from text and markdown tables", () => {
      const cpmText = `
| Activity | Predecessors | Duration |
| A | None | 3 |
| B | None | 4 |
| C | A | 2 |
| D | B | 5 |
| E | C, D | 3 |
      `;
      const activities = extractCpmActivities(cpmText);
      expect(activities).not.toBeNull();
      expect(activities?.length).toBe(5);

      const sol = solveCpmPert(activities!);
      expect(sol.projectDuration).toBe(12); // B(4) -> D(5) -> E(3) = 12
      expect(sol.criticalPath).toEqual(["B", "D", "E"]);
    });
  });

  // ==========================================================================
  // 6. INVENTORY CONTROL (Classic EOQ, Backorders, EPQ, Quantity Discounts)
  // ==========================================================================
  describe("Inventory Control", () => {
    it("solves Classic Wilson EOQ (Taha)", () => {
      const benchmark = BENCHMARKS.inventory.find((b) => b.id === "taha-classic-eoq")!;
      const sol = solveInventoryControl(benchmark.data);
      expect(sol.optimalOrderQtyY).toBe(316);
      expect(sol.totalAnnualCost).toBeCloseTo(10632.46, 1);
    });

    it("solves Western Electric EOQ with Planned Backorders (Balakrishnan)", () => {
      const benchmark = BENCHMARKS.inventory.find((b) => b.id === "balakrishnan-western-electric-backorders")!;
      const sol = solveInventoryControl(benchmark.data);
      expect(sol.optimalOrderQtyY).toBe(1140);
      expect(sol.maxShortageS).toBe(263);
      expect(sol.maxInventoryLevel).toBe(877);
    });

    it("solves EOQ with Quantity Discounts (Hillier & Lieberman)", () => {
      const benchmark = BENCHMARKS.inventory.find((b) => b.id === "hillier-quantity-discounts")!;
      const sol = solveInventoryControl(benchmark.data);
      expect(sol.optimalOrderQtyY).toBe(1000);
      expect(sol.totalAnnualCost).toBeLessThan(25000);
    });

    it("extracts inventory parameters from narrative word problems", () => {
      const text = "Annual demand is 12,000 units. Ordering cost is $50 per order. Carrying cost is $3 per unit per year. Unit cost is $20.";
      const inv = extractInventoryProblem(text);
      expect(inv).not.toBeNull();
      expect(inv?.annualDemandD).toBe(12000);
      expect(inv?.orderingCostK).toBe(50);
      expect(inv?.holdingCostH).toBe(3);
      expect(inv?.unitPriceC).toBe(20);

      const sol = solveInventoryControl(inv!);
      expect(sol.optimalOrderQtyY).toBe(632);
    });
  });

  // ==========================================================================
  // 7. QUEUING ANALYSIS (M/M/1, M/M/c, M/M/1/K)
  // ==========================================================================
  describe("Queuing Analysis", () => {
    it("solves single-server M/M/1 drive-in teller (Taha)", () => {
      const benchmark = BENCHMARKS.queuing.find((b) => b.id === "taha-bank-drivein")!;
      const sol = solveQueuing(benchmark.data);
      expect(sol.utilizationRho).toBe(0.667);
      expect(sol.avgInSystemLs).toBe(2);
      expect(sol.avgInQueueLq).toBe(1.333);
      expect(sol.avgWaitSystemWs).toBe(0.2);
    });

    it("solves multi-server M/M/c commercial bank (Balakrishnan)", () => {
      const benchmark = BENCHMARKS.queuing.find((b) => b.id === "balakrishnan-multi-teller")!;
      const sol = solveQueuing(benchmark.data);
      expect(sol.utilizationRho).toBeCloseTo(0.741, 2);
      expect(sol.probZeroP0).toBeGreaterThan(0);
      expect(sol.avgInQueueLq).toBeGreaterThan(0);
    });

    it("solves finite capacity M/M/1/K buffer drive-through (Balakrishnan)", () => {
      const benchmark = BENCHMARKS.queuing.find((b) => b.id === "balakrishnan-drive-thru-finite")!;
      const sol = solveQueuing(benchmark.data);
      expect(sol.blockingProbabilityPk).toBeDefined();
      expect(sol.effectiveArrivalRate).toBeDefined();
      expect(sol.effectiveArrivalRate!).toBeLessThan(12);
    });

    it("extracts queuing problem from natural language statements", () => {
      const text = "Customers arrive at a rate of 10 per hour (Poisson) and service time takes an average of 4 minutes per customer (Exponential). There is 1 server.";
      const q = extractQueuingProblem(text);
      expect(q).not.toBeNull();
      expect(q?.arrivalRateLambda).toBe(10);
      expect(q?.serviceRateMu).toBe(15);
      expect(q?.serversCountC).toBe(1);
    });
  });

  // ==========================================================================
  // 8. ZERO-SUM GAME THEORY
  // ==========================================================================
  describe("Zero-Sum Games", () => {
    it("detects pure saddle point in matrix game (Taha)", () => {
      const benchmark = BENCHMARKS.game.find((b) => b.id === "taha-two-person-saddle")!;
      const sol = solveZeroSumGame(benchmark.data);
      expect(sol.hasSaddlePoint).toBe(true);
      expect(sol.gameValue).toBe(0);
      expect(sol.saddlePointLocation).toEqual([2, 1]);
    });

    it("computes 2x2 analytical mixed strategy probabilities (Hillier & Lieberman)", () => {
      const benchmark = BENCHMARKS.game.find((b) => b.id === "hillier-market-mixed-game")!;
      const sol = solveZeroSumGame(benchmark.data);
      expect(sol.hasSaddlePoint).toBe(false);
      expect(sol.player1Probabilities).toBeDefined();
      expect(sol.player2Probabilities).toBeDefined();
      expect(sol.player1Probabilities![0]).toBeCloseTo(0.5, 1);
      expect(sol.player2Probabilities![0]).toBeCloseTo(0.6, 1);
    });

    it("extracts zero-sum game payoff matrices from markdown tables", () => {
      const table = `
| Player 1 \\ Player 2 | Action 1 | Action 2 |
| Strategy A | 3 | -2 |
| Strategy B | -1 | 4 |
      `;
      const game = extractZeroSumGame(table);
      expect(game).not.toBeNull();
      expect(game?.player1Strategies).toEqual(["Strategy A", "Strategy B"]);
      expect(game?.player2Strategies).toEqual(["Action 1", "Action 2"]);
      expect(game?.payoffMatrix).toEqual([
        [3, -2],
        [-1, 4],
      ]);
    });
  });

  // ==========================================================================
  // 9. SIMULTANEOUS LINEAR EQUATIONS (Gauss-Jordan)
  // ==========================================================================
  describe("Linear Equations (Ax = b)", () => {
    it("solves 3x3 simultaneous linear equations (Taha)", () => {
      const benchmark = BENCHMARKS.linearEq.find((b) => b.id === "taha-production-equations")!;
      const sol = solveLinearEquations(benchmark.data.matrixA, benchmark.data.vectorB);
      expect(sol).toEqual([2, 3, -1]);
    });

    it("extracts linear equations from algebraic strings", () => {
      const eqText = `
        2x + y - z = 8
        -3x - y + 2z = -11
        -2x + y + 2z = -3
      `;
      const eq = extractLinearEquations(eqText);
      expect(eq).not.toBeNull();
      expect(eq?.matrixA.length).toBe(3);
      expect(eq?.vectorB.length).toBe(3);
      const sol = solveLinearEquations(eq!.matrixA, eq!.vectorB);
      expect(sol).toEqual([2, 3, -1]);
    });
  });

  // ==========================================================================
  // 10. CLASSIFIER & END-TO-END OCR PIPELINE
  // ==========================================================================
  describe("Classifier and Parser Integration", () => {
    it("classifies and extracts LP problems accurately", () => {
      const text = "Maximize Z = 5x1 + 4x2 subject to 6x1 + 4x2 <= 24 and x1 + 2x2 <= 6";
      const res = classifyOrProblemFromText(text);
      expect(res.detectedModule).toBe("linear-programming");
      expect(res.parsedData?.lp).toBeDefined();
    });

    it("classifies and extracts transportation problems accurately", () => {
      const text = "Transportation problem with supply S1=15, S2=25 and demand D1=5, D2=15";
      const res = classifyOrProblemFromText(text);
      expect(res.detectedModule).toBe("transportation-assignment");
      expect(res.transSubtype).toBe("transportation");
    });

    it("classifies and extracts Hungarian assignment problems accurately", () => {
      const text = "Hungarian assignment problem assigning 4 workers to 4 jobs at minimal cost";
      const res = classifyOrProblemFromText(text);
      expect(res.detectedModule).toBe("transportation-assignment");
      expect(res.transSubtype).toBe("hungarian-assignment");
    });

    it("classifies and extracts Queuing problems accurately", () => {
      const text = "Arrival rate lambda = 10 per hour, service rate mu = 15 per hour in an M/M/1 waiting line";
      const res = classifyOrProblemFromText(text);
      expect(res.detectedModule).toBe("queuing-models");
      expect(res.parsedData?.queuing).toBeDefined();
    });

    it("classifies and extracts Inventory EOQ problems accurately", () => {
      const text = "Economic order quantity problem with annual demand 10000, ordering cost 100, holding cost 2";
      const res = classifyOrProblemFromText(text);
      expect(res.detectedModule).toBe("inventory-control");
      expect(res.parsedData?.inventory).toBeDefined();
    });
  });
});
