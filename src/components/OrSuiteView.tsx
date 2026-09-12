import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  CheckCircle2,
  Plus,
  Trash2,
  FileText,
  Sparkles,
  Camera,
  X,
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
import { extractNetworkEdges, parseOrQuestionTextWithAi } from "../services/ocr";

interface OrSuiteViewProps {
  onOpenInSql: (sql: string) => void;
  onAskAi?: (prompt: string) => void;
  onOpenOcr?: () => void;
  activeModule?: OrModule;
  importedOcrData?: {
    module: OrModule;
    networkSubtype?: NetworkSubtype;
    transSubtype?: TransSubtype;
    data?: any;
    rawText?: string;
  } | null;
}

export const OrSuiteView: React.FC<OrSuiteViewProps> = ({
  onOpenInSql,
  onAskAi,
  onOpenOcr,
  activeModule: controlledModule,
  importedOcrData,
}) => {
  const activeModule = controlledModule || "transportation-assignment";
  const [quickQuestionText, setQuickQuestionText] = useState("");
  const [isQuestionBoxExpanded, setIsQuestionBoxExpanded] = useState(false);
  const [isParsingText, setIsParsingText] = useState(false);
  const questionBoxRef = useRef<HTMLDivElement | null>(null);
  const [lpMode, setLpMode] = useState<LpSolveMode>("graphical-2d");
  const [networkSubtype, setNetworkSubtype] = useState<NetworkSubtype>("shortest-route");
  const [transSubtype, setTransSubtype] = useState<TransSubtype>("transportation");
  // 1. Transportation & Assignment State (Editable)
  // ==========================================
  const [transProblem, setTransProblem] = useState<TransportationProblem>({
    sources: ["Plant 1", "Plant 2", "Plant 3"],
    destinations: ["Market 1", "Market 2", "Market 3", "Market 4"],
    supply: [15, 25, 10],
    demand: [5, 15, 15, 15],
    costs: [
      [10, 2, 20, 11],
      [12, 7, 9, 20],
      [4, 14, 16, 18],
    ],
  });

  const [assignProblem, setAssignProblem] = useState<AssignmentProblem>({
    workers: ["Worker 1", "Worker 2", "Worker 3", "Worker 4"],
    jobs: ["Job A", "Job B", "Job C", "Job D"],
    costs: [
      [1, 4, 6, 3],
      [9, 7, 10, 9],
      [4, 5, 11, 7],
      [8, 7, 8, 5],
    ],
  });

  // ==========================================
  // 2. Linear Programming State (Editable)
  // ==========================================
  const [lpProblem, setLpProblem] = useState<LpProblem>({
    objective: "max",
    objectiveCoefficients: [5, 4],
    constraints: [
      { coefficients: [6, 4], operator: "<=", rhs: 24 },
      { coefficients: [1, 2], operator: "<=", rhs: 6 },
      { coefficients: [-1, 1], operator: "<=", rhs: 1 },
      { coefficients: [0, 1], operator: "<=", rhs: 2 },
    ],
    variableNames: ["x1", "x2"],
  });

  // ==========================================
  // 3. Network Models State (Editable)
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
  // 4. Project Planning State (Editable)
  // ==========================================
  const [cpmActivities, setCpmActivities] = useState<CpmActivity[]>([
    { id: "A", name: "Site Prep", predecessors: [], duration: 2, optimisticA: 1, mostLikelyM: 2, pessimisticB: 3 },
    { id: "B", name: "Foundation", predecessors: ["A"], duration: 4, optimisticA: 2, mostLikelyM: 4, pessimisticB: 6 },
    { id: "C", name: "Framing", predecessors: ["B"], duration: 10, optimisticA: 6, mostLikelyM: 10, pessimisticB: 14 },
    { id: "D", name: "Roofing", predecessors: ["C"], duration: 6, optimisticA: 4, mostLikelyM: 6, pessimisticB: 8 },
    { id: "E", name: "Electrical", predecessors: ["C"], duration: 4, optimisticA: 3, mostLikelyM: 4, pessimisticB: 5 },
    { id: "F", name: "Plumbing", predecessors: ["C"], duration: 5, optimisticA: 4, mostLikelyM: 5, pessimisticB: 6 },
    { id: "G", name: "Finish", predecessors: ["D", "E", "F"], duration: 7, optimisticA: 5, mostLikelyM: 7, pessimisticB: 9 },
  ]);

  // ==========================================
  // 5. Queuing Models State (Editable)
  // ==========================================
  const [queuingProblem, setQueuingProblem] = useState<QueuingProblem>({
    model: "M/M/1",
    arrivalRateLambda: 2,
    serviceRateMu: 3,
    serversCountC: 1,
  });

  // ==========================================
  // 6. Zero-Sum Games State (Editable)
  // ==========================================
  const [gameProblem, setGameProblem] = useState<ZeroSumGameProblem>({
    player1Strategies: ["A1", "A2", "A3"],
    player2Strategies: ["B1", "B2", "B3", "B4"],
    payoffMatrix: [
      [3, -1, 4, 2],
      [-1, -3, -7, 0],
      [4, 0, 6, 3],
    ],
  });

  // ==========================================
  // 7. Inventory Control State (Editable)
  // ==========================================
  const [inventoryProblem, setInventoryProblem] = useState<InventoryProblem>({
    model: "classic-eoq",
    annualDemandD: 1000,
    orderingCostK: 100,
    holdingCostH: 2,
    unitPriceC: 10,
    shortageCostP: 5,
  });

  // ==========================================
  // 8. Linear Equations State (Editable)
  // ==========================================
  const [linearEqA, setLinearEqA] = useState<number[][]>([
    [2, 1, -1],
    [-3, -1, 2],
    [-2, 1, 2],
  ]);
  const [linearEqB, setLinearEqB] = useState<number[]>([8, -11, -3]);

  // Solution State Outputs
  const [transSol, setTransSol] = useState<TransportationSolution | null>(null);
  const [assignSol, setAssignSol] = useState<AssignmentSolution | null>(null);
  const [lpSol, setLpSol] = useState<LpSolution | null>(null);
  const [networkSol, setNetworkSol] = useState<NetworkSolution | null>(null);
  const [cpmSol, setCpmSol] = useState<CpmSolution | null>(null);
  const [queuingSol, setQueuingSol] = useState<QueuingSolution | null>(null);
  const [gameSol, setGameSol] = useState<ZeroSumGameSolution | null>(null);
  const [inventorySol, setInventorySol] = useState<InventorySolution | null>(null);
  const [linearEqSol, setLinearEqSol] = useState<number[] | null>(null);


  // Auto-populate & Auto-solve on OCR Data Import
  useEffect(() => {
    if (importedOcrData) {
      const { module, networkSubtype: netSub, transSubtype: trSub, data, rawText } = importedOcrData;
      if (netSub) setNetworkSubtype(netSub);
      if (trSub) setTransSubtype(trSub);

      if (module === "network-models" || netSub) {
        let edges = data?.edges;
        let start = data?.startNode || "1";
        let end = data?.endNode || "5";

        if (!edges || edges.length === 0) {
          const extracted = extractNetworkEdges(rawText || "");
          edges = extracted.edges;
          start = extracted.startNode;
          end = extracted.endNode;
        }

        setNetworkEdges(edges);
        setNetStartNode(start);
        setNetEndNode(end);

        if (netSub === "minimum-spanning-tree") {
          const sol = solveNetworkMst(edges);
          setNetworkSol(sol);
        } else if (netSub === "maximal-flow") {
          const sol = solveNetworkMaxFlow(edges, start, end);
          setNetworkSol(sol);
        } else {
          const sol = solveNetworkShortestRoute(edges, start, end);
          setNetworkSol(sol);
        }
      }

      if (module === "transportation-assignment") {
        if (trSub === "hungarian-assignment") {
          const nextAssign = data?.assign ? { ...assignProblem, ...data.assign } : assignProblem;
          setAssignProblem(nextAssign);
          try {
            const sol = solveHungarianAssignment(nextAssign);
            setAssignSol(sol);
          } catch {}
        } else {
          const nextTrans = data?.trans ? { ...transProblem, ...data.trans } : transProblem;
          setTransProblem(nextTrans);
          try {
            const sol = solveTransportation(nextTrans);
            setTransSol(sol);
          } catch {}
        }
      }

      if (module === "linear-programming") {
        const nextLp = data?.lp ? { ...lpProblem, ...data.lp } : lpProblem;
        setLpProblem(nextLp);
        try {
          const sol = solveLinearProgramming(nextLp);
          setLpSol(sol);
        } catch {}
      }

      if (module === "project-planning") {
        const nextCpm = data?.cpm && data.cpm.length > 0 ? data.cpm : cpmActivities;
        setCpmActivities(nextCpm);
        try {
          const sol = solveCpmPert(nextCpm);
          setCpmSol(sol);
        } catch {}
      }

      if (module === "inventory-control") {
        const nextInv = data?.inventory ? { ...inventoryProblem, ...data.inventory } : inventoryProblem;
        setInventoryProblem(nextInv);
        try {
          const sol = solveInventoryControl(nextInv);
          setInventorySol(sol);
        } catch {}
      }

      if (module === "queuing-models") {
        const nextQ = data?.queuing ? { ...queuingProblem, ...data.queuing } : queuingProblem;
        setQueuingProblem(nextQ);
        try {
          const sol = solveQueuing(nextQ);
          setQueuingSol(sol);
        } catch {}
      }

      if (module === "zero-sum-games") {
        const nextG = data?.game ? { ...gameProblem, ...data.game } : gameProblem;
        setGameProblem(nextG);
        try {
          const sol = solveZeroSumGame(nextG);
          setGameSol(sol);
        } catch {}
      }
    }
  }, [importedOcrData]);

  // Handle click outside to collapse expanded question box when empty
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (questionBoxRef.current && !questionBoxRef.current.contains(e.target as Node)) {
        if (!quickQuestionText.trim()) {
          setIsQuestionBoxExpanded(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [quickQuestionText]);

  const handleQuickQuestionSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickQuestionText.trim() || isParsingText) return;

    setIsParsingText(true);
    try {
      const classification = await parseOrQuestionTextWithAi(quickQuestionText);
      const { detectedModule, networkSubtype: netSub, transSubtype: trSub, parsedData } = classification;

      if (netSub) setNetworkSubtype(netSub);
      if (trSub) setTransSubtype(trSub);

      if (detectedModule === "network-models" || netSub) {
        let edges = parsedData?.edges;
        let start = parsedData?.startNode || "1";
        let end = parsedData?.endNode || "5";

        if (!edges || edges.length === 0) {
          const extracted = extractNetworkEdges(quickQuestionText);
          edges = extracted.edges;
          start = extracted.startNode;
          end = extracted.endNode;
        }

        setNetworkEdges(edges);
        setNetStartNode(start);
        setNetEndNode(end);

        if (netSub === "minimum-spanning-tree") {
          const sol = solveNetworkMst(edges);
          setNetworkSol(sol);
        } else if (netSub === "maximal-flow") {
          const sol = solveNetworkMaxFlow(edges, start, end);
          setNetworkSol(sol);
        } else {
          const sol = solveNetworkShortestRoute(edges, start, end);
          setNetworkSol(sol);
        }
      }

      if (detectedModule === "transportation-assignment") {
        if (trSub === "hungarian-assignment") {
          const nextAssign = parsedData?.assign ? { ...assignProblem, ...parsedData.assign } : assignProblem;
          setAssignProblem(nextAssign);
          try {
            const sol = solveHungarianAssignment(nextAssign);
            setAssignSol(sol);
          } catch {}
        } else {
          const nextTrans = parsedData?.trans ? { ...transProblem, ...parsedData.trans } : transProblem;
          setTransProblem(nextTrans);
          try {
            const sol = solveTransportation(nextTrans);
            setTransSol(sol);
          } catch {}
        }
      }

      if (detectedModule === "linear-programming") {
        const nextLp = parsedData?.lp ? { ...lpProblem, ...parsedData.lp } : lpProblem;
        setLpProblem(nextLp);
        try {
          const sol = solveLinearProgramming(nextLp);
          setLpSol(sol);
        } catch {}
      }

      if (detectedModule === "project-planning") {
        const nextCpm = parsedData?.cpm && parsedData.cpm.length > 0 ? parsedData.cpm : cpmActivities;
        setCpmActivities(nextCpm);
        try {
          const sol = solveCpmPert(nextCpm);
          setCpmSol(sol);
        } catch {}
      }

      if (detectedModule === "inventory-control") {
        const nextInv = parsedData?.inventory ? { ...inventoryProblem, ...parsedData.inventory } : inventoryProblem;
        setInventoryProblem(nextInv);
        try {
          const sol = solveInventoryControl(nextInv);
          setInventorySol(sol);
        } catch {}
      }

      if (detectedModule === "queuing-models") {
        const nextQ = parsedData?.queuing ? { ...queuingProblem, ...parsedData.queuing } : queuingProblem;
        setQueuingProblem(nextQ);
        try {
          const sol = solveQueuing(nextQ);
          setQueuingSol(sol);
        } catch {}
      }

      if (detectedModule === "zero-sum-games") {
        const nextG = parsedData?.game ? { ...gameProblem, ...parsedData.game } : gameProblem;
        setGameProblem(nextG);
        try {
          const sol = solveZeroSumGame(nextG);
          setGameSol(sol);
        } catch {}
      }

      setQuickQuestionText("");
    } finally {
      setIsParsingText(false);
    }
  };
  const updateTransCost = (r: number, c: number, val: number) => {
    const nextCosts = transProblem.costs.map((row, ri) =>
      row.map((cell, ci) => (ri === r && ci === c ? val : cell))
    );
    setTransProblem({ ...transProblem, costs: nextCosts });
  };

  const updateTransSupply = (r: number, val: number) => {
    const nextSupply = [...transProblem.supply];
    nextSupply[r] = val;
    setTransProblem({ ...transProblem, supply: nextSupply });
  };

  const updateTransDemand = (c: number, val: number) => {
    const nextDemand = [...transProblem.demand];
    nextDemand[c] = val;
    setTransProblem({ ...transProblem, demand: nextDemand });
  };

  const updateTransSourceName = (r: number, name: string) => {
    const nextSources = [...transProblem.sources];
    nextSources[r] = name;
    setTransProblem({ ...transProblem, sources: nextSources });
  };

  const updateTransDestName = (c: number, name: string) => {
    const nextDests = [...transProblem.destinations];
    nextDests[c] = name;
    setTransProblem({ ...transProblem, destinations: nextDests });
  };

  const addTransSource = () => {
    const idx = transProblem.sources.length + 1;
    const nextSources = [...transProblem.sources, `Plant ${idx}`];
    const nextSupply = [...transProblem.supply, 10];
    const nextCosts = [...transProblem.costs, Array(transProblem.destinations.length).fill(10)];
    setTransProblem({
      ...transProblem,
      sources: nextSources,
      supply: nextSupply,
      costs: nextCosts,
    });
  };

  const removeTransSource = (r: number) => {
    if (transProblem.sources.length <= 1) return;
    const nextSources = transProblem.sources.filter((_, idx) => idx !== r);
    const nextSupply = transProblem.supply.filter((_, idx) => idx !== r);
    const nextCosts = transProblem.costs.filter((_, idx) => idx !== r);
    setTransProblem({
      ...transProblem,
      sources: nextSources,
      supply: nextSupply,
      costs: nextCosts,
    });
  };

  const addTransDestination = () => {
    const idx = transProblem.destinations.length + 1;
    const nextDests = [...transProblem.destinations, `Market ${idx}`];
    const nextDemand = [...transProblem.demand, 10];
    const nextCosts = transProblem.costs.map((row) => [...row, 10]);
    setTransProblem({
      ...transProblem,
      destinations: nextDests,
      demand: nextDemand,
      costs: nextCosts,
    });
  };

  const removeTransDestination = (c: number) => {
    if (transProblem.destinations.length <= 1) return;
    const nextDests = transProblem.destinations.filter((_, idx) => idx !== c);
    const nextDemand = transProblem.demand.filter((_, idx) => idx !== c);
    const nextCosts = transProblem.costs.map((row) => row.filter((_, idx) => idx !== c));
    setTransProblem({
      ...transProblem,
      destinations: nextDests,
      demand: nextDemand,
      costs: nextCosts,
    });
  };

  // ==========================================
  // Hungarian Assignment Modifiers
  // ==========================================
  const updateAssignCost = (r: number, c: number, val: number) => {
    const nextCosts = assignProblem.costs.map((row, ri) =>
      row.map((cell, ci) => (ri === r && ci === c ? val : cell))
    );
    setAssignProblem({ ...assignProblem, costs: nextCosts });
  };

  const updateAssignWorker = (r: number, name: string) => {
    const next = [...assignProblem.workers];
    next[r] = name;
    setAssignProblem({ ...assignProblem, workers: next });
  };

  const updateAssignJob = (c: number, name: string) => {
    const next = [...assignProblem.jobs];
    next[c] = name;
    setAssignProblem({ ...assignProblem, jobs: next });
  };

  const addAssignRowCol = () => {
    const idx = assignProblem.workers.length + 1;
    const nextWorkers = [...assignProblem.workers, `Worker ${idx}`];
    const nextJobs = [...assignProblem.jobs, `Job ${String.fromCharCode(64 + idx)}`];
    const nextCosts = assignProblem.costs.map((row) => [...row, 5]);
    nextCosts.push(Array(nextJobs.length).fill(5));
    setAssignProblem({
      workers: nextWorkers,
      jobs: nextJobs,
      costs: nextCosts,
    });
  };

  const removeAssignRowCol = () => {
    if (assignProblem.workers.length <= 2) return;
    const nextWorkers = assignProblem.workers.slice(0, -1);
    const nextJobs = assignProblem.jobs.slice(0, -1);
    const nextCosts = assignProblem.costs
      .slice(0, -1)
      .map((row) => row.slice(0, -1));
    setAssignProblem({
      workers: nextWorkers,
      jobs: nextJobs,
      costs: nextCosts,
    });
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
      <div className="h-14 bg-surface-card border-b border-hairline px-4 flex items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-editorial-serif text-xl font-normal text-ink">
            TORA Optimization Suite
          </span>
        </div>

        {/* Auto-Expanding Question Chatbox / Markdown Bar */}
        <div ref={questionBoxRef} className="relative flex-1 max-w-xl z-30">
          {!isQuestionBoxExpanded ? (
            <div
              onClick={() => setIsQuestionBoxExpanded(true)}
              className="w-full bg-canvas hover:bg-surface-cream/70 border border-hairline hover:border-primary/40 text-xs text-muted rounded-xl pl-3 pr-2.5 py-1.5 cursor-pointer flex items-center justify-between transition-all shadow-2xs group"
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate text-ink">
                  {quickQuestionText || "Enter question in plain text or markdown..."}
                </span>
              </div>
              <span className="text-[10px] text-primary font-semibold shrink-0 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                Type / Paste
              </span>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                handleQuickQuestionSubmit(e);
                setIsQuestionBoxExpanded(false);
              }}
              className="absolute left-0 top-0 w-full bg-surface-card border border-primary/40 rounded-2xl shadow-2xl p-3 space-y-2.5 animate-in fade-in duration-100 ring-2 ring-primary/20"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted uppercase tracking-wider pb-1 border-b border-hairline">
                <div className="flex items-center gap-1.5 text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Problem Question / Markdown Input</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuestionBoxExpanded(false)}
                  className="text-muted hover:text-ink p-0.5 rounded hover:bg-surface-soft"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <textarea
                autoFocus
                rows={4}
                value={quickQuestionText}
                onChange={(e) => setQuickQuestionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleQuickQuestionSubmit();
                    setIsQuestionBoxExpanded(false);
                  }
                  if (e.key === "Escape") {
                    setIsQuestionBoxExpanded(false);
                  }
                }}
                placeholder="Paste or type complete problem statement, table data, or markdown here (e.g. 'A company named Rent Car is developing a replacement policy...'). Press ⌘+Enter to solve."
                className="w-full bg-canvas border border-hairline rounded-xl p-2.5 text-xs text-ink placeholder:text-muted focus:border-primary outline-none transition-colors font-sans leading-relaxed resize-y max-h-60"
              />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-[10px] text-muted-soft">
                  <kbd className="font-mono bg-canvas px-1.5 py-0.5 rounded border border-hairline text-ink">⌘ + Enter</kbd>
                  <span>to Parse & Solve</span>
                </div>

                <div className="flex items-center gap-2">
                  {quickQuestionText && (
                    <button
                      type="button"
                      onClick={() => setQuickQuestionText("")}
                      className="text-[11px] text-muted hover:text-ink px-2 py-1 rounded transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!quickQuestionText.trim() || isParsingText}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors shadow-xs"
                  >
                    <Play className={`w-3 h-3 fill-current ${isParsingText ? "animate-spin" : ""}`} />
                    <span>{isParsingText ? "AI Parsing..." : "Parse & Solve ✨"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* OCR Scan Button */}
        {onOpenOcr && (
          <button
            onClick={onOpenOcr}
            className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors shadow-2xs shrink-0"
            title="Upload photo of paper question for OCR & Vision parsing"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>OCR Scan Image</span>
          </button>
        )}
      </div>
        {/* Right Module Solver Content */}
        <main className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
          {/* ========================================== */}
          {/* 1. TRANSPORTATION & ASSIGNMENT             */}
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
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                        Transportation Shipping Matrix (Editable)
                      </h4>
                      <span className="text-[11px] text-muted">
                        Click any cell, supply, or demand value to edit.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {onAskAi && (
                        <button
                          onClick={() =>
                            onAskAi(
                              `Analyze this Transportation Shipping Matrix: 3 Plants with supply [${transProblem.supply.join(
                                ", "
                              )}] and 4 Markets with demand [${transProblem.demand.join(
                                ", "
                              )}]. Total optimal shipping cost is $${
                                transSol?.totalCost || 455
                              }. How can we reduce bottleneck lane costs or improve throughput?`
                            )
                          }
                          className="flex items-center gap-1 bg-surface-card hover:bg-surface-cream text-primary text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Ask AI Advisor</span>
                        </button>
                      )}
                      <button
                        onClick={() =>
                          onOpenInSql(`-- Transportation Model
-- Total Supply: ${transProblem.supply.reduce((a, b) => a + b, 0)} | Total Demand: ${transProblem.demand.reduce((a, b) => a + b, 0)}

CREATE TABLE IF NOT EXISTS transportation_costs (
  source_name VARCHAR(50),
  destination_name VARCHAR(50),
  unit_cost DOUBLE PRECISION,
  PRIMARY KEY (source_name, destination_name)
);

-- Sample shipping route costs
INSERT OR REPLACE INTO transportation_costs VALUES
${transProblem.sources
  .map((s, r) =>
    transProblem.destinations
      .map((d, c) => `  ('${s}', '${d}', ${transProblem.costs[r][c]})`)
      .join(",\n")
  )
  .join(",\n")};

SELECT * FROM transportation_costs ORDER BY unit_cost ASC;`)
                        }
                        className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span>Save to SQL</span>
                      </button>
                      <button
                        onClick={addTransSource}
                        className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        <span>Add Source</span>
                      </button>
                      <button
                        onClick={addTransDestination}
                        className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        <span>Add Dest</span>
                      </button>
                      <button
                        onClick={handleSolveTransportation}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors shadow-2xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Solve Transportation</span>
                      </button>
                    </div>
                  </div>

                  {/* Editable Transportation Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="border-b border-hairline">
                          <th className="p-2 font-semibold text-muted w-36">Source \ Dest</th>
                          {transProblem.destinations.map((d, c) => (
                            <th key={c} className="p-2 font-semibold text-ink">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={d}
                                  onChange={(e) => updateTransDestName(c, e.target.value)}
                                  className="bg-canvas border border-hairline rounded-md px-2 py-1 text-xs font-semibold text-ink w-24 text-center focus:outline-none focus:border-primary"
                                />
                                {transProblem.destinations.length > 1 && (
                                  <button
                                    onClick={() => removeTransDestination(c)}
                                    title="Remove Destination"
                                    className="text-muted hover:text-error p-0.5 rounded transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </th>
                          ))}
                          <th className="p-2 font-semibold text-primary w-28">Supply</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transProblem.sources.map((s, r) => (
                          <tr key={r} className="border-b border-hairline-soft">
                            <td className="p-2 font-medium text-ink">
                              <input
                                type="text"
                                value={s}
                                onChange={(e) => updateTransSourceName(r, e.target.value)}
                                className="bg-canvas border border-hairline rounded-md px-2 py-1 text-xs font-medium text-ink w-32 focus:outline-none focus:border-primary"
                              />
                            </td>
                            {transProblem.destinations.map((_, c) => (
                              <td key={c} className="p-2">
                                <div className="relative flex items-center">
                                  <span className="absolute left-2 text-muted text-xs">$</span>
                                  <input
                                    type="number"
                                    value={transProblem.costs[r][c]}
                                    onChange={(e) =>
                                      updateTransCost(r, c, parseFloat(e.target.value) || 0)
                                    }
                                    className="pl-5 pr-1.5 py-1 w-20 bg-canvas border border-hairline rounded-md text-xs font-mono text-ink focus:outline-none focus:border-primary text-right"
                                  />
                                </div>
                              </td>
                            ))}
                            <td className="p-2">
                              <input
                                type="number"
                                value={transProblem.supply[r]}
                                onChange={(e) =>
                                  updateTransSupply(r, parseFloat(e.target.value) || 0)
                                }
                                className="px-2 py-1 w-20 bg-primary/5 border border-primary/30 font-bold text-primary rounded-md text-xs font-mono focus:outline-none focus:border-primary text-right"
                              />
                            </td>
                            <td className="p-2">
                              {transProblem.sources.length > 1 && (
                                <button
                                  onClick={() => removeTransSource(r)}
                                  title="Remove Source Row"
                                  className="text-muted hover:text-error p-1 rounded transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}

                        {/* Demand Footer Row */}
                        <tr className="bg-surface-soft/60 font-semibold border-t-2 border-hairline">
                          <td className="p-2 text-primary">Demand</td>
                          {transProblem.destinations.map((_, c) => (
                            <td key={c} className="p-2">
                              <input
                                type="number"
                                value={transProblem.demand[c]}
                                onChange={(e) =>
                                  updateTransDemand(c, parseFloat(e.target.value) || 0)
                                }
                                className="px-2 py-1 w-20 bg-accent-teal/5 border border-accent-teal/30 font-bold text-accent-teal rounded-md text-xs font-mono focus:outline-none focus:border-primary text-right"
                              />
                            </td>
                          ))}
                          <td className="p-2 font-mono text-xs text-muted">
                            Total: {transProblem.supply.reduce((a, b) => a + b, 0)} / {transProblem.demand.reduce((a, b) => a + b, 0)}
                          </td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Solution Output */}
                  {transSol && (
                    <div className="bg-surface-dark text-on-dark p-5 rounded-2xl border border-surface-dark-elevated space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-2">
                        <span className="font-semibold text-base">Optimal Distribution Plan</span>
                        <span className="text-lg font-mono font-bold text-primary">
                          Total Minimum Cost: ${transSol.totalCost.toLocaleString()}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs">
                          <thead>
                            <tr className="text-on-dark-soft border-b border-surface-dark-elevated">
                              <th className="p-2">From Source \ To Dest</th>
                              {transProblem.destinations.map((d, c) => (
                                <th key={c} className="p-2">{d}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {transProblem.sources.map((s, r) => (
                              <tr key={r} className="border-b border-surface-dark-elevated/40">
                                <td className="p-2 font-semibold text-on-dark">{s}</td>
                                {transProblem.destinations.map((_, c) => {
                                  const alloc = transSol.allocations[r]?.[c] || 0;
                                  return (
                                    <td key={c} className="p-2">
                                      {alloc > 0 ? (
                                        <span className="bg-primary/20 text-primary font-bold px-2 py-0.5 rounded border border-primary/30">
                                          {alloc} units (${transProblem.costs[r][c] * alloc})
                                        </span>
                                      ) : (
                                        <span className="text-muted-soft">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                        Hungarian Assignment Cost Matrix (Editable)
                      </h4>
                      <span className="text-[11px] text-muted">
                        Edit worker names, job names, and assignment cost coefficients.
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={addAssignRowCol}
                        className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                        <span>Add Worker/Job</span>
                      </button>
                      <button
                        onClick={removeAssignRowCol}
                        className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-error" />
                        <span>Remove Size</span>
                      </button>
                      <button
                        onClick={handleSolveAssignment}
                        className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors shadow-2xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Solve Hungarian Assignment</span>
                      </button>
                    </div>
                  </div>

                  {/* Editable Hungarian Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="border-b border-hairline">
                          <th className="p-2 font-semibold text-muted w-36">Worker \ Job</th>
                          {assignProblem.jobs.map((j, c) => (
                            <th key={c} className="p-2 font-semibold text-ink">
                              <input
                                type="text"
                                value={j}
                                onChange={(e) => updateAssignJob(c, e.target.value)}
                                className="bg-canvas border border-hairline rounded-md px-2 py-1 text-xs font-semibold text-ink w-24 text-center focus:outline-none focus:border-primary"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {assignProblem.workers.map((w, r) => (
                          <tr key={r} className="border-b border-hairline-soft">
                            <td className="p-2 font-medium text-ink">
                              <input
                                type="text"
                                value={w}
                                onChange={(e) => updateAssignWorker(r, e.target.value)}
                                className="bg-canvas border border-hairline rounded-md px-2 py-1 text-xs font-medium text-ink w-32 focus:outline-none focus:border-primary"
                              />
                            </td>
                            {assignProblem.jobs.map((_, c) => (
                              <td key={c} className="p-2">
                                <div className="relative flex items-center">
                                  <span className="absolute left-2 text-muted text-xs">$</span>
                                  <input
                                    type="number"
                                    value={assignProblem.costs[r][c]}
                                    onChange={(e) =>
                                      updateAssignCost(r, c, parseFloat(e.target.value) || 0)
                                    }
                                    className="pl-5 pr-1.5 py-1 w-20 bg-canvas border border-hairline rounded-md text-xs font-mono text-ink focus:outline-none focus:border-primary text-right"
                                  />
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Solution Output */}
                  {assignSol && (
                    <div className="bg-surface-dark text-on-dark p-5 rounded-2xl border border-surface-dark-elevated space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-2">
                        <span className="font-semibold text-base">Optimal One-to-One Matchings</span>
                        <span className="text-lg font-mono font-bold text-primary">
                          Total Assignment Cost: ${assignSol.totalCost}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {assignSol.assignments.map((a, i) => (
                          <div
                            key={i}
                            className="bg-surface-dark-soft p-3 rounded-xl border border-surface-dark-elevated flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-on-dark">
                              {a.worker} → {a.job}
                            </span>
                            <span className="font-mono text-accent-teal font-bold">
                              ${a.cost}
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
          {/* 2. LINEAR PROGRAMMING                     */}
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

              {/* Formulation Summary (Editable) */}
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                    Model Formulation (Editable)
                  </h4>
                  <div className="flex items-center gap-2">
                    {onAskAi && (
                      <button
                        onClick={() =>
                          onAskAi(
                            `Analyze this Linear Program: Maximize Z = ${lpProblem.objectiveCoefficients[0]}*x1 + ${
                              lpProblem.objectiveCoefficients[1]
                            }*x2 subject to constraints. Current optimal objective Z* = ${
                              lpSol?.objectiveValue || 21
                            }. Explain binding constraints, shadow prices, and capacity investments.`
                          )
                        }
                        className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-primary text-xs font-semibold px-3 py-2 rounded-xl border border-hairline transition-colors shadow-2xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Ask AI Advisor</span>
                      </button>
                    )}
                    <button
                      onClick={() =>
                        onOpenInSql(`-- Linear Programming Formulation (Maximize Profit)
CREATE TABLE IF NOT EXISTS lp_variables (
  variable_name VARCHAR(10) PRIMARY KEY,
  optimal_units DOUBLE PRECISION,
  unit_profit DOUBLE PRECISION
);

INSERT OR REPLACE INTO lp_variables VALUES
  ('x1', ${lpSol?.variableValues.find((v) => v.name === "x1")?.value || 3.0}, ${lpProblem.objectiveCoefficients[0]}),
  ('x2', ${lpSol?.variableValues.find((v) => v.name === "x2")?.value || 1.5}, ${lpProblem.objectiveCoefficients[1]});

SELECT 
  variable_name,
  optimal_units,
  unit_profit,
  (optimal_units * unit_profit) AS total_revenue,
  (SELECT SUM(optimal_units * unit_profit) FROM lp_variables) AS optimal_Z
FROM lp_variables;`)
                      }
                      className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-3 py-2 rounded-xl border border-hairline transition-colors shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>Save to SQL</span>
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

                {/* Objective Function Input */}
                <div className="p-3 bg-canvas border border-hairline rounded-xl flex items-center gap-3 text-xs">
                  <span className="font-semibold text-muted">Objective:</span>
                  <select
                    value={lpProblem.objective}
                    onChange={(e) =>
                      setLpProblem({ ...lpProblem, objective: e.target.value as "max" | "min" })
                    }
                    className="bg-surface-card border border-hairline rounded-md px-2 py-1 text-xs font-semibold text-primary focus:outline-none"
                  >
                    <option value="max">Maximize Z =</option>
                    <option value="min">Minimize Z =</option>
                  </select>
                  <div className="flex items-center gap-2 font-mono">
                    <input
                      type="number"
                      value={lpProblem.objectiveCoefficients[0]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setLpProblem({
                          ...lpProblem,
                          objectiveCoefficients: [val, lpProblem.objectiveCoefficients[1]],
                        });
                      }}
                      className="w-16 px-2 py-1 bg-surface-card border border-hairline rounded-md text-right font-bold text-ink"
                    />
                    <span>x₁ +</span>
                    <input
                      type="number"
                      value={lpProblem.objectiveCoefficients[1]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setLpProblem({
                          ...lpProblem,
                          objectiveCoefficients: [lpProblem.objectiveCoefficients[0], val],
                        });
                      }}
                      className="w-16 px-2 py-1 bg-surface-card border border-hairline rounded-md text-right font-bold text-ink"
                    />
                    <span>x₂</span>
                  </div>
                </div>

                {/* Constraints Inputs */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted uppercase">
                    Subject to Constraints:
                  </span>
                  {lpProblem.constraints.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-canvas border border-hairline rounded-xl flex items-center gap-2 text-xs font-mono"
                    >
                      <span className="text-muted w-8">C{idx + 1}:</span>
                      <input
                        type="number"
                        value={c.coefficients[0] || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const next = [...lpProblem.constraints];
                          next[idx] = { ...next[idx], coefficients: [val, next[idx].coefficients[1] || 0] };
                          setLpProblem({ ...lpProblem, constraints: next });
                        }}
                        className="w-16 px-2 py-1 bg-surface-card border border-hairline rounded-md text-right text-ink"
                      />
                      <span>x₁ +</span>
                      <input
                        type="number"
                        value={c.coefficients[1] || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const next = [...lpProblem.constraints];
                          next[idx] = { ...next[idx], coefficients: [next[idx].coefficients[0] || 0, val] };
                          setLpProblem({ ...lpProblem, constraints: next });
                        }}
                        className="w-16 px-2 py-1 bg-surface-card border border-hairline rounded-md text-right text-ink"
                      />
                      <span>x₂</span>
                      <select
                        value={c.operator}
                        onChange={(e) => {
                          const next = [...lpProblem.constraints];
                          next[idx] = { ...next[idx], operator: e.target.value as "<=" | ">=" | "=" };
                          setLpProblem({ ...lpProblem, constraints: next });
                        }}
                        className="bg-surface-card border border-hairline rounded-md px-2 py-1 font-semibold text-primary"
                      >
                        <option value="<=">≤</option>
                        <option value=">=">≥</option>
                        <option value="=">=</option>
                      </select>
                      <input
                        type="number"
                        value={c.rhs}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const next = [...lpProblem.constraints];
                          next[idx] = { ...next[idx], rhs: val };
                          setLpProblem({ ...lpProblem, constraints: next });
                        }}
                        className="w-20 px-2 py-1 bg-surface-card border border-hairline rounded-md text-right font-bold text-ink"
                      />
                    </div>
                  ))}
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
                          <div
                            key={idx}
                            className="bg-canvas p-3 rounded-xl border border-hairline flex items-center justify-between text-xs"
                          >
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
          {/* 3. NETWORK MODELS                         */}
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

              {/* Network Edges Input Card (Editable) */}
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                      Network Topology ({networkEdges.length} Arcs)
                    </h4>
                    {networkSubtype !== "minimum-spanning-tree" && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted">Start:</span>
                        <input
                          type="text"
                          value={netStartNode}
                          onChange={(e) => setNetStartNode(e.target.value)}
                          className="w-12 px-2 py-0.5 bg-canvas border border-hairline rounded text-center font-bold text-ink"
                        />
                        <span className="text-muted">End:</span>
                        <input
                          type="text"
                          value={netEndNode}
                          onChange={(e) => setNetEndNode(e.target.value)}
                          className="w-12 px-2 py-0.5 bg-canvas border border-hairline rounded text-center font-bold text-ink"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setNetworkEdges([
                          ...networkEdges,
                          { from: networkEdges.length + 1, to: networkEdges.length + 2, cost: 500 },
                        ])
                      }
                      className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span>Add Arc</span>
                    </button>
                    <button
                      onClick={handleSolveNetwork}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Solve Network</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-56 overflow-y-auto p-1">
                  {networkEdges.map((e, idx) => (
                    <div
                      key={idx}
                      className="bg-canvas border border-hairline p-2 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={e.from}
                          onChange={(ev) => {
                            const next = [...networkEdges];
                            next[idx] = { ...next[idx], from: ev.target.value };
                            setNetworkEdges(next);
                          }}
                          className="w-10 px-1 py-0.5 bg-surface-card border border-hairline rounded text-center font-bold text-ink"
                        />
                        <span>↔</span>
                        <input
                          type="text"
                          value={e.to}
                          onChange={(ev) => {
                            const next = [...networkEdges];
                            next[idx] = { ...next[idx], to: ev.target.value };
                            setNetworkEdges(next);
                          }}
                          className="w-10 px-1 py-0.5 bg-surface-card border border-hairline rounded text-center font-bold text-ink"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={e.cost}
                          onChange={(ev) => {
                            const next = [...networkEdges];
                            next[idx] = { ...next[idx], cost: parseFloat(ev.target.value) || 0 };
                            setNetworkEdges(next);
                          }}
                          className="w-16 px-1.5 py-0.5 bg-surface-card border border-hairline rounded text-right font-mono font-bold text-primary"
                        />
                        <button
                          onClick={() => setNetworkEdges(networkEdges.filter((_, i) => i !== idx))}
                          className="text-muted hover:text-error p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
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
          {/* 4. PROJECT PLANNING (CPM / PERT)          */}
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCpmActivities([
                        ...cpmActivities,
                        {
                          id: String.fromCharCode(65 + cpmActivities.length),
                          name: "New Activity",
                          predecessors: [cpmActivities[cpmActivities.length - 1]?.id || ""],
                          duration: 5,
                        },
                      ])
                    }
                    className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    <span>Add Activity</span>
                  </button>
                  <button
                    onClick={handleSolveCpm}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Compute Critical Path</span>
                  </button>
                </div>
              </div>

              {/* Editable Activities Table */}
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                  Activity Network Specification (Editable)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="border-b border-hairline text-muted">
                        <th className="p-2 w-16">ID</th>
                        <th className="p-2">Name</th>
                        <th className="p-2 w-32">Predecessors</th>
                        <th className="p-2 w-24">Duration</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cpmActivities.map((a, idx) => (
                        <tr key={idx} className="border-b border-hairline-soft">
                          <td className="p-2">
                            <input
                              type="text"
                              value={a.id}
                              onChange={(e) => {
                                const next = [...cpmActivities];
                                next[idx] = { ...next[idx], id: e.target.value };
                                setCpmActivities(next);
                              }}
                              className="w-12 px-2 py-1 bg-canvas border border-hairline rounded font-bold text-center text-ink"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={a.name}
                              onChange={(e) => {
                                const next = [...cpmActivities];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setCpmActivities(next);
                              }}
                              className="w-full px-2 py-1 bg-canvas border border-hairline rounded text-ink"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={(a.predecessors || []).join(", ")}
                              onChange={(e) => {
                                const next = [...cpmActivities];
                                next[idx] = {
                                  ...next[idx],
                                  predecessors: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                };
                                setCpmActivities(next);
                              }}
                              placeholder="e.g. A, B"
                              className="w-28 px-2 py-1 bg-canvas border border-hairline rounded text-ink font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={a.duration}
                              onChange={(e) => {
                                const next = [...cpmActivities];
                                next[idx] = {
                                  ...next[idx],
                                  duration: parseFloat(e.target.value) || 0,
                                };
                                setCpmActivities(next);
                              }}
                              className="w-20 px-2 py-1 bg-canvas border border-hairline rounded text-right font-mono font-bold text-primary"
                            />
                          </td>
                          <td className="p-2">
                            <button
                              onClick={() => setCpmActivities(cpmActivities.filter((_, i) => i !== idx))}
                              className="text-muted hover:text-error p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
          {/* 5. INVENTORY CONTROL (EOQ)                */}
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
                  <input
                    type="number"
                    value={inventoryProblem.annualDemandD}
                    onChange={(e) =>
                      setInventoryProblem({
                        ...inventoryProblem,
                        annualDemandD: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-canvas border border-hairline rounded-lg font-mono font-bold text-ink"
                  />
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Ordering Cost (K)</span>
                  <input
                    type="number"
                    value={inventoryProblem.orderingCostK}
                    onChange={(e) =>
                      setInventoryProblem({
                        ...inventoryProblem,
                        orderingCostK: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-canvas border border-hairline rounded-lg font-mono font-bold text-ink"
                  />
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Holding Cost (h)</span>
                  <input
                    type="number"
                    value={inventoryProblem.holdingCostH}
                    onChange={(e) =>
                      setInventoryProblem({
                        ...inventoryProblem,
                        holdingCostH: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-canvas border border-hairline rounded-lg font-mono font-bold text-ink"
                  />
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Unit Price (c)</span>
                  <input
                    type="number"
                    value={inventoryProblem.unitPriceC}
                    onChange={(e) =>
                      setInventoryProblem({
                        ...inventoryProblem,
                        unitPriceC: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-canvas border border-hairline rounded-lg font-mono font-bold text-ink"
                  />
                </div>
              </div>

              {inventorySol && (
                <div className="bg-surface-dark text-on-dark p-6 rounded-2xl border border-surface-dark-elevated grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Optimal EOQ (y*)</span>
                    <span className="font-mono text-2xl font-bold text-primary">
                      {inventorySol.optimalOrderQtyY} units
                    </span>
                  </div>
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Cycle Time (t₀)</span>
                    <span className="font-mono text-2xl font-bold text-accent-teal">
                      {inventorySol.cycleTimeT0Days} days
                    </span>
                  </div>
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Annual Holding</span>
                    <span className="font-mono text-2xl font-bold text-accent-amber">
                      ${inventorySol.annualHoldingCost}
                    </span>
                  </div>
                  <div className="bg-surface-dark-soft p-4 rounded-xl border border-surface-dark-elevated text-center">
                    <span className="text-xs text-on-dark-soft block mb-1">Total Annual Cost</span>
                    <span className="font-mono text-2xl font-bold text-on-dark">
                      ${inventorySol.totalAnnualCost}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 6. QUEUING ANALYSIS (M/M/1 & M/M/c)       */}
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

              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-muted block mb-1">Arrival Rate (λ arrivals/hr)</span>
                  <input
                    type="number"
                    value={queuingProblem.arrivalRateLambda}
                    onChange={(e) =>
                      setQueuingProblem({
                        ...queuingProblem,
                        arrivalRateLambda: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-canvas border border-hairline rounded-lg font-mono font-bold text-ink"
                  />
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Service Rate (μ services/hr)</span>
                  <input
                    type="number"
                    value={queuingProblem.serviceRateMu}
                    onChange={(e) =>
                      setQueuingProblem({
                        ...queuingProblem,
                        serviceRateMu: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-canvas border border-hairline rounded-lg font-mono font-bold text-ink"
                  />
                </div>
                <div>
                  <span className="font-semibold text-muted block mb-1">Number of Servers (c)</span>
                  <input
                    type="number"
                    value={queuingProblem.serversCountC || 1}
                    onChange={(e) =>
                      setQueuingProblem({
                        ...queuingProblem,
                        serversCountC: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-1.5 bg-canvas border border-hairline rounded-lg font-mono font-bold text-ink"
                  />
                </div>
              </div>

              {queuingSol && (
                <div className="bg-surface-dark text-on-dark border border-surface-dark-elevated rounded-2xl p-6 shadow-md space-y-4">
                  <h4 className="font-editorial-serif text-xl font-medium text-on-dark border-b border-surface-dark-elevated pb-3">
                    Steady-State Operating Characteristics
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-surface-dark-soft p-3.5 rounded-xl border border-surface-dark-elevated text-center">
                      <span className="text-xs text-on-dark-soft block mb-1">Utilization (ρ)</span>
                      <span className="font-mono text-xl font-bold text-accent-teal">
                        {Math.round(queuingSol.utilizationRho * 1000) / 10}%
                      </span>
                    </div>
                    <div className="bg-surface-dark-soft p-3.5 rounded-xl border border-surface-dark-elevated text-center">
                      <span className="text-xs text-on-dark-soft block mb-1">Avg in Queue (Lq)</span>
                      <span className="font-mono text-xl font-bold text-primary">
                        {queuingSol.avgInQueueLq} units
                      </span>
                    </div>
                    <div className="bg-surface-dark-soft p-3.5 rounded-xl border border-surface-dark-elevated text-center">
                      <span className="text-xs text-on-dark-soft block mb-1">Avg Wait (Wq)</span>
                      <span className="font-mono text-xl font-bold text-accent-amber">
                        {queuingSol.avgWaitQueueWq} hrs
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* 7. ZERO-SUM GAMES                         */}
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

              {/* Editable Payoff Matrix */}
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                  Payoff Matrix (Player 1 vs Player 2)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className="p-2 text-muted">P1 \ P2</th>
                        {gameProblem.player2Strategies.map((s, c) => (
                          <th key={c} className="p-2 font-semibold text-ink text-center">
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gameProblem.player1Strategies.map((rName, r) => (
                        <tr key={r} className="border-b border-hairline-soft">
                          <td className="p-2 font-semibold text-ink">{rName}</td>
                          {gameProblem.player2Strategies.map((_, c) => (
                            <td key={c} className="p-2 text-center">
                              <input
                                type="number"
                                value={gameProblem.payoffMatrix[r][c]}
                                onChange={(e) => {
                                  const next = gameProblem.payoffMatrix.map((row, ri) =>
                                    row.map((cell, ci) =>
                                      ri === r && ci === c ? parseFloat(e.target.value) || 0 : cell
                                    )
                                  );
                                  setGameProblem({ ...gameProblem, payoffMatrix: next });
                                }}
                                className="w-16 px-2 py-1 bg-canvas border border-hairline rounded-md text-right font-mono font-bold text-ink text-center"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {gameSol && (
                <div className="bg-surface-dark text-on-dark border border-surface-dark-elevated rounded-2xl p-6 shadow-md space-y-4">
                  <div className="flex items-center justify-between border-b border-surface-dark-elevated pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <h4 className="font-editorial-serif text-xl font-medium text-on-dark">
                        {gameSol.hasSaddlePoint
                          ? "Pure Strategy Saddle Point Found"
                          : "Mixed Strategy Matrix"}
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
          {/* 8. LINEAR EQUATIONS (Gauss-Jordan)        */}
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

              {/* Editable Matrix A and Vector b */}
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                  Matrix Coefficients [A | b]
                </h4>
                <div className="space-y-2">
                  {linearEqA.map((row, r) => (
                    <div key={r} className="flex items-center gap-2 font-mono text-xs">
                      {row.map((val, c) => (
                        <div key={c} className="flex items-center gap-1">
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => {
                              const next = linearEqA.map((rrow, ri) =>
                                rrow.map((cell, ci) =>
                                  ri === r && ci === c ? parseFloat(e.target.value) || 0 : cell
                                )
                              );
                              setLinearEqA(next);
                            }}
                            className="w-16 px-2 py-1 bg-canvas border border-hairline rounded text-right font-bold text-ink"
                          />
                          <span>x{c + 1} {c < row.length - 1 ? "+" : "="}</span>
                        </div>
                      ))}
                      <input
                        type="number"
                        value={linearEqB[r]}
                        onChange={(e) => {
                          const next = [...linearEqB];
                          next[r] = parseFloat(e.target.value) || 0;
                          setLinearEqB(next);
                        }}
                        className="w-20 px-2 py-1 bg-primary/10 border border-primary/30 rounded text-right font-bold text-primary"
                      />
                    </div>
                  ))}
                </div>
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
  );
};
