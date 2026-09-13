import {
  TransportationProblem,
  AssignmentProblem,
  LpProblem,
  NetworkEdge,
  CpmActivity,
  InventoryProblem,
  QueuingProblem,
  ZeroSumGameProblem,
} from "./or/types";

export interface BenchmarkProblem<T> {
  id: string;
  title: string;
  description: string;
  source: string;
  data: T;
}

export const BENCHMARKS = {
  trans: [
    {
      id: "meridian",
      title: "Meridian 4x5 Manufacturing",
      description: "4 production plants supplying 5 regional distribution warehouses (Total: 668 units)",
      source: "Meridian Case Study",
      data: {
        sources: ["Plant A", "Plant B", "Plant C", "Plant D"],
        destinations: ["Warehouse 1", "Warehouse 2", "Warehouse 3", "Warehouse 4", "Warehouse 5"],
        supply: [143, 170, 158, 197],
        demand: [75, 125, 181, 79, 208],
        costs: [
          [34, 38, 28, 28, 36],
          [29, 24, 31, 38, 44],
          [6, 44, 20, 6, 18],
          [36, 4, 40, 33, 18],
        ],
      },
    },
    {
      id: "taha-3x4",
      title: "Taha 3x4 Standard VAM",
      description: "Classic balanced 3-plant, 4-market distribution model",
      source: "Hamdy A. Taha, Operations Research",
      data: {
        sources: ["Plant 1", "Plant 2", "Plant 3"],
        destinations: ["Market 1", "Market 2", "Market 3", "Market 4"],
        supply: [15, 25, 10],
        demand: [5, 15, 15, 15],
        costs: [
          [10, 2, 20, 11],
          [12, 7, 9, 20],
          [4, 14, 16, 18],
        ],
      },
    },
    {
      id: "unbalanced-brewery",
      title: "Unbalanced 3x3 Brewery (Excess Supply)",
      description: "3 breweries producing 130k bbl for 3 cities demanding 100k bbl (Auto-balanced dummy)",
      source: "Hillier & Lieberman",
      data: {
        sources: ["Brewery 1", "Brewery 2", "Brewery 3"],
        destinations: ["City 1", "City 2", "City 3"],
        supply: [50, 50, 30],
        demand: [40, 35, 25],
        costs: [
          [8, 6, 10],
          [9, 12, 13],
          [14, 9, 16],
        ],
      },
    },
  ] as BenchmarkProblem<TransportationProblem>[],

  assign: [
    {
      id: "machinist-4x4",
      title: "Machinist-Job 4x4 Assignment",
      description: "4 skilled workers assigned to 4 machining operations at minimum labor cost",
      source: "Hamdy A. Taha",
      data: {
        workers: ["Worker 1", "Worker 2", "Worker 3", "Worker 4"],
        jobs: ["Job A", "Job B", "Job C", "Job D"],
        costs: [
          [1, 4, 6, 3],
          [9, 7, 10, 9],
          [4, 5, 11, 7],
          [8, 7, 8, 5],
        ],
      },
    },
    {
      id: "sales-territory",
      title: "Sales Territory 4x4 Assignment",
      description: "Assign 4 regional directors to 4 expansion regions based on travel expense",
      source: "Winston, Operations Research",
      data: {
        workers: ["Director Alpha", "Director Beta", "Director Gamma", "Director Delta"],
        jobs: ["Region North", "Region South", "Region East", "Region West"],
        costs: [
          [12, 18, 15, 22],
          [10, 14, 20, 16],
          [14, 12, 17, 19],
          [18, 16, 14, 12],
        ],
      },
    },
  ] as BenchmarkProblem<AssignmentProblem>[],

  lp: [
    {
      id: "wyndor-glass",
      title: "Wyndor Glass Company",
      description: "Classic 2-product profit maximization with 3 plant production hour limits",
      source: "Hillier & Lieberman",
      data: {
        objective: "max",
        objectiveCoefficients: [3, 5],
        constraints: [
          { coefficients: [1, 0], operator: "<=", rhs: 4 },
          { coefficients: [0, 2], operator: "<=", rhs: 12 },
          { coefficients: [3, 2], operator: "<=", rhs: 18 },
        ],
        variableNames: ["Doors (x1)", "Windows (x2)"],
      },
    },
    {
      id: "diet-problem",
      title: "Stigler Nutrition & Diet (Minimization)",
      description: "Minimize daily diet cost subject to vitamin, protein, and calorie requirements",
      source: "George Stigler LP Benchmark",
      data: {
        objective: "min",
        objectiveCoefficients: [4, 2],
        constraints: [
          { coefficients: [3, 1], operator: ">=", rhs: 27 },
          { coefficients: [1, 1], operator: ">=", rhs: 21 },
          { coefficients: [1, 2], operator: ">=", rhs: 30 },
        ],
        variableNames: ["Food 1 (x1)", "Food 2 (x2)"],
      },
    },
  ] as BenchmarkProblem<LpProblem>[],

  network: [
    {
      id: "arcadia-22",
      title: "Arcadia Water 22-District MST",
      description: "Minimum Spanning Tree across 22 semi-arid agricultural districts with 75 canal arcs",
      source: "Arcadia Regional Water Authority",
      data: {
        edges: [
          { from: "D1", to: "D3", cost: 32.3 },
          { from: "D1", to: "D4", cost: 82.24 },
          { from: "D1", to: "D5", cost: 79.97 },
          { from: "D1", to: "D9", cost: 52.67 },
          { from: "D1", to: "D16", cost: 44.66 },
          { from: "D1", to: "D19", cost: 15.26 },
          { from: "D1", to: "D21", cost: 13.73 },
          { from: "D1", to: "D22", cost: 7.92 },
          { from: "D2", to: "D6", cost: 55.55 },
          { from: "D2", to: "D7", cost: 64.01 },
          { from: "D2", to: "D8", cost: 87.45 },
          { from: "D2", to: "D13", cost: 54.81 },
          { from: "D2", to: "D14", cost: 87.48 },
          { from: "D2", to: "D15", cost: 38.14 },
          { from: "D2", to: "D19", cost: 15.68 },
          { from: "D3", to: "D6", cost: 9.48 },
          { from: "D3", to: "D10", cost: 28.57 },
          { from: "D3", to: "D18", cost: 48.82 },
          { from: "D4", to: "D7", cost: 86.85 },
          { from: "D4", to: "D11", cost: 29.32 },
          { from: "D4", to: "D12", cost: 24.14 },
          { from: "D4", to: "D15", cost: 64.89 },
          { from: "D4", to: "D16", cost: 36.93 },
          { from: "D4", to: "D17", cost: 51.13 },
          { from: "D4", to: "D19", cost: 17.14 },
          { from: "D4", to: "D21", cost: 75.75 },
          { from: "D5", to: "D6", cost: 81.27 },
          { from: "D5", to: "D10", cost: 67.55 },
          { from: "D5", to: "D12", cost: 82.63 },
          { from: "D5", to: "D18", cost: 32.27 },
          { from: "D6", to: "D9", cost: 7.21 },
          { from: "D6", to: "D16", cost: 29.96 },
          { from: "D6", to: "D20", cost: 79.47 },
          { from: "D6", to: "D22", cost: 43.7 },
          { from: "D7", to: "D8", cost: 21.23 },
          { from: "D7", to: "D12", cost: 17.12 },
          { from: "D7", to: "D13", cost: 18.21 },
          { from: "D7", to: "D15", cost: 41.16 },
          { from: "D7", to: "D16", cost: 81.8 },
          { from: "D7", to: "D17", cost: 78.31 },
          { from: "D7", to: "D18", cost: 67.77 },
          { from: "D7", to: "D21", cost: 67.64 },
          { from: "D7", to: "D22", cost: 20.44 },
          { from: "D8", to: "D15", cost: 69.42 },
          { from: "D8", to: "D17", cost: 23.21 },
          { from: "D8", to: "D20", cost: 48.39 },
          { from: "D9", to: "D14", cost: 7.3 },
          { from: "D9", to: "D16", cost: 79.01 },
          { from: "D9", to: "D20", cost: 15.23 },
          { from: "D10", to: "D12", cost: 53.99 },
          { from: "D10", to: "D14", cost: 59.8 },
          { from: "D10", to: "D17", cost: 58.27 },
          { from: "D10", to: "D19", cost: 61.47 },
          { from: "D10", to: "D21", cost: 35.34 },
          { from: "D11", to: "D12", cost: 70.65 },
          { from: "D11", to: "D13", cost: 82.86 },
          { from: "D11", to: "D16", cost: 56.03 },
          { from: "D11", to: "D19", cost: 86.3 },
          { from: "D11", to: "D21", cost: 75.46 },
          { from: "D12", to: "D14", cost: 9.14 },
          { from: "D12", to: "D18", cost: 60.58 },
          { from: "D13", to: "D14", cost: 12.14 },
          { from: "D13", to: "D16", cost: 59.72 },
          { from: "D13", to: "D17", cost: 35.5 },
          { from: "D13", to: "D21", cost: 75.85 },
          { from: "D14", to: "D17", cost: 8.23 },
          { from: "D15", to: "D22", cost: 83.53 },
          { from: "D16", to: "D17", cost: 8.13 },
          { from: "D16", to: "D18", cost: 9.23 },
          { from: "D16", to: "D19", cost: 4.72 },
          { from: "D16", to: "D20", cost: 14.98 },
          { from: "D16", to: "D22", cost: 86.84 },
          { from: "D17", to: "D20", cost: 74.24 },
          { from: "D18", to: "D19", cost: 81.05 },
          { from: "D20", to: "D22", cost: 20.06 },
        ] as NetworkEdge[],
        startNode: "D1",
        endNode: "D22",
      },
    },
    {
      id: "pipeline-max-flow",
      title: "Trans-Continental Oil Pipeline Max-Flow",
      description: "6-station pipeline network with throughput capacity limits (Max-Flow & Min-Cut)",
      source: "Taha Network Flow",
      data: {
        edges: [
          { from: "1", to: "2", cost: 20 },
          { from: "1", to: "3", cost: 30 },
          { from: "1", to: "4", cost: 10 },
          { from: "2", to: "3", cost: 40 },
          { from: "2", to: "5", cost: 30 },
          { from: "3", to: "4", cost: 10 },
          { from: "3", to: "5", cost: 20 },
          { from: "4", to: "5", cost: 20 },
        ] as NetworkEdge[],
        startNode: "1",
        endNode: "5",
      },
    },
  ],

  cpm: [
    {
      id: "house-construction",
      title: "Residential House Construction CPM",
      description: "7 critical construction stages: Site Prep, Foundation, Framing, Roofing, Utilities, Finishing",
      source: "Hamdy A. Taha",
      data: [
        { id: "A", name: "Site Prep", predecessors: [], duration: 2, optimisticA: 1, mostLikelyM: 2, pessimisticB: 3 },
        { id: "B", name: "Foundation", predecessors: ["A"], duration: 4, optimisticA: 2, mostLikelyM: 4, pessimisticB: 6 },
        { id: "C", name: "Framing", predecessors: ["B"], duration: 10, optimisticA: 6, mostLikelyM: 10, pessimisticB: 14 },
        { id: "D", name: "Roofing", predecessors: ["C"], duration: 6, optimisticA: 4, mostLikelyM: 6, pessimisticB: 8 },
        { id: "E", name: "Electrical", predecessors: ["C"], duration: 4, optimisticA: 3, mostLikelyM: 4, pessimisticB: 5 },
        { id: "F", name: "Plumbing", predecessors: ["C"], duration: 5, optimisticA: 4, mostLikelyM: 5, pessimisticB: 6 },
        { id: "G", name: "Finish", predecessors: ["D", "E", "F"], duration: 7, optimisticA: 5, mostLikelyM: 7, pessimisticB: 9 },
      ] as CpmActivity[],
    },
  ],

  inventory: [
    {
      id: "auto-parts-eoq",
      title: "Automotive Parts Classic EOQ",
      description: "Annual demand: 10,000 units, $50 order cost, $2/unit/year holding cost",
      source: "Wilson EOQ Model",
      data: {
        model: "classic-eoq",
        annualDemandD: 10000,
        orderingCostK: 50,
        holdingCostH: 2,
        unitPriceC: 25,
      } as InventoryProblem,
    },
  ],

  queuing: [
    {
      id: "bank-teller-m-m-1",
      title: "Bank Drive-Through (M/M/1)",
      description: "Arrival rate λ = 12 cars/hr, Single service window μ = 15 cars/hr",
      source: "Gross & Harris Queueing",
      data: {
        model: "M/M/1",
        arrivalRateLambda: 12,
        serviceRateMu: 15,
        serversCountC: 1,
      } as QueuingProblem,
    },
    {
      id: "airline-callcenter-m-m-3",
      title: "Airline Reservation Desk (M/M/3)",
      description: "Arrival rate λ = 45 calls/hr, 3 agent servers at μ = 20 calls/hr each",
      source: "Hillier Queueing",
      data: {
        model: "M/M/c",
        arrivalRateLambda: 45,
        serviceRateMu: 20,
        serversCountC: 3,
      } as QueuingProblem,
    },
  ],

  game: [
    {
      id: "morra-game",
      title: "Two-Player Military Defense Strategy",
      description: "3 offensive strategies vs 4 defensive deployments with minimax saddle point",
      source: "Von Neumann & Morgenstern",
      data: {
        player1Strategies: ["Deploy Flank", "Deploy Center", "Reserve Force"],
        player2Strategies: ["Defend Alpha", "Defend Bravo", "Defend Charlie", "Defend Delta"],
        payoffMatrix: [
          [3, -1, 4, 2],
          [-1, -3, -7, 0],
          [4, 0, 6, 3],
        ],
      } as ZeroSumGameProblem,
    },
  ],

  linearEq: [
    {
      id: "truss-circuit-3x3",
      title: "Electrical Circuit Mesh (3x3)",
      description: "Kirchhoff voltage laws across 3 loops: 2x + y - z = 8, -3x - y + 2z = -11, -2x + y + 2z = -3",
      source: "Gauss-Jordan Circuit Benchmark",
      data: {
        matrixA: [
          [2, 1, -1],
          [-3, -1, 2],
          [-2, 1, 2],
        ],
        vectorB: [8, -11, -3],
      },
    },
  ],
};
