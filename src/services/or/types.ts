export type OrModule =
  | "linear-programming"
  | "transportation-assignment"
  | "integer-programming"
  | "network-models"
  | "project-planning"
  | "queuing-models"
  | "zero-sum-games"
  | "inventory-control"
  | "linear-equations";

export type NetworkSubtype = "shortest-route" | "minimum-spanning-tree" | "maximal-flow";
export type LpSolveMode = "simplex-tableau" | "graphical-2d";
export type TransSubtype = "transportation" | "hungarian-assignment";

export interface LpConstraint {
  coefficients: number[];
  operator: "<=" | "=" | ">=";
  rhs: number;
}

export interface LpProblem {
  objective: "max" | "min";
  objectiveCoefficients: number[];
  constraints: LpConstraint[];
  variableNames?: string[];
}

export interface SimplexTableauIteration {
  iteration: number;
  basicVars: string[];
  headers: string[];
  rows: number[][]; // Each row contains coeffs + RHS
  zRow: number[];
  enteringVar?: string;
  leavingVar?: string;
  pivotRowIdx?: number;
  pivotColIdx?: number;
  ratios?: (number | null)[];
}

export interface GraphicalCornerPoint {
  x1: number;
  x2: number;
  zValue: number;
  isFeasible: boolean;
  isOptimal: boolean;
}

export interface GraphicalLine {
  label: string;
  xIntercept: number | null;
  yIntercept: number | null;
  slope: number | null;
  operator: "<=" | "=" | ">=";
  rhs: number;
  c1: number;
  c2: number;
}

export interface GraphicalLpSolution {
  lines: GraphicalLine[];
  feasiblePolygon: [number, number][];
  cornerPoints: GraphicalCornerPoint[];
  optimalPoint: [number, number];
  optimalZ: number;
  maxX: number;
  maxY: number;
}

export interface LpSolution {
  status: "optimal" | "infeasible" | "unbounded";
  objectiveValue: number;
  variableValues: { name: string; value: number; shadowPrice?: number }[];
  iterationsCount: number;
  tableaus: SimplexTableauIteration[];
  graphical?: GraphicalLpSolution;
  dualPrices?: { constraint: string; shadowPrice: number; slack: number }[];
}

export interface TransportationProblem {
  sources: string[];
  destinations: string[];
  supply: number[];
  demand: number[];
  costs: number[][];
}

export interface TransportationSolution {
  allocations: number[][];
  totalCost: number;
  isBalanced: boolean;
  dummyAdded?: "supply" | "demand" | null;
  method: string;
}

export interface AssignmentProblem {
  workers: string[];
  jobs: string[];
  costs: number[][];
}

export interface AssignmentSolution {
  assignments: { worker: string; job: string; cost: number }[];
  totalCost: number;
  steps?: { label: string; matrix: number[][] }[];
}

export interface NetworkEdge {
  from: number | string;
  to: number | string;
  cost: number;
  capacity?: number;
}

export interface NetworkSolution {
  type: NetworkSubtype;
  selectedEdges: { from: string; to: string; weight: number; stepReason?: string }[];
  totalMetric: number;
  pathString?: string;
}

export interface CpmActivity {
  id: string;
  name: string;
  predecessors: string[];
  duration: number;
  // PERT 3-Time Estimates
  optimisticA?: number;
  mostLikelyM?: number;
  pessimisticB?: number;
}

export interface CpmSolution {
  activities: {
    id: string;
    duration: number;
    earlyStart: number;
    earlyFinish: number;
    lateStart: number;
    lateFinish: number;
    slack: number;
    isCritical: boolean;
    expectedTime?: number;
    variance?: number;
  }[];
  criticalPath: string[];
  projectDuration: number;
  projectVariance?: number;
  projectStdDev?: number;
}

export interface QueuingProblem {
  model: "M/M/1" | "M/M/c";
  arrivalRateLambda: number;
  serviceRateMu: number;
  serversCountC: number;
}

export interface QueuingSolution {
  utilizationRho: number;
  probZeroP0: number;
  avgInQueueLq: number;
  avgInSystemLs: number;
  avgWaitQueueWq: number;
  avgWaitSystemWs: number;
}

export interface ZeroSumGameProblem {
  player1Strategies: string[];
  player2Strategies: string[];
  payoffMatrix: number[][];
}

export interface ZeroSumGameSolution {
  hasSaddlePoint: boolean;
  saddlePoint?: { row: number; col: number; value: number };
  maximinValue: number;
  minimaxValue: number;
  gameValue: number;
  player1Probabilities?: number[];
  player2Probabilities?: number[];
}

export interface InventoryProblem {
  model: "classic-eoq" | "eoq-with-backorders";
  annualDemandD: number;
  orderingCostK: number;
  holdingCostH: number;
  unitPriceC: number;
  shortageCostP?: number;
}

export interface InventorySolution {
  optimalOrderQtyY: number;
  cycleTimeT0Days: number;
  maxShortageS?: number;
  annualOrderingCost: number;
  annualHoldingCost: number;
  annualShortageCost?: number;
  totalAnnualCost: number;
  reorderPointR?: number;
}
