import React, { useState } from "react";
import {
  TrendingUp,
  Truck,
  Network,
  Calendar,
  Clock,
  Swords,
  Calculator,
  Play,
  CheckCircle2,
  Package,
  FileText,
} from "lucide-react";
import {
  OrModule,
  NetworkSubtype,
  LpSolveMode,
  TransSubtype,
  LpProblem,
  LpSolution,
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
} from "../services/or/types";
import {
  solveLinearProgramming,
  solveTransportation,
  solveHungarianAssignment,
  solveNetworkShortestRoute,
  solveNetworkMst,
  solveNetworkMaxFlow,
  solveCpmPert,
  solveQueuing,
  solveZeroSumGame,
  solveInventoryControl,
  solveLinearEquations,
} from "../services/or/solvers";
import { GraphicalLpCanvas } from "./GraphicalLpCanvas";
import { SimplexTableauViewer } from "./SimplexTableauViewer";

interface OrSuiteViewProps {
  onOpenInSql: (sql: string) => void;
}

export const OrSuiteView: React.FC<OrSuiteViewProps> = ({ onOpenInSql }) => {
  const [activeModule, setActiveModule] = useState<OrModule>("network-models");
  const [lpMode, setLpMode] = useState<LpSolveMode>("graphical-2d");
  const [networkSubtype, setNetworkSubtype] = useState<NetworkSubtype>("shortest-route");
  const [transSubtype, setTransSubtype] = useState<TransSubtype>("transportation");

  // ==========================================
  // 1. Network Models State (Taha Ch. 6)
  // ==========================================
  const [networkEdges, setNetworkEdges] = useState<NetworkEdge[]>([
    { from: 1, to: 2, cost: 4000 },
    { from: 1, to: 3, cost: 5400 },
    { from: 1, to: 4, cost: 9800 },
    { from: 2, to: 3, cost: 4300 },
    { from: 2, to: 4, cost: 6200 },
    { from: 2, to: 5, cost: 8700 },
    { from: 3, to: 4, cost: 4800 },
    { from: 3, to: 5, cost: 7100 },
    { from: 4, to: 5, cost: 4900 },
  ]);
  const [netStartNode, setNetStartNode] = useState("1");
  const [netEndNode, setNetEndNode] = useState("5");

  // ==========================================
  // 2. Linear Programming State (Taha Ch. 2 & 3)
  // ==========================================
  const lpProblem: LpProblem = {
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

  // ==========================================
  // 3. Transportation & Assignment (Taha Ch. 5)
  // ==========================================
  const transProblem: TransportationProblem = {
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
  const assignProblem: AssignmentProblem = {
    workers: ["Worker 1", "Worker 2", "Worker 3", "Worker 4"],
    jobs: ["Job A", "Job B", "Job C", "Job D"],
    costs: [
      [1, 4, 6, 3],
      [9, 7, 10, 9],
      [4, 5, 11, 7],
      [8, 7, 8, 5],
    ],
  };
  // ==========================================
  // 4. Project Planning (CPM / PERT, Taha Ch. 6)
  // ==========================================
  const cpmActivities: CpmActivity[] = [
    { id: "A", name: "Site Prep", predecessors: [], duration: 2, optimisticA: 1, mostLikelyM: 2, pessimisticB: 3 },
    { id: "B", name: "Foundation", predecessors: ["A"], duration: 4, optimisticA: 2, mostLikelyM: 4, pessimisticB: 6 },
    { id: "C", name: "Framing", predecessors: ["B"], duration: 10, optimisticA: 6, mostLikelyM: 10, pessimisticB: 14 },
    { id: "D", name: "Roofing", predecessors: ["C"], duration: 6, optimisticA: 4, mostLikelyM: 6, pessimisticB: 8 },
    { id: "E", name: "Electrical", predecessors: ["C"], duration: 4, optimisticA: 3, mostLikelyM: 4, pessimisticB: 5 },
    { id: "F", name: "Plumbing", predecessors: ["C"], duration: 5, optimisticA: 4, mostLikelyM: 5, pessimisticB: 6 },
    { id: "G", name: "Finish", predecessors: ["D", "E", "F"], duration: 7, optimisticA: 5, mostLikelyM: 7, pessimisticB: 9 },
  ];
  // ==========================================
  // 5. Queuing Models (Taha Ch. 18)
  // ==========================================
  const queuingProblem: QueuingProblem = {
    model: "M/M/1",
    arrivalRateLambda: 2,
    serviceRateMu: 3,
    serversCountC: 1,
  };
  // ==========================================
  // 6. Zero-Sum Games (Taha Ch. 15)
  // ==========================================
  const gameProblem: ZeroSumGameProblem = {
    player1Strategies: ["A1", "A2", "A3"],
    player2Strategies: ["B1", "B2", "B3", "B4"],
    payoffMatrix: [
      [3, -1, 4, 2],
      [-1, -3, -7, 0],
      [4, 0, 6, 3],
    ],
  };
  // ==========================================
  // 7. Inventory Control (Taha Ch. 11 & 12)
  // ==========================================
  const inventoryProblem: InventoryProblem = {
    model: "classic-eoq",
    annualDemandD: 1000,
    orderingCostK: 100,
    holdingCostH: 2,
    unitPriceC: 10,
    shortageCostP: 5,
  };
  // ==========================================
  // 8. Linear Equations (Taha App. A)
  // ==========================================
  const linearEqA: number[][] = [
    [2, 1, -1],
    [-3, -1, 2],
    [-2, 1, 2],
  ];
  const linearEqB: number[] = [8, -11, -3];
  // Solution State Outputs
  const [networkSol, setNetworkSol] = useState<NetworkSolution | null>(null);
  const [lpSol, setLpSol] = useState<LpSolution | null>(null);
  const [transSol, setTransSol] = useState<TransportationSolution | null>(null);
  const [assignSol, setAssignSol] = useState<AssignmentSolution | null>(null);
  const [cpmSol, setCpmSol] = useState<CpmSolution | null>(null);
  const [queuingSol, setQueuingSol] = useState<QueuingSolution | null>(null);
  const [gameSol, setGameSol] = useState<ZeroSumGameSolution | null>(null);
  const [inventorySol, setInventorySol] = useState<InventorySolution | null>(null);
  const [linearEqSol, setLinearEqSol] = useState<number[] | null>(null);

  // Preset Loaders from Taha Textbook
  const loadRentCarPreset = () => {
    setActiveModule("network-models");
    setNetworkSubtype("shortest-route");
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
    setNetworkEdges(edges);
    setNetStartNode("1");
    setNetEndNode("5");
    const sol = solveNetworkShortestRoute(edges, "1", "5");
    setNetworkSol(sol);
  };

  const loadMidwestMstPreset = () => {
    setActiveModule("network-models");
    setNetworkSubtype("minimum-spanning-tree");
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
    setNetworkEdges(edges);
    const sol = solveNetworkMst(edges);
    setNetworkSol(sol);
  };

  // Execution Triggers
  const handleSolveLp = () => {
    try {
      const sol = solveLinearProgramming(lpProblem);
      setLpSol(sol);
    } catch (err: unknown) {
      alert(`LP Solver error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSolveTransportation = () => {
    try {
      const sol = solveTransportation(transProblem);
      setTransSol(sol);
    } catch (err: unknown) {
      alert(`Transportation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSolveAssignment = () => {
    try {
      const sol = solveHungarianAssignment(assignProblem);
      setAssignSol(sol);
    } catch (err: unknown) {
      alert(`Hungarian Assignment error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSolveNetwork = () => {
    if (networkSubtype === "shortest-route") {
      const sol = solveNetworkShortestRoute(networkEdges, netStartNode, netEndNode);
      setNetworkSol(sol);
    } else if (networkSubtype === "minimum-spanning-tree") {
      const sol = solveNetworkMst(networkEdges);
      setNetworkSol(sol);
    } else {
      const sol = solveNetworkMaxFlow(networkEdges, netStartNode, netEndNode);
      setNetworkSol(sol);
    }
  };

  const handleSolveCpm = () => {
    try {
      const sol = solveCpmPert(cpmActivities);
      setCpmSol(sol);
    } catch (err: unknown) {
      alert(`CPM/PERT error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSolveInventory = () => {
    try {
      const sol = solveInventoryControl(inventoryProblem);
      setInventorySol(sol);
    } catch (err: unknown) {
      alert(`Inventory error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSolveQueuing = () => {
    try {
      const sol = solveQueuing(queuingProblem);
      setQueuingSol(sol);
    } catch (err: unknown) {
      alert(`Queuing error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSolveGame = () => {
    try {
      const sol = solveZeroSumGame(gameProblem);
      setGameSol(sol);
    } catch (err: unknown) {
      alert(`Game Theory error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSolveLinearEq = () => {
    try {
      const sol = solveLinearEquations(linearEqA, linearEqB);
      setLinearEqSol(sol);
    } catch (err: unknown) {
      alert(`Linear Equations error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="flex-1 bg-canvas flex flex-col h-full overflow-hidden select-text">
      {/* Module Header Bar */}
      <div className="h-14 bg-surface-card border-b border-hairline px-6 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-editorial-serif text-2xl font-normal text-ink">
            TORA Optimization Suite
          </span>
          <span className="text-xs font-semibold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 ml-2">
            Hamdy A. Taha Models
          </span>
        </div>

        {/* Quick Textbook Problem Presets */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted mr-1">Textbook Presets:</span>
          <button
            onClick={loadRentCarPreset}
            className="text-xs bg-canvas hover:bg-surface-cream text-ink font-medium px-3 py-1.5 rounded-xl border border-hairline transition-colors shadow-2xs"
          >
            🚗 Rent Car Replacement
          </button>
          <button
            onClick={loadMidwestMstPreset}
            className="text-xs bg-canvas hover:bg-surface-cream text-ink font-medium px-3 py-1.5 rounded-xl border border-hairline transition-colors shadow-2xs"
          >
            🌐 Midwest Cable MST
          </button>
        </div>
      </div>

      {/* Main Workspace with Sidebar & Solvers */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left TORA Menu Sidebar (Original Taha Titles) */}
        <aside className="w-64 bg-surface-soft border-r border-hairline flex flex-col select-none shrink-0 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold text-muted uppercase tracking-wider">
            TORA Main Menu
          </div>

          {[
            { id: "linear-programming", name: "Linear Programming", icon: TrendingUp },
            { id: "transportation-assignment", name: "Transportation & Assignment", icon: Truck },
            { id: "network-models", name: "Network Models", icon: Network },
            { id: "project-planning", name: "Project Planning (CPM/PERT)", icon: Calendar },
            { id: "inventory-control", name: "Inventory Control (EOQ)", icon: Package },
            { id: "queuing-models", name: "Queuing Analysis", icon: Clock },
            { id: "zero-sum-games", name: "Zero-Sum Games", icon: Swords },
            { id: "linear-equations", name: "Linear Equations", icon: Calculator },
          ].map((m) => {
            const Icon = m.icon;
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id as OrModule)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl font-medium transition-colors text-left ${
                  isActive
                    ? "bg-surface-card text-ink font-semibold shadow-2xs border border-hairline text-primary"
                    : "text-body hover:bg-surface-cream"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted"}`} />
                <span>{m.name}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Module Solver Content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
          {/* ========================================== */}
          {/* 1. LINEAR PROGRAMMING (Taha Ch. 2 & 3)     */}
          {/* ========================================== */}
          {activeModule === "linear-programming" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Linear Programming
                  </h3>
                  <p className="text-xs text-muted">
                    Solve linear programs via 2D Graphical polygon analysis or Step-by-Step Simplex Tableaus.
                  </p>
                </div>

                <div className="flex items-center bg-surface-card border border-hairline p-1 rounded-xl">
                  <button
                    onClick={() => setLpMode("graphical-2d")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      lpMode === "graphical-2d" ? "bg-primary text-on-primary shadow-xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    2D Graphical Solver
                  </button>
                  <button
                    onClick={() => setLpMode("simplex-tableau")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      lpMode === "simplex-tableau" ? "bg-primary text-on-primary shadow-xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    Simplex Tableaus
                  </button>
                </div>
              </div>

              {/* Formulation Summary */}
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                    Model Formulation
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenInSql(`-- Linear Programming Problem (Hamdy A. Taha Ch. 2)
-- Maximize Z = 5*x1 + 4*x2
-- Constraints:
--   6*x1 + 4*x2 <= 24
--   1*x1 + 2*x2 <= 6
--  -1*x1 + 1*x2 <= 1
--   0*x1 + 1*x2 <= 2

CREATE TABLE IF NOT EXISTS lp_variables (
  var_name VARCHAR(10) PRIMARY KEY,
  optimal_value DOUBLE PRECISION,
  objective_coeff DOUBLE PRECISION
);

INSERT INTO lp_variables VALUES ('x1', 3.0, 5.0), ('x2', 1.5, 4.0);

SELECT 
  SUM(optimal_value * objective_coeff) AS optimal_objective_Z 
FROM lp_variables;`)}
                      className="flex items-center gap-1.5 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-3 py-2 rounded-xl border border-hairline transition-colors shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>Open in SQL</span>
                    </button>
                    <button
                      onClick={handleSolveLp}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Solve Linear Program</span>
                    </button>
                  </div>
                </div>
                <div className="p-3.5 bg-canvas border border-hairline rounded-xl font-mono text-xs text-ink space-y-1.5">
                  <p className="font-bold text-primary">Maximize Z = 5 x₁ + 4 x₂</p>
                  <p className="text-muted">Subject to:</p>
                  <p>6 x₁ + 4 x₂ ≤ 24</p>
                  <p>1 x₁ + 2 x₂ ≤ 6</p>
                  <p>-1 x₁ + 1 x₂ ≤ 1</p>
                  <p>0 x₁ + 1 x₂ ≤ 2</p>
                  <p>x₁, x₂ ≥ 0</p>
                </div>
              </div>

              {/* Graphical or Simplex Tableau Solution */}
              {lpSol && (
                <div className="space-y-4">
                  {lpMode === "graphical-2d" && lpSol.graphical ? (
                    <GraphicalLpCanvas solution={lpSol.graphical} />
                  ) : (
                    <SimplexTableauViewer tableaus={lpSol.tableaus} />
                  )}

                  {/* Dual Shadow Prices & Sensitivity */}
                  {lpSol.dualPrices && (
                    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                        Sensitivity & Dual Shadow Prices
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {lpSol.dualPrices.map((dp, idx) => (
                          <div key={idx} className="bg-canvas p-3 rounded-xl border border-hairline flex items-center justify-between text-xs">
                            <span className="font-medium text-body">{dp.constraint}</span>
                            <span className="font-mono font-bold text-primary">
                              Shadow Price: ${dp.shadowPrice}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 2. TRANSPORTATION & ASSIGNMENT (Taha Ch. 5) */}
          {/* ========================================== */}
          {activeModule === "transportation-assignment" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Transportation & Assignment Models
                  </h3>
                  <p className="text-xs text-muted">
                    Minimizes shipping costs using Vogel's Approximation Method (VAM) or Hungarian Assignment.
                  </p>
                </div>

                <div className="flex items-center bg-surface-card border border-hairline p-1 rounded-xl">
                  <button
                    onClick={() => setTransSubtype("transportation")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      transSubtype === "transportation" ? "bg-primary text-on-primary shadow-xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    Transportation Model (VAM)
                  </button>
                  <button
                    onClick={() => setTransSubtype("hungarian-assignment")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      transSubtype === "hungarian-assignment" ? "bg-primary text-on-primary shadow-xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    Hungarian Assignment
                  </button>
                </div>
              </div>

              {transSubtype === "transportation" ? (
                <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                      Transportation Shipping Matrix
                    </h4>
                    <button
                      onClick={handleSolveTransportation}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Solve Transportation</span>
                    </button>
                  </div>

                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className="p-2 font-semibold text-muted">Source \ Dest</th>
                        {transProblem.destinations.map((d) => (
                          <th key={d} className="p-2 font-semibold text-ink">{d}</th>
                        ))}
                        <th className="p-2 font-semibold text-primary">Supply</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transProblem.sources.map((s, r) => (
                        <tr key={s} className="border-b border-hairline-soft">
                          <td className="p-2 font-medium text-ink">{s}</td>
                          {transProblem.destinations.map((_, c) => (
                            <td key={c} className="p-2 font-mono text-body">
                              ${transProblem.costs[r][c]}
                            </td>
                          ))}
                          <td className="p-2 font-mono font-bold text-primary">{transProblem.supply[r]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {transSol && (
                    <div className="bg-surface-dark text-on-dark p-5 rounded-2xl border border-surface-dark-elevated space-y-3">
                      <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-2">
                        <span className="font-semibold text-base">Optimal Distribution Plan</span>
                        <span className="text-lg font-mono font-bold text-primary">
                          Total Minimum Cost: ${transSol.totalCost.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-on-dark-soft">
                        Computed via Vogel's Approximation Method (VAM) with 100% supply-demand balance.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                      Hungarian Assignment Cost Matrix
                    </h4>
                    <button
                      onClick={handleSolveAssignment}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Solve Hungarian Assignment</span>
                    </button>
                  </div>

                  <table className="w-full text-left border-collapse font-sans text-xs">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className="p-2 font-semibold text-muted">Worker \ Job</th>
                        {assignProblem.jobs.map((j) => (
                          <th key={j} className="p-2 font-semibold text-ink">{j}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assignProblem.workers.map((w, r) => (
                        <tr key={w} className="border-b border-hairline-soft">
                          <td className="p-2 font-medium text-ink">{w}</td>
                          {assignProblem.jobs.map((_, c) => (
                            <td key={c} className="p-2 font-mono text-body">
                              ${assignProblem.costs[r][c]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {assignSol && (
                    <div className="bg-surface-dark text-on-dark p-5 rounded-2xl border border-surface-dark-elevated space-y-4">
                      <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-2">
                        <span className="font-semibold text-base">Optimal One-to-One Matchings</span>
                        <span className="text-lg font-mono font-bold text-primary">
                          Total Assignment Cost: ${assignSol.totalCost}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {assignSol.assignments.map((a, i) => (
                          <div key={i} className="bg-surface-dark-soft p-3 rounded-xl border border-surface-dark-elevated flex items-center justify-between text-xs">
                            <span className="font-semibold text-on-dark">{a.worker} → {a.job}</span>
                            <span className="font-mono text-accent-teal font-bold">${a.cost}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 3. NETWORK MODELS (Taha Ch. 6)             */}
          {/* ========================================== */}
          {activeModule === "network-models" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Network Models
                  </h3>
                  <p className="text-xs text-muted">
                    Dijkstra Shortest Route, Kruskal/Prim Minimum Spanning Tree, and Maximal Flow.
                  </p>
                </div>

                <div className="flex items-center bg-surface-card border border-hairline p-1 rounded-xl">
                  <button
                    onClick={() => setNetworkSubtype("shortest-route")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      networkSubtype === "shortest-route" ? "bg-primary text-on-primary shadow-xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    Shortest Route
                  </button>
                  <button
                    onClick={() => setNetworkSubtype("minimum-spanning-tree")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      networkSubtype === "minimum-spanning-tree" ? "bg-primary text-on-primary shadow-xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    Minimum Spanning Tree
                  </button>
                  <button
                    onClick={() => setNetworkSubtype("maximal-flow")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      networkSubtype === "maximal-flow" ? "bg-primary text-on-primary shadow-xs" : "text-muted hover:text-ink"
                    }`}
                  >
                    Maximal Flow
                  </button>
                </div>
              </div>

              {/* Network Edges Input Card */}
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                    Network Topology ({networkEdges.length} Arcs)
                  </h4>
                  <button
                    onClick={handleSolveNetwork}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Solve Network</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto p-1">
                  {networkEdges.map((e, idx) => (
                    <div
                      key={idx}
                      className="bg-canvas border border-hairline p-2.5 rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-ink">
                        Node {e.from} ↔ Node {e.to}
                      </span>
                      <span className="font-mono text-primary font-bold bg-surface-soft px-2 py-0.5 rounded border border-hairline">
                        ${e.cost.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Solution Result Card */}
              {networkSol && (
                <div className="bg-surface-dark text-on-dark border border-surface-dark-elevated rounded-2xl p-6 shadow-md space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <h4 className="font-editorial-serif text-xl font-medium text-on-dark">
                        {networkSubtype === "shortest-route"
                          ? "Optimal Shortest Route"
                          : networkSubtype === "minimum-spanning-tree"
                          ? "Minimum Spanning Tree (MST)"
                          : "Maximal Flow"}
                      </h4>
                    </div>
                    <span className="text-lg font-mono font-bold text-primary">
                      Total: {networkSol.totalMetric.toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-on-dark-soft font-mono">
                    Sequence: <span className="text-on-dark font-bold">{networkSol.pathString}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 4. PROJECT PLANNING (CPM / PERT, Taha Ch. 6)*/}
          {/* ========================================== */}
          {activeModule === "project-planning" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Project Planning (CPM / PERT)
                  </h3>
                  <p className="text-xs text-muted">
                    Computes Critical Path, Earliest & Latest Start dates, Slack floats, and 3-Time PERT variances.
                  </p>
                </div>

                <button
                  onClick={handleSolveCpm}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Compute Critical Path</span>
                </button>
              </div>

              {cpmSol && (
                <div className="bg-surface-dark text-on-dark border border-surface-dark-elevated rounded-2xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-3">
                    <span className="font-semibold text-lg">
                      Critical Path: {cpmSol.criticalPath.join(" → ")}
                    </span>
                    <span className="text-lg font-mono font-bold text-primary">
                      Duration: {cpmSol.projectDuration} Weeks (σ = {cpmSol.projectStdDev})
                    </span>
                  </div>

                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-surface-dark-elevated text-on-dark-soft">
                        <th className="p-2">Activity</th>
                        <th className="p-2">Duration</th>
                        <th className="p-2">ES</th>
                        <th className="p-2">EF</th>
                        <th className="p-2">LS</th>
                        <th className="p-2">LF</th>
                        <th className="p-2">Slack</th>
                        <th className="p-2">Critical?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cpmSol.activities.map((a) => (
                        <tr
                          key={a.id}
                          className={`border-b border-surface-dark-elevated/40 ${
                            a.isCritical ? "bg-primary/10 text-primary font-bold" : "text-on-dark"
                          }`}
                        >
                          <td className="p-2">{a.id}</td>
                          <td className="p-2">{a.duration}</td>
                          <td className="p-2">{a.earlyStart}</td>
                          <td className="p-2">{a.earlyFinish}</td>
                          <td className="p-2">{a.lateStart}</td>
                          <td className="p-2">{a.lateFinish}</td>
                          <td className="p-2">{a.slack}</td>
                          <td className="p-2">{a.isCritical ? "YES ★" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 5. INVENTORY CONTROL (Taha Ch. 11 & 12)    */}
          {/* ========================================== */}
          {activeModule === "inventory-control" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Inventory Control (EOQ Models)
                  </h3>
                  <p className="text-xs text-muted">
                    Computes Economic Order Quantity (EOQ), optimal cycle time, and backorder shortage levels.
                  </p>
                </div>

                <button
                  onClick={handleSolveInventory}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Calculate EOQ</span>
                </button>
              </div>

              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-muted block mb-1">Annual Demand (D)</span>
                  <span className="font-mono font-bold text-ink text-base">{inventoryProblem.annualDemandD} units</span>
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Ordering Cost (K)</span>
                  <span className="font-mono font-bold text-ink text-base">${inventoryProblem.orderingCostK}/order</span>
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Holding Cost (h)</span>
                  <span className="font-mono font-bold text-ink text-base">${inventoryProblem.holdingCostH}/unit/yr</span>
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Unit Price (c)</span>
                  <span className="font-mono font-bold text-ink text-base">${inventoryProblem.unitPriceC}/unit</span>
                </div>
              </div>

              {inventorySol && (
                <div className="bg-surface-dark text-on-dark p-6 rounded-2xl border border-surface-dark-elevated grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Optimal EOQ (y*)</span>
                    <span className="font-mono text-2xl font-bold text-primary">{inventorySol.optimalOrderQtyY} units</span>
                  </div>
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Cycle Time (t₀)</span>
                    <span className="font-mono text-2xl font-bold text-accent-teal">{inventorySol.cycleTimeT0Days} days</span>
                  </div>
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Annual Holding</span>
                    <span className="font-mono text-2xl font-bold text-accent-amber">${inventorySol.annualHoldingCost}</span>
                  </div>
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Total Annual Cost</span>
                    <span className="font-mono text-2xl font-bold text-on-dark">${inventorySol.totalAnnualCost}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 6. QUEUING ANALYSIS (Taha Ch. 18)          */}
          {/* ========================================== */}
          {activeModule === "queuing-models" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Queuing Models
                  </h3>
                  <p className="text-xs text-muted">
                    Computes queue length (Lq), system length (Ls), waiting times, and server utilization (ρ).
                  </p>
                </div>

                <button
                  onClick={handleSolveQueuing}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Compute Queuing</span>
                </button>
              </div>

              {queuingSol && (
                <div className="bg-surface-dark text-on-dark border border-surface-dark-elevated rounded-2xl p-6 shadow-md space-y-4">
                  <h4 className="font-editorial-serif text-xl font-medium text-on-dark border-b border-surface-dark-elevated pb-3">
                    M/M/1 Steady-State Operating Characteristics
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-surface-dark-soft p-3.5 rounded-xl border border-surface-dark-elevated text-center">
                      <span className="text-xs text-on-dark-soft block mb-1">Utilization (ρ)</span>
                      <span className="font-mono text-xl font-bold text-accent-teal">{queuingSol.utilizationRho * 100}%</span>
                    </div>
                    <div className="bg-surface-dark-soft p-3.5 rounded-xl border border-surface-dark-elevated text-center">
                      <span className="text-xs text-on-dark-soft block mb-1">Avg in Queue (Lq)</span>
                      <span className="font-mono text-xl font-bold text-primary">{queuingSol.avgInQueueLq} units</span>
                    </div>
                    <div className="bg-surface-dark-soft p-3.5 rounded-xl border border-surface-dark-elevated text-center">
                      <span className="text-xs text-on-dark-soft block mb-1">Avg Wait (Wq)</span>
                      <span className="font-mono text-xl font-bold text-accent-amber">{queuingSol.avgWaitQueueWq} hrs</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 7. ZERO-SUM GAMES (Taha Ch. 15)            */}
          {/* ========================================== */}
          {activeModule === "zero-sum-games" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Zero-Sum Game Theory
                  </h3>
                  <p className="text-xs text-muted">
                    Evaluates Minimax / Maximin payoff matrices and identifies pure strategy saddle points.
                  </p>
                </div>

                <button
                  onClick={handleSolveGame}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Compute Game Value</span>
                </button>
              </div>

              {gameSol && (
                <div className="bg-surface-dark text-on-dark border border-surface-dark-elevated rounded-2xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <h4 className="font-editorial-serif text-xl font-medium text-on-dark">
                        {gameSol.hasSaddlePoint ? "Pure Strategy Saddle Point Found" : "Mixed Strategy Matrix"}
                      </h4>
                    </div>
                    <span className="text-lg font-mono font-bold text-primary">
                      Game Value: {gameSol.gameValue}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 8. LINEAR EQUATIONS (Taha App. A)          */}
          {/* ========================================== */}
          {activeModule === "linear-equations" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial-serif text-2xl font-medium text-ink mb-1">
                    Linear Equations
                  </h3>
                  <p className="text-xs text-muted">
                    Solves simultaneous linear systems of equations Ax = b via Gauss-Jordan elimination.
                  </p>
                </div>

                <button
                  onClick={handleSolveLinearEq}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Solve System Ax = b</span>
                </button>
              </div>

              {linearEqSol && (
                <div className="bg-surface-dark text-on-dark border border-surface-dark-elevated rounded-2xl p-6 shadow-md space-y-4">
                  <h4 className="font-editorial-serif text-xl font-medium text-on-dark border-b border-surface-dark-elevated pb-3">
                    Solution Vector x:
                  </h4>
                  <div className="flex gap-4">
                    {linearEqSol.map((val: number, idx: number) => (
                      <div
                        key={idx}
                        className="bg-surface-dark-soft p-3 rounded-xl border border-surface-dark-elevated font-mono text-base text-accent-teal font-bold"
                      >
                        x{idx + 1} = {val}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
