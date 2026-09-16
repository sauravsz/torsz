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
  sources?: string[];
  destinations?: string[];
  costs?: number[][];
  allocationBreakdown?: {
    from: string;
    to: string;
    amount: number;
    unitCost: number;
    cost: number;
  }[];
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
  reducedMatrix?: number[][];
  dim?: number;
  workers?: string[];
  jobs?: string[];
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
  flowBreakdown?: { from: string; to: string; flow: number; capacity: number }[];
  minCut?: { sourceSet: string[]; sinkSet: string[]; cutCapacity: number };
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
  // Crashing parameters
  normalTime?: number;
  crashTime?: number;
  normalCost?: number;
  crashCost?: number;
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
    freeSlack?: number;
    isCritical: boolean;
    expectedTime?: number;
    variance?: number;
    crashCostPerUnit?: number;
  }[];
  criticalPath: string[];
  projectDuration: number;
  projectVariance?: number;
  projectStdDev?: number;
  schedule?: {
    id: string;
    name: string;
    duration: number;
    earlyStart: number;
    earlyFinish: number;
    lateStart: number;
    lateFinish: number;
    slack: number;
    freeSlack?: number;
    isCritical: boolean;
  }[];
}

export interface QueuingProblem {
  model: "M/M/1" | "M/M/c";
  arrivalRateLambda: number;
  serviceRateMu: number;
  serversCountC?: number;
  systemCapacityK?: number;
  serverCostPerHourCs?: number;
  waitingCostPerHourCw?: number;
}

export interface QueuingSolution {
  utilizationRho: number;
  probZeroP0: number;
  avgInQueueLq: number;
  avgInSystemLs: number;
  avgWaitQueueWq: number;
  avgWaitSystemWs: number;
  blockingProbabilityPk?: number;
  effectiveArrivalRate?: number;
  totalHourlyCost?: number;
}

export interface ZeroSumGameProblem {
  player1Strategies: string[];
  player2Strategies: string[];
  payoffMatrix: number[][];
}

export interface ZeroSumGameSolution {
  hasSaddlePoint: boolean;
  saddlePoint?: { row: number; col: number; value: number };
  saddlePointLocation?: [number, number];
  maximinValue: number;
  minimaxValue: number;
  gameValue: number;
  player1Probabilities?: number[];
  player2Probabilities?: number[];
  dominanceSteps?: string[];
  mixedStrategyFormula?: string;
}

export interface PriceBreakTier {
  tierIndex: number;
  minQty: number;
  maxQty?: number;
  unitPrice: number;
  holdingCostH?: number;
  eoqCalculated?: number;
  isFeasible?: boolean;
  totalCost?: number;
}

export interface InventoryProblem {
  model: "classic-eoq" | "eoq-with-backorders" | "quantity-discounts" | "epq-production" | "newsvendor";
  annualDemandD: number;
  orderingCostK: number;
  holdingCostH: number;
  unitPriceC: number;
  shortageCostP?: number;
  productionRateP?: number;
  salvageValueS?: number;
  priceBreaks?: PriceBreakTier[];
}

export interface InventorySolution {
  optimalOrderQtyY: number;
  cycleTimeT0Days?: number;
  cycleTimeMonths?: number;
  maxShortageS?: number;
  maxInventoryLevel?: number;
  annualOrderingCost?: number;
  annualHoldingCost?: number;
  annualShortageCost?: number;
  totalAnnualCost: number;
  reorderPoint?: number;
  reorderPointR?: number;
  selectedPriceBreakTier?: PriceBreakTier | number;
  priceBreakAnalysis?: PriceBreakTier[];
  criticalFractile?: number;
}
