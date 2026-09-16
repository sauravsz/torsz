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
      id: "taha-mg-auto",
      title: "MG Auto Transportation (3x4 Balanced)",
      description: "Car distribution from 3 manufacturing plants to 4 regional distribution centers at minimum shipping cost.",
      source: "Hamdy A. Taha - Operations Research: An Introduction (10th Ed.), Chapter 5",
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
      id: "balakrishnan-foster-generators",
      title: "Foster Generators Distribution",
      description: "Shipping electric generators from Cleveland, Bedford, and York to Boston, Chicago, St. Louis, and Lexington.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 5",
      data: {
        sources: ["Cleveland", "Bedford", "York"],
        destinations: ["Boston", "Chicago", "St. Louis", "Lexington"],
        supply: [5000, 6000, 2500],
        demand: [6000, 4000, 2000, 1500],
        costs: [
          [3, 2, 7, 6],
          [7, 5, 2, 3],
          [2, 5, 4, 5],
        ],
      },
    },
    {
      id: "hillier-northern-airplane",
      title: "Northern Airplane Co Production & Shipping",
      description: "Optimizing engine production and delivery schedule across 4 quarters to minimize production and inventory carrying costs.",
      source: "Hillier & Lieberman - Introduction to Operations Research (11th Ed.), Chapter 9",
      data: {
        sources: ["Month 1", "Month 2", "Month 3"],
        destinations: ["Install M1", "Install M2", "Install M3"],
        supply: [25, 35, 30],
        demand: [10, 15, 25],
        costs: [
          [1080, 1095, 1110],
          [9999, 1110, 1125],
          [9999, 9999, 1100],
        ],
      },
    },
    {
      id: "meridian-unbalanced",
      title: "Meridian Manufacturing (Unbalanced Supply)",
      description: "3 production plants with 430 total supply serving 4 warehouse districts with 305 total demand.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 5",
      data: {
        sources: ["Plant A", "Plant B", "Plant C"],
        destinations: ["Warehouse 1", "Warehouse 2", "Warehouse 3", "Warehouse 4"],
        supply: [143, 192, 95],
        demand: [75, 110, 60, 60],
        costs: [
          [34, 38, 42, 40],
          [36, 32, 44, 38],
          [40, 35, 30, 45],
        ],
      },
    },
  ] as BenchmarkProblem<TransportationProblem>[],

  assign: [
    {
      id: "taha-job-matching",
      title: "Worker-to-Machine Assignment",
      description: "Assign 4 workers to 4 manufacturing machines at minimum overall setup and processing cost.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 5",
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
      id: "balakrishnan-crew-assignment",
      title: "Facility Maintenance Crew Assignment",
      description: "Optimal allocation of 4 maintenance teams to 4 commercial building projects with varying travel and labor rates.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 5",
      data: {
        workers: ["Crew 1", "Crew 2", "Crew 3", "Crew 4"],
        jobs: ["Site Alpha", "Site Beta", "Site Gamma", "Site Delta"],
        costs: [
          [90, 75, 75, 80],
          [35, 85, 55, 65],
          [125, 95, 90, 105],
          [45, 110, 95, 115],
        ],
      },
    },
    {
      id: "cadle-analyst-project-allocation",
      title: "Business Analyst Project Allocation",
      description: "Allocating 4 senior business analysts to 4 strategic transformation initiatives based on hourly billing cost.",
      source: "Cadle, Eva, Hindle, Paul - Business Analysis (3rd Ed.), Chapter 10",
      data: {
        workers: ["Analyst 1 (Lead)", "Analyst 2 (Process)", "Analyst 3 (Data)", "Analyst 4 (Agile)"],
        jobs: ["CRM Overhaul", "ERP Migration", "Digital Portal", "Payment Gateway"],
        costs: [
          [15, 12, 18, 14],
          [12, 10, 14, 16],
          [18, 14, 11, 13],
          [14, 16, 13, 9],
        ],
      },
    },
  ] as BenchmarkProblem<AssignmentProblem>[],

  lp: [
    {
      id: "taha-reddy-mikks",
      title: "Reddy Mikks Raw Material Mix",
      description: "Maximize profit for exterior and interior paint production subject to raw material availability and market demand limits.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 2",
      data: {
        objective: "max",
        objectiveCoefficients: [5, 4],
        variableNames: ["x1 (Exterior)", "x2 (Interior)"],
        constraints: [
          { coefficients: [6, 4], operator: "<=", rhs: 24 },
          { coefficients: [1, 2], operator: "<=", rhs: 6 },
          { coefficients: [-1, 1], operator: "<=", rhs: 1 },
          { coefficients: [0, 1], operator: "<=", rhs: 2 },
        ],
      },
    },
    {
      id: "hillier-wyndor-glass",
      title: "Wyndor Glass Co. Product Mix",
      description: "Maximize weekly profit for doors and windows across 3 production facilities.",
      source: "Hillier & Lieberman - Introduction to Operations Research, Chapter 3",
      data: {
        objective: "max",
        objectiveCoefficients: [3, 5],
        variableNames: ["Doors (x1)", "Windows (x2)"],
        constraints: [
          { coefficients: [1, 0], operator: "<=", rhs: 4 },
          { coefficients: [0, 2], operator: "<=", rhs: 12 },
          { coefficients: [3, 2], operator: "<=", rhs: 18 },
        ],
      },
    },
    {
      id: "balakrishnan-flair-furniture",
      title: "Flair Furniture Production Mix",
      description: "Determining optimal number of tables and chairs to produce given carpentry and painting hour limits.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 2",
      data: {
        objective: "max",
        objectiveCoefficients: [70, 50],
        variableNames: ["Tables (T)", "Chairs (C)"],
        constraints: [
          { coefficients: [4, 3], operator: "<=", rhs: 240 },
          { coefficients: [2, 1], operator: "<=", rhs: 100 },
        ],
      },
    },
    {
      id: "taha-stigler-diet",
      title: "Stigler Nutrition Diet Problem",
      description: "Minimize daily diet food cost subject to minimum nutritional requirements for vitamins and calories.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 2",
      data: {
        objective: "min",
        objectiveCoefficients: [4, 2],
        variableNames: ["Feed A (x1)", "Feed B (x2)"],
        constraints: [
          { coefficients: [3, 1], operator: ">=", rhs: 27 },
          { coefficients: [1, 1], operator: ">=", rhs: 21 },
          { coefficients: [1, 2], operator: ">=", rhs: 30 },
        ],
      },
    },
    {
      id: "wma-goal-programming",
      title: "Weighted Moving Average MAD Optimization",
      description: "9-variable goal programming linear model to find non-increasing weights w3 >= w2 >= w1 minimizing absolute forecast error.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 4",
      data: {
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
      },
    },
  ] as BenchmarkProblem<LpProblem>[],

  network: [
    {
      id: "taha-rent-car",
      title: "Equipment Replacement (Shortest Route)",
      description: "Finding the optimal 4-year car replacement schedule from acquisition to disposal.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 6",
      data: {
        edges: [
          { from: 1, to: 2, cost: 4000 },
          { from: 1, to: 3, cost: 5400 },
          { from: 1, to: 4, cost: 9800 },
          { from: 2, to: 3, cost: 4300 },
          { from: 2, to: 4, cost: 6200 },
          { from: 2, to: 5, cost: 8700 },
          { from: 3, to: 4, cost: 4800 },
          { from: 3, to: 5, cost: 7100 },
          { from: 4, to: 5, cost: 4900 },
        ],
        startNode: "1",
        endNode: "5",
      },
    },
    {
      id: "hillier-cable-mst",
      title: "Regional Cable Network (Minimum Spanning Tree)",
      description: "Connect 6 municipal stations with minimum total fiber-optic cable length using Kruskal's algorithm.",
      source: "Hillier & Lieberman - Introduction to Operations Research, Chapter 10",
      data: {
        edges: [
          { from: "A", to: "B", cost: 1 },
          { from: "A", to: "C", cost: 7 },
          { from: "B", to: "C", cost: 5 },
          { from: "B", to: "D", cost: 4 },
          { from: "B", to: "E", cost: 3 },
          { from: "C", to: "E", cost: 6 },
          { from: "D", to: "E", cost: 2 },
        ],
      },
    },
    {
      id: "taha-oil-maxflow",
      title: "Trans-Continental Pipeline (Maximal Flow)",
      description: "Determine maximum barrels per hour throughput from crude refinery (node 1) to maritime terminal (node 5).",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 6",
      data: {
        edges: [
          { from: "1", to: "2", cost: 20 },
          { from: "1", to: "3", cost: 30 },
          { from: "2", to: "3", cost: 10 },
          { from: "2", to: "4", cost: 15 },
          { from: "3", to: "4", cost: 10 },
          { from: "3", to: "5", cost: 20 },
          { from: "4", to: "5", cost: 25 },
        ],
        startNode: "1",
        endNode: "5",
      },
    },
  ] as BenchmarkProblem<{ edges: NetworkEdge[]; startNode?: string; endNode?: string }>[],

  cpm: [
    {
      id: "balakrishnan-general-foundry",
      title: "General Foundry Construction (CPM)",
      description: "Air pollution control equipment installation project with 8 interdependent activities.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 7",
      data: [
        { id: "A", name: "Build Internal Components", predecessors: [], duration: 2, optimisticA: 1, mostLikelyM: 2, pessimisticB: 3 },
        { id: "B", name: "Modify Roof and Floor", predecessors: ["A"], duration: 3, optimisticA: 2, mostLikelyM: 3, pessimisticB: 4 },
        { id: "C", name: "Construct Collection Stack", predecessors: ["A"], duration: 2, optimisticA: 1, mostLikelyM: 2, pessimisticB: 3 },
        { id: "D", name: "Pour Concrete and Install Frame", predecessors: ["B"], duration: 4, optimisticA: 2, mostLikelyM: 4, pessimisticB: 6 },
        { id: "E", name: "Build High-Temperature Burner", predecessors: ["C"], duration: 4, optimisticA: 1, mostLikelyM: 4, pessimisticB: 7 },
        { id: "F", name: "Install Control System", predecessors: ["C"], duration: 3, optimisticA: 1, mostLikelyM: 2, pessimisticB: 9 },
        { id: "G", name: "Install Air Pollution Device", predecessors: ["D", "E"], duration: 5, optimisticA: 3, mostLikelyM: 4, pessimisticB: 11 },
        { id: "H", name: "Inspect and Test", predecessors: ["F", "G"], duration: 2, optimisticA: 1, mostLikelyM: 2, pessimisticB: 3 },
      ],
    },
  ] as BenchmarkProblem<CpmActivity[]>[],

  inventory: [
    {
      id: "taha-classic-eoq",
      title: "Standard Wilson EOQ Model",
      description: "Basic deterministic economic order quantity minimizing total holding and ordering costs.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 13",
      data: {
        model: "classic-eoq",
        annualDemandD: 1000,
        orderingCostK: 100,
        holdingCostH: 2,
        unitPriceC: 10,
      },
    },
    {
      id: "balakrishnan-western-electric-backorders",
      title: "Western Electric (EOQ with Planned Backorders)",
      description: "Inventory policy with planned customer shortages and backorder penalty costs.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 9",
      data: {
        model: "eoq-with-backorders",
        annualDemandD: 10000,
        orderingCostK: 150,
        holdingCostH: 3,
        unitPriceC: 50,
        shortageCostP: 10,
      },
    },
    {
      id: "hillier-quantity-discounts",
      title: "Inventory Control with Price Break Tiers",
      description: "3-tier quantity discount pricing structure determining optimal global order quantity.",
      source: "Hillier & Lieberman - Introduction to Operations Research, Chapter 18",
      data: {
        model: "quantity-discounts",
        annualDemandD: 5000,
        orderingCostK: 49,
        holdingCostH: 0.2, // 20% of unit price
        unitPriceC: 5.0,
        priceBreaks: [
          { tierIndex: 1, minQty: 1, maxQty: 999, unitPrice: 5.0 },
          { tierIndex: 2, minQty: 1000, maxQty: 1999, unitPrice: 4.8 },
          { tierIndex: 3, minQty: 2000, unitPrice: 4.75 },
        ],
      },
    },
  ] as BenchmarkProblem<InventoryProblem>[],

  queuing: [
    {
      id: "taha-bank-drivein",
      title: "Drive-In Teller Window (M/M/1)",
      description: "Single-server Poisson arrival and exponential service queue analysis.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 18",
      data: {
        model: "M/M/1",
        arrivalRateLambda: 10,
        serviceRateMu: 15,
        serversCountC: 1,
      },
    },
    {
      id: "balakrishnan-multi-teller",
      title: "Commercial Bank Multi-Server (M/M/c)",
      description: "3-channel customer service department evaluating wait times and server utilization.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 11",
      data: {
        model: "M/M/c",
        arrivalRateLambda: 40,
        serviceRateMu: 18,
        serversCountC: 3,
      },
    },
    {
      id: "balakrishnan-drive-thru-finite",
      title: "Fast-Food Drive-Through (M/M/1/K Buffer)",
      description: "Single-server drive-through with space for at most 4 vehicles before blocking new arrivals.",
      source: "Balakrishnan, Render, Stair - Managerial Decision Modeling, Chapter 11",
      data: {
        model: "M/M/1",
        arrivalRateLambda: 12,
        serviceRateMu: 15,
        serversCountC: 1,
        systemCapacityK: 4,
      },
    },
  ] as BenchmarkProblem<QueuingProblem>[],

  game: [
    {
      id: "taha-two-person-saddle",
      title: "Two-Person Zero-Sum Saddle Point",
      description: "3x4 competitive strategy game verifying Minimax = Maximin equilibrium.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 15",
      data: {
        player1Strategies: ["A1", "A2", "A3"],
        player2Strategies: ["B1", "B2", "B3", "B4"],
        payoffMatrix: [
          [3, -1, 4, 2],
          [-1, -3, -7, 0],
          [4, 0, 6, 3],
        ],
      },
    },
    {
      id: "hillier-market-mixed-game",
      title: "Marketing Strategy Game (2x2 Mixed Strategy)",
      description: "2-player media expenditure game with mixed strategy optimal probabilities.",
      source: "Hillier & Lieberman - Introduction to Operations Research, Chapter 14",
      data: {
        player1Strategies: ["TV Advertising", "Digital Marketing"],
        player2Strategies: ["TV Advertising", "Digital Marketing"],
        payoffMatrix: [
          [3, -2],
          [-1, 4],
        ],
      },
    },
  ] as BenchmarkProblem<ZeroSumGameProblem>[],

  linearEq: [
    {
      id: "taha-production-equations",
      title: "3x3 Simultaneous Production Equations",
      description: "Simultaneous linear balance equations solved via Gauss-Jordan elimination with partial pivoting.",
      source: "Hamdy A. Taha - Operations Research: An Introduction, Chapter 2",
      data: {
        matrixA: [
          [2, 1, -1],
          [-3, -1, 2],
          [-2, 1, 2],
        ],
        vectorB: [8, -11, -3],
      },
    },
  ] as BenchmarkProblem<{ matrixA: number[][]; vectorB: number[] }>[],
};
