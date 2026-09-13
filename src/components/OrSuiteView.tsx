import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  CheckCircle2,
  Plus,
  Trash2,

  Sparkles,
  Camera,
  ArrowUp,
  Download,
  Printer,
  Database,
  FileCode,
  X,
  ChevronDown,
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
import { NetworkGraphCanvas } from "./NetworkGraphCanvas";
import { HungarianMatrixViewer } from "./HungarianMatrixViewer";
import { BranchAndBoundTree } from "./BranchAndBoundTree";
import { MultiScenarioSensitivitySweep } from "./MultiScenarioSensitivitySweep";
import { extractNetworkEdges, OcrProblemClassification } from "../services/ocr";
import { extractTransportationProblem, extractAssignmentProblem } from "../services/ocrMatrixParser";
import { loadSavedSolverState, saveSolverState } from "../services/orStateManager";
import { BENCHMARKS } from "../services/orBenchmarks";
import {
  detectImportableTables,
  importNetworkEdgesFromDb,
  importTransportationFromDb,
  importCpmFromDb,
  AvailableImportTable,
} from "../services/or/dbImporter";
import {
  generateLatexReport,
  exportSolutionToExcel,
  printExecutiveReport,
} from "../services/or/exporter";
interface OrSuiteViewProps {
  onOpenInSql: (sql: string) => void;
  onAskAi?: (prompt: string) => void;
  onOpenOcr?: (initialText?: string, initialMode?: "image" | "text") => void;
  activeModule?: OrModule;
  onSelectModule?: (mod: OrModule) => void;
  importedOcrData?: {
    module: OrModule;
    networkSubtype?: NetworkSubtype;
    transSubtype?: TransSubtype;
    data?: OcrProblemClassification["parsedData"];
    rawText?: string;
  } | null;
}

export const OrSuiteView: React.FC<OrSuiteViewProps> = ({
  onOpenInSql: _onOpenInSql,
  onAskAi,
  onOpenOcr,
  activeModule: controlledModule,
  onSelectModule,
  importedOcrData,
}) => {
  const [internalModule, setInternalModule] = useState<OrModule>(controlledModule || "transportation-assignment");
  const activeModule = controlledModule || internalModule;
  const [quickQuestionText, setQuickQuestionText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [lpMode, setLpMode] = useState<LpSolveMode>("graphical-2d");
  const [networkSubtype, setNetworkSubtype] = useState<NetworkSubtype>("shortest-route");
  const [transSubtype, setTransSubtype] = useState<TransSubtype>("transportation");

  useEffect(() => {
    if (controlledModule) {
      setInternalModule(controlledModule);
    }
  }, [controlledModule]);
  // 1. Transportation & Assignment State (Editable)
  // ==========================================
  const [transProblem, setTransProblem] = useState<TransportationProblem>(() =>
    loadSavedSolverState<TransportationProblem>("trans", {
      sources: ["Plant 1", "Plant 2", "Plant 3"],
      destinations: ["Market 1", "Market 2", "Market 3", "Market 4"],
      supply: [15, 25, 10],
      demand: [5, 15, 15, 15],
      costs: [
        [10, 2, 20, 11],
        [12, 7, 9, 20],
        [4, 14, 16, 18],
      ],
    })
  );

  const [assignProblem, setAssignProblem] = useState<AssignmentProblem>(() =>
    loadSavedSolverState<AssignmentProblem>("assign", {
      workers: ["Worker 1", "Worker 2", "Worker 3", "Worker 4"],
      jobs: ["Job A", "Job B", "Job C", "Job D"],
      costs: [
        [1, 4, 6, 3],
        [9, 7, 10, 9],
        [4, 5, 11, 7],
        [8, 7, 8, 5],
      ],
    })
  );

  const [lpProblem, setLpProblem] = useState<LpProblem>(() =>
    loadSavedSolverState<LpProblem>("lp", {
      objective: "max",
      objectiveCoefficients: [5, 4],
      constraints: [
        { coefficients: [6, 4], operator: "<=", rhs: 24 },
        { coefficients: [1, 2], operator: "<=", rhs: 6 },
        { coefficients: [-1, 1], operator: "<=", rhs: 1 },
        { coefficients: [0, 1], operator: "<=", rhs: 2 },
      ],
      variableNames: ["x1", "x2"],
    })
  );

  const [networkEdges, setNetworkEdges] = useState<NetworkEdge[]>(() =>
    loadSavedSolverState<NetworkEdge[]>("edges", [
      { from: 1, to: 2, cost: 4000 },
      { from: 1, to: 3, cost: 5400 },
      { from: 1, to: 4, cost: 9800 },
      { from: 2, to: 3, cost: 4300 },
      { from: 2, to: 4, cost: 6200 },
      { from: 2, to: 5, cost: 8700 },
      { from: 3, to: 4, cost: 4800 },
      { from: 3, to: 5, cost: 7100 },
      { from: 4, to: 5, cost: 4900 },
    ])
  );
  const [netStartNode, setNetStartNode] = useState("1");
  const [netEndNode, setNetEndNode] = useState("5");

  const [cpmActivities, setCpmActivities] = useState<CpmActivity[]>(() =>
    loadSavedSolverState<CpmActivity[]>("cpm", [
      { id: "A", name: "Site Prep", predecessors: [], duration: 2, optimisticA: 1, mostLikelyM: 2, pessimisticB: 3 },
      { id: "B", name: "Foundation", predecessors: ["A"], duration: 4, optimisticA: 2, mostLikelyM: 4, pessimisticB: 6 },
      { id: "C", name: "Framing", predecessors: ["B"], duration: 10, optimisticA: 6, mostLikelyM: 10, pessimisticB: 14 },
      { id: "D", name: "Roofing", predecessors: ["C"], duration: 6, optimisticA: 4, mostLikelyM: 6, pessimisticB: 8 },
      { id: "E", name: "Electrical", predecessors: ["C"], duration: 4, optimisticA: 3, mostLikelyM: 4, pessimisticB: 5 },
      { id: "F", name: "Plumbing", predecessors: ["C"], duration: 5, optimisticA: 4, mostLikelyM: 5, pessimisticB: 6 },
      { id: "G", name: "Finish", predecessors: ["D", "E", "F"], duration: 7, optimisticA: 5, mostLikelyM: 7, pessimisticB: 9 },
    ])
  );

  const [queuingProblem, setQueuingProblem] = useState<QueuingProblem>(() =>
    loadSavedSolverState<QueuingProblem>("queuing", {
      model: "M/M/1",
      arrivalRateLambda: 2,
      serviceRateMu: 3,
      serversCountC: 1,
    })
  );

  const [gameProblem, setGameProblem] = useState<ZeroSumGameProblem>(() =>
    loadSavedSolverState<ZeroSumGameProblem>("game", {
      player1Strategies: ["A1", "A2", "A3"],
      player2Strategies: ["B1", "B2", "B3", "B4"],
      payoffMatrix: [
        [3, -1, 4, 2],
        [-1, -3, -7, 0],
        [4, 0, 6, 3],
      ],
    })
  );

  const [inventoryProblem, setInventoryProblem] = useState<InventoryProblem>(() =>
    loadSavedSolverState<InventoryProblem>("inventory", {
      model: "classic-eoq",
      annualDemandD: 1000,
      orderingCostK: 100,
      holdingCostH: 2,
      unitPriceC: 10,
      shortageCostP: 5,
    })
  );

  const [linearEqA, setLinearEqA] = useState<number[][]>(() =>
    loadSavedSolverState<number[][]>("linearEqA", [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ])
  );
  const [linearEqB, setLinearEqB] = useState<number[]>(() =>
    loadSavedSolverState<number[]>("linearEqB", [8, -11, -3])
  );

  // Sync to localStorage on changes
  useEffect(() => { saveSolverState("trans", transProblem); }, [transProblem]);
  useEffect(() => { saveSolverState("assign", assignProblem); }, [assignProblem]);
  useEffect(() => { saveSolverState("lp", lpProblem); }, [lpProblem]);
  useEffect(() => { saveSolverState("edges", networkEdges); }, [networkEdges]);
  useEffect(() => { saveSolverState("cpm", cpmActivities); }, [cpmActivities]);
  useEffect(() => { saveSolverState("queuing", queuingProblem); }, [queuingProblem]);
  useEffect(() => { saveSolverState("game", gameProblem); }, [gameProblem]);
  useEffect(() => { saveSolverState("inventory", inventoryProblem); }, [inventoryProblem]);
  useEffect(() => { saveSolverState("linearEqA", linearEqA); }, [linearEqA]);
  useEffect(() => { saveSolverState("linearEqB", linearEqB); }, [linearEqB]);
  // Solution State Outputs
  const [transSol, setTransSol] = useState<TransportationSolution | null>(null);
  const [assignSol, setAssignSol] = useState<AssignmentSolution | null>(null);
  const [lpSol, setLpSol] = useState<LpSolution | null>(null);
  const [networkSol, setNetworkSol] = useState<NetworkSolution | null>(null);
  const [cpmSol, setCpmSol] = useState<CpmSolution | null>(null);
  const [queuingSol, setQueuingSol] = useState<QueuingSolution | null>(null);
  const [gameSol, setGameSol] = useState<ZeroSumGameSolution | null>(null);
  const [inventorySol, setInventorySol] = useState<InventorySolution | null>(null);
  // DB Table Import & Export States
  const [isDbImportOpen, setIsDbImportOpen] = useState(false);
  const [availableDbTables, setAvailableDbTables] = useState<AvailableImportTable[]>([]);
  const [copiedLatex, setCopiedLatex] = useState(false);

  const [showBenchmarks, setShowBenchmarks] = useState(false);

  const loadBenchmark = (b: any) => {
    setShowBenchmarks(false);
    if (activeModule === "transportation-assignment") {
      if (transSubtype === "hungarian-assignment") {
        setAssignProblem(b.data);
        const sol = solveHungarianAssignment(b.data);
        setAssignSol(sol);
      } else {
        setTransProblem(b.data);
        const sol = solveTransportation(b.data);
        setTransSol(sol);
      }
    } else if (activeModule === "linear-programming") {
      setLpProblem(b.data);
      const sol = solveLinearProgramming(b.data);
      setLpSol(sol);
    } else if (activeModule === "network-models") {
      setNetworkEdges(b.data.edges);
      if (b.data.startNode) setNetStartNode(b.data.startNode);
      if (b.data.endNode) setNetEndNode(b.data.endNode);
      const sol = networkSubtype === "minimum-spanning-tree" ? solveNetworkMst(b.data.edges) : networkSubtype === "maximal-flow" ? solveNetworkMaxFlow(b.data.edges, b.data.startNode || "1", b.data.endNode || "5") : solveNetworkShortestRoute(b.data.edges, b.data.startNode || "1", b.data.endNode || "5");
      setNetworkSol(sol);
    } else if (activeModule === "project-planning") {
      setCpmActivities(b.data);
      const sol = solveCpmPert(b.data);
      setCpmSol(sol);
    } else if (activeModule === "inventory-control") {
      setInventoryProblem(b.data);
      const sol = solveInventoryControl(b.data);
      setInventorySol(sol);
    } else if (activeModule === "queuing-models") {
      setQueuingProblem(b.data);
      const sol = solveQueuing(b.data);
      setQueuingSol(sol);
    } else if (activeModule === "zero-sum-games") {
      setGameProblem(b.data);
      const sol = solveZeroSumGame(b.data);
      setGameSol(sol);
    } else if (activeModule === "linear-equations") {
      setLinearEqA(b.data.matrixA);
      setLinearEqB(b.data.vectorB);
      const sol = solveLinearEquations(b.data.matrixA, b.data.vectorB);
      setLinearEqSol(sol);
    }
  };
  const handleOpenDbImport = async () => {
    const tables = await detectImportableTables();
    setAvailableDbTables(tables);
    setIsDbImportOpen(true);
  };

  const handleImportTable = async (t: AvailableImportTable) => {
    try {
      if (activeModule === "network-models") {
        const edges = await importNetworkEdgesFromDb(t.name);
        if (edges.length > 0) {
          setNetworkEdges(edges);
          setNetStartNode(String(edges[0].from));
          setNetEndNode(String(edges[edges.length - 1].to));
          const sol = solveNetworkMst(edges);
          setNetworkSol(sol);
        }
      } else if (activeModule === "transportation-assignment") {
        const trans = await importTransportationFromDb(t.name);
        if (trans) {
          setTransProblem(trans);
          const sol = solveTransportation(trans);
          setTransSol(sol);
        }
      } else if (activeModule === "project-planning") {
        const cpm = await importCpmFromDb(t.name);
        if (cpm.length > 0) {
          setCpmActivities(cpm);
          const sol = solveCpmPert(cpm);
          setCpmSol(sol);
        }
      }
      setIsDbImportOpen(false);
    } catch (e) {
      alert(`Failed to import table ${t.name}: ${e}`);
    }
  };

  const handleExportLatex = () => {
    const problemMap: any =
      activeModule === "linear-programming"
        ? lpProblem
        : activeModule === "transportation-assignment"
        ? transProblem
        : activeModule === "project-planning"
        ? cpmActivities
        : {};
    const solutionMap: any =
      activeModule === "linear-programming"
        ? lpSol
        : activeModule === "transportation-assignment"
        ? transSol
        : activeModule === "project-planning"
        ? cpmSol
        : {};

    const latex = generateLatexReport(activeModule, problemMap, solutionMap);
    navigator.clipboard.writeText(latex);
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  const handleExportExcel = () => {
    const problemMap: any =
      activeModule === "transportation-assignment"
        ? transProblem
        : activeModule === "project-planning"
        ? cpmActivities
        : {};
    const solutionMap: any =
      activeModule === "transportation-assignment"
        ? transSol
        : activeModule === "project-planning"
        ? cpmSol
        : {};

    exportSolutionToExcel(activeModule, problemMap, solutionMap);
  };

  const handlePrintBriefing = () => {
    const content = `
      <h2>Model: ${activeModule}</h2>
      <p>Optimal Solution: <strong>${JSON.stringify(
        activeModule === "linear-programming"
          ? lpSol?.objectiveValue
          : activeModule === "transportation-assignment"
          ? transSol?.totalCost
          : activeModule === "network-models"
          ? networkSol?.totalMetric
          : activeModule === "project-planning"
          ? cpmSol?.projectDuration
          : activeModule === "inventory-control"
          ? inventorySol?.totalAnnualCost
          : "Solved"
      )}</strong></p>
    `;
    printExecutiveReport(activeModule, content);
  };
  const [linearEqSol, setLinearEqSol] = useState<number[] | null>(null);


  // Auto-populate & Auto-solve on OCR Data Import
  useEffect(() => {
    if (importedOcrData) {
      setQuickQuestionText("");
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      const { module, networkSubtype: netSub, transSubtype: trSub, data, rawText } = importedOcrData;
      if (module) {
        setInternalModule(module);
        if (onSelectModule) onSelectModule(module);
      }
      if (netSub) setNetworkSubtype(netSub);
      if (trSub) setTransSubtype(trSub);
      if (module === "network-models" || netSub) {
        const extracted = extractNetworkEdges(rawText || "");
        const edges = (data?.edges && data.edges.length >= extracted.edges.length) ? data.edges : extracted.edges;
        const start = data?.startNode || extracted.startNode || "1";
        const end = data?.endNode || extracted.endNode || "5";
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

      if (module === "transportation-assignment" || trSub) {
        if (trSub === "hungarian-assignment") {
          const extractedAssign = extractAssignmentProblem(rawText || "");
          const nextAssign: AssignmentProblem = extractedAssign || {
            ...assignProblem,
            ...(data?.assign || {}),
          };
          setAssignProblem(nextAssign);
          try {
            const sol = solveHungarianAssignment(nextAssign);
            setAssignSol(sol);
          } catch {}
        } else {
          const extractedTrans = extractTransportationProblem(rawText || "");
          const nextTrans: TransportationProblem = extractedTrans || {
            ...transProblem,
            ...(data?.trans || {}),
          };
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

  const handleQuickQuestionSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const text = quickQuestionText.trim();
    if (text) {
      setQuickQuestionText("");
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
      if (onOpenOcr) {
        onOpenOcr(text, "text");
      }
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


  // Linear Programming Dynamic Variables & Constraints
  const addLpVariable = () => {
    const nextIdx = lpProblem.objectiveCoefficients.length + 1;
    const nextNames = lpProblem.variableNames
      ? [...lpProblem.variableNames, `x${nextIdx}`]
      : Array.from({ length: nextIdx }, (_, i) => `x${i + 1}`);
    const nextObj = [...lpProblem.objectiveCoefficients, 1];
    const nextConstraints = lpProblem.constraints.map((c) => ({
      ...c,
      coefficients: [...c.coefficients, 0],
    }));
    setLpProblem({
      ...lpProblem,
      objectiveCoefficients: nextObj,
      variableNames: nextNames,
      constraints: nextConstraints,
    });
    if (nextObj.length > 2) {
      setLpMode("simplex-tableau");
    }
  };

  const removeLpVariable = () => {
    if (lpProblem.objectiveCoefficients.length <= 2) return;
    const nextObj = lpProblem.objectiveCoefficients.slice(0, -1);
    const nextNames = lpProblem.variableNames?.slice(0, -1);
    const nextConstraints = lpProblem.constraints.map((c) => ({
      ...c,
      coefficients: c.coefficients.slice(0, -1),
    }));
    setLpProblem({
      ...lpProblem,
      objectiveCoefficients: nextObj,
      variableNames: nextNames,
      constraints: nextConstraints,
    });
  };

  const updateLpVariableName = (varIdx: number, name: string) => {
    const nextNames = lpProblem.variableNames
      ? [...lpProblem.variableNames]
      : Array.from({ length: lpProblem.objectiveCoefficients.length }, (_, i) => `x${i + 1}`);
    nextNames[varIdx] = name;
    setLpProblem({ ...lpProblem, variableNames: nextNames });
  };

  const addLpConstraint = () => {
    const numVars = lpProblem.objectiveCoefficients.length;
    setLpProblem({
      ...lpProblem,
      constraints: [
        ...lpProblem.constraints,
        { coefficients: Array(numVars).fill(0), operator: "<=", rhs: 10 },
      ],
    });
  };

  const removeLpConstraint = (idx: number) => {
    if (lpProblem.constraints.length <= 1) return;
    setLpProblem({
      ...lpProblem,
      constraints: lpProblem.constraints.filter((_, i) => i !== idx),
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
      {/* Main Module Solver Content */}
      <main className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6 pb-28">
        <div className="flex items-center justify-between gap-3 text-xs shrink-0 pb-1 border-b border-hairline-soft">
          <div className="flex items-center gap-2">
            {/* Benchmark Problems Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowBenchmarks(!showBenchmarks)}
                className="flex items-center gap-1.5 text-xs text-primary font-semibold bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/30 transition-colors shadow-2xs"
                title="Load classic textbook benchmark problems"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Benchmark Examples</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showBenchmarks && (
                <div className="absolute left-0 top-8 w-72 bg-surface-card border border-hairline rounded-2xl shadow-2xl p-2 z-50 animate-keyframe-fade-up space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Textbook Benchmark Problems
                  </div>
                  {((activeModule === "transportation-assignment"
                    ? (transSubtype === "hungarian-assignment" ? BENCHMARKS.assign : BENCHMARKS.trans)
                    : activeModule === "linear-programming"
                    ? BENCHMARKS.lp
                    : activeModule === "network-models"
                    ? BENCHMARKS.network
                    : activeModule === "project-planning"
                    ? BENCHMARKS.cpm
                    : activeModule === "inventory-control"
                    ? BENCHMARKS.inventory
                    : activeModule === "queuing-models"
                    ? BENCHMARKS.queuing
                    : activeModule === "zero-sum-games"
                    ? BENCHMARKS.game
                    : BENCHMARKS.linearEq) || []
                  ).map((b: any) => (
                    <button
                      key={b.id}
                      onClick={() => loadBenchmark(b)}
                      className="w-full text-left p-2 rounded-xl hover:bg-surface-cream transition-colors group"
                    >
                      <div className="text-xs font-semibold text-ink group-hover:text-primary">
                        {b.title}
                      </div>
                      <div className="text-[11px] text-muted line-clamp-1">
                        {b.description}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleOpenDbImport}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-ink hover:bg-surface-card px-2.5 py-1 rounded-lg border border-hairline transition-colors"
              title="Import active SQLite database table into this solver"
            >
              <Database className="w-3.5 h-3.5 text-primary" />
              <span>Import Table</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportLatex}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-ink bg-surface-card hover:bg-surface-cream px-2 py-1 rounded-md border border-hairline transition-colors"
              title="Copy LaTeX Mathematical Model"
            >
              <FileCode className="w-3 h-3 text-accent-teal" />
              <span>{copiedLatex ? "Copied!" : "LaTeX"}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-ink bg-surface-card hover:bg-surface-cream px-2 py-1 rounded-md border border-hairline transition-colors"
              title="Export Formatted Excel Spreadsheet (.xlsx)"
            >
              <Download className="w-3 h-3 text-success" />
              <span>Excel</span>
            </button>

            <button
              onClick={handlePrintBriefing}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-ink bg-surface-card hover:bg-surface-cream px-2 py-1 rounded-md border border-hairline transition-colors"
              title="Print / PDF Executive Briefing Report"
            >
              <Printer className="w-3 h-3 text-accent-amber" />
              <span>Print</span>
            </button>
          </div>
        </div>
          {/* 1. TRANSPORTATION & ASSIGNMENT             */}
          {/* ========================================== */}
          {activeModule === "transportation-assignment" && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Transportation & Assignment Models
                </h3>
                <div className="flex items-center bg-surface-soft p-0.5 rounded-lg border border-hairline">
                  <button
                    onClick={() => setTransSubtype("transportation")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      transSubtype === "transportation" ? "bg-canvas text-ink shadow-2xs font-bold" : "text-muted hover:text-ink"
                    }`}
                  >
                    Transportation (VAM)
                  </button>
                  <button
                    onClick={() => setTransSubtype("hungarian-assignment")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      transSubtype === "hungarian-assignment" ? "bg-canvas text-ink shadow-2xs font-bold" : "text-muted hover:text-ink"
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
                      Shipping Cost Matrix
                    </h4>
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
                                <input
                                  type="number"
                                  value={transProblem.costs[r][c]}
                                  onChange={(e) =>
                                    updateTransCost(r, c, parseFloat(e.target.value) || 0)
                                  }
                                  className="px-2 py-1 w-20 bg-canvas border border-hairline rounded-md text-xs font-mono text-ink focus:outline-none focus:border-primary text-right"
                                />
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
                    <div className="bg-surface-card text-ink p-5 rounded-2xl border border-hairline space-y-3 animate-keyframe-fade-up shadow-sm">
                      <div className="flex items-center justify-between border-b border-hairline pb-2">
                        <span className="font-semibold text-base">Optimal Distribution Plan</span>
                        <span className="text-lg font-mono font-bold text-primary">
                          Total Minimum Cost: ${transSol.totalCost.toLocaleString()}
                        </span>
                      </div>

                      <div className="overflow-x-auto bg-canvas rounded-xl border border-hairline p-1">
                        <table className="w-full text-left font-mono text-xs">
                          <thead>
                            <tr className="text-muted border-b border-hairline bg-surface-soft">
                              <th className="p-2">From Source \ To Dest</th>
                              {transProblem.destinations.map((d, c) => (
                                <th key={c} className="p-2">{d}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {transProblem.sources.map((s, r) => (
                              <tr key={r} className="border-b border-hairline-soft">
                                <td className="p-2 font-semibold text-ink">{s}</td>
                                {transProblem.destinations.map((_, c) => {
                                  const alloc = transSol.allocations[r]?.[c] || 0;
                                  return (
                                    <td key={c} className="p-2">
                                      {alloc > 0 ? (
                                        <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded border border-primary/20">
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
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                      Assignment Cost Matrix
                    </h4>

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
                                <input
                                  type="number"
                                  value={assignProblem.costs[r][c]}
                                  onChange={(e) =>
                                    updateAssignCost(r, c, parseFloat(e.target.value) || 0)
                                  }
                                  className="px-2 py-1 w-20 bg-canvas border border-hairline rounded-md text-xs font-mono text-ink focus:outline-none focus:border-primary text-right"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Hungarian Reduction & Solution Matrix Viewer */}
                  {assignSol && (
                    <HungarianMatrixViewer
                      workers={assignProblem.workers}
                      jobs={assignProblem.jobs}
                      costs={assignProblem.costs}
                      solution={assignSol}
                    />
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
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Linear Programming
                </h3>
                <div className="flex items-center bg-surface-soft p-0.5 rounded-lg border border-hairline">
                  <button
                    onClick={() => setLpMode("graphical-2d")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      lpMode === "graphical-2d" ? "bg-canvas text-ink shadow-2xs font-bold" : "text-muted hover:text-ink"
                    }`}
                  >
                    2D Graphical
                  </button>
                  <button
                    onClick={() => setLpMode("simplex-tableau")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      lpMode === "simplex-tableau" ? "bg-canvas text-ink shadow-2xs font-bold" : "text-muted hover:text-ink"
                    }`}
                  >
                    Simplex Tableaus
                  </button>
                </div>
              </div>
              <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                    Model Formulation ({lpProblem.objectiveCoefficients.length} Variables, {lpProblem.constraints.length} Constraints)
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={addLpVariable}
                      className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                      title="Add decision variable"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                      <span>Add Variable</span>
                    </button>
                    {lpProblem.objectiveCoefficients.length > 2 && (
                      <button
                        onClick={removeLpVariable}
                        className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                        title="Remove last variable"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-error" />
                        <span>Remove Variable</span>
                      </button>
                    )}
                    <button
                      onClick={addLpConstraint}
                      className="flex items-center gap-1 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
                      title="Add constraint equation"
                    >
                      <Plus className="w-3.5 h-3.5 text-accent-teal" />
                      <span>Add Constraint</span>
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
                <div className="p-3 bg-canvas border border-hairline rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-3">
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
                  </div>

                  <div className="flex flex-wrap items-center gap-2 font-mono overflow-x-auto p-1">
                    {lpProblem.objectiveCoefficients.map((coef, varIdx) => {
                      const vName = lpProblem.variableNames?.[varIdx] || `x${varIdx + 1}`;
                      const isLast = varIdx === lpProblem.objectiveCoefficients.length - 1;

                      return (
                        <div key={varIdx} className="flex items-center gap-1.5 bg-surface-card px-2 py-1 rounded-lg border border-hairline">
                          <input
                            type="number"
                            value={coef}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const nextObj = [...lpProblem.objectiveCoefficients];
                              nextObj[varIdx] = val;
                              setLpProblem({ ...lpProblem, objectiveCoefficients: nextObj });
                            }}
                            className="w-14 px-1.5 py-0.5 bg-canvas border border-hairline rounded text-right font-bold text-ink text-xs outline-none focus:border-primary"
                          />
                          <input
                            type="text"
                            value={vName}
                            onChange={(e) => updateLpVariableName(varIdx, e.target.value)}
                            className="w-14 px-1 py-0.5 bg-canvas border border-hairline rounded text-center text-primary font-bold text-xs outline-none focus:border-primary"
                          />
                          {!isLast && <span className="text-muted font-bold">+</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Constraints Inputs */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Subject to Constraints:
                  </span>
                  {lpProblem.constraints.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-canvas border border-hairline rounded-xl flex flex-wrap items-center gap-2 text-xs font-mono"
                    >
                      <span className="text-muted w-7 font-bold">C{idx + 1}:</span>
                      <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-x-auto">
                        {lpProblem.objectiveCoefficients.map((_, varIdx) => {
                          const vName = lpProblem.variableNames?.[varIdx] || `x${varIdx + 1}`;
                          const isLast = varIdx === lpProblem.objectiveCoefficients.length - 1;
                          const coefVal = c.coefficients[varIdx] !== undefined ? c.coefficients[varIdx] : 0;

                          return (
                            <div key={varIdx} className="flex items-center gap-1">
                              <input
                                type="number"
                                value={coefVal}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const nextConstraints = [...lpProblem.constraints];
                                  const nextRowCoeffs = [...(nextConstraints[idx].coefficients || [])];
                                  while (nextRowCoeffs.length < lpProblem.objectiveCoefficients.length) nextRowCoeffs.push(0);
                                  nextRowCoeffs[varIdx] = val;
                                  nextConstraints[idx] = { ...nextConstraints[idx], coefficients: nextRowCoeffs };
                                  setLpProblem({ ...lpProblem, constraints: nextConstraints });
                                }}
                                className="w-14 px-1.5 py-1 bg-surface-card border border-hairline rounded text-right text-ink outline-none focus:border-primary text-xs"
                              />
                              <span className="text-[11px] text-muted">{vName}</span>
                              {!isLast && <span className="text-muted font-bold">+</span>}
                            </div>
                          );
                        })}
                      </div>

                      <select
                        value={c.operator}
                        onChange={(e) => {
                          const next = [...lpProblem.constraints];
                          next[idx] = { ...next[idx], operator: e.target.value as "<=" | ">=" | "=" };
                          setLpProblem({ ...lpProblem, constraints: next });
                        }}
                        className="bg-surface-card border border-hairline rounded-md px-2 py-1 font-semibold text-primary outline-none"
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
                        className="w-20 px-2 py-1 bg-surface-card border border-hairline rounded-md text-right font-bold text-ink outline-none focus:border-primary text-xs"
                      />

                      {lpProblem.constraints.length > 1 && (
                        <button
                          onClick={() => removeLpConstraint(idx)}
                          className="p-1 text-muted hover:text-error rounded transition-colors"
                          title="Delete constraint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Graphical or Simplex Tableau Solution */}
              {lpSol && (
                <div className="space-y-4">
                  {lpMode === "graphical-2d" && lpSol.graphical ? (
                    <GraphicalLpCanvas
                      solution={lpSol.graphical}
                      onUpdateConstraintRhs={(idx, newRhs) => {
                        const next = [...lpProblem.constraints];
                        next[idx] = { ...next[idx], rhs: newRhs };
                        setLpProblem({ ...lpProblem, constraints: next });
                        try {
                          const updatedSol = solveLinearProgramming({ ...lpProblem, constraints: next });
                          setLpSol(updatedSol);
                        } catch {}
                      }}
                    />
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

                  {/* Multi-Scenario Sensitivity Sweep */}
                  <MultiScenarioSensitivitySweep baseProblem={lpProblem} />

                  {/* Branch and Bound Integer Programming Tree */}
                  <BranchAndBoundTree objectiveCoeffs={lpProblem.objectiveCoefficients} />
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
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Network Models
                </h3>
                <div className="flex items-center bg-surface-soft p-0.5 rounded-lg border border-hairline">
                  <button
                    onClick={() => {
                      setNetworkSubtype("shortest-route");
                      if (networkEdges.length > 0) {
                        const sol = solveNetworkShortestRoute(networkEdges, netStartNode, netEndNode);
                        setNetworkSol(sol);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      networkSubtype === "shortest-route" ? "bg-canvas text-ink shadow-2xs font-bold" : "text-muted hover:text-ink"
                    }`}
                  >
                    Shortest Route
                  </button>
                  <button
                    onClick={() => {
                      setNetworkSubtype("minimum-spanning-tree");
                      if (networkEdges.length > 0) {
                        const sol = solveNetworkMst(networkEdges);
                        setNetworkSol(sol);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      networkSubtype === "minimum-spanning-tree" ? "bg-canvas text-ink shadow-2xs font-bold" : "text-muted hover:text-ink"
                    }`}
                  >
                    Minimum Spanning Tree
                  </button>
                  <button
                    onClick={() => {
                      setNetworkSubtype("maximal-flow");
                      if (networkEdges.length > 0) {
                        const sol = solveNetworkMaxFlow(networkEdges, netStartNode, netEndNode);
                        setNetworkSol(sol);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      networkSubtype === "maximal-flow" ? "bg-canvas text-ink shadow-2xs font-bold" : "text-muted hover:text-ink"
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

                <div className="overflow-x-auto max-h-60 bg-canvas rounded-xl border border-hairline p-1">
                  <table className="w-full text-left font-sans text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-hairline bg-surface-soft/60 text-muted">
                        <th className="p-2 w-12 text-center">#</th>
                        <th className="p-2">From Node</th>
                        <th className="p-2">To Node</th>
                        <th className="p-2 text-right">Cost / Weight</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkEdges.map((e, idx) => (
                        <tr key={idx} className="border-b border-hairline-soft hover:bg-surface-soft/30 transition-colors">
                          <td className="p-2 text-center text-muted font-mono">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={e.from}
                              onChange={(ev) => {
                                const next = [...networkEdges];
                                next[idx] = { ...next[idx], from: ev.target.value };
                                setNetworkEdges(next);
                              }}
                              className="w-20 px-2 py-0.5 bg-surface-card border border-hairline rounded font-bold text-ink"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={e.to}
                              onChange={(ev) => {
                                 const next = [...networkEdges];
                                 next[idx] = { ...next[idx], to: ev.target.value };
                                 setNetworkEdges(next);
                               }}
                              className="w-20 px-2 py-0.5 bg-surface-card border border-hairline rounded font-bold text-ink"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              value={e.cost}
                              onChange={(ev) => {
                                const next = [...networkEdges];
                                next[idx] = { ...next[idx], cost: parseFloat(ev.target.value) || 0 };
                                setNetworkEdges(next);
                              }}
                              className="w-24 px-2 py-0.5 bg-surface-card border border-hairline rounded text-right font-mono font-bold text-primary"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => setNetworkEdges(networkEdges.filter((_, i) => i !== idx))}
                              className="text-muted hover:text-error p-1 rounded"
                              title="Delete route"
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
              {/* Interactive Visual Network Topology Graph */}
              <NetworkGraphCanvas
                edges={networkEdges}
                selectedEdges={networkSol?.selectedEdges}
                startNode={netStartNode}
                endNode={netEndNode}
                type={networkSubtype}
              />

              {/* Solution Result Card */}
              {networkSol && (
                <div className="bg-surface-card text-ink border border-hairline rounded-2xl p-6 shadow-sm space-y-4 animate-keyframe-fade-up">
                  <div className="flex items-center justify-between border-b border-hairline pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <h4 className="font-editorial-serif text-xl font-medium text-ink">
                        {networkSubtype === "shortest-route"
                          ? "Optimal Shortest Route"
                          : networkSubtype === "minimum-spanning-tree"
                          ? "Minimum Spanning Tree (MST)"
                          : "Maximal Flow"}
                      </h4>
                    </div>
                    <span className="text-lg font-mono font-bold text-primary">
                      {networkSubtype === "maximal-flow" ? "Max Flow: " : "Total: "}
                      {networkSol.totalMetric.toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-muted font-mono">
                    {networkSubtype === "maximal-flow" ? "Summary: " : "Sequence: "}
                    <span className="text-ink font-bold">{networkSol.pathString}</span>
                  </p>

                  {/* Maximal Flow Detailed Flow Breakdown & Min-Cut Cut Table */}
                  {networkSubtype === "maximal-flow" && networkSol.flowBreakdown && networkSol.flowBreakdown.length > 0 && (
                    <div className="pt-2 border-t border-hairline-soft space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                          Arc Flow & Capacity Utilization:
                        </span>
                        {networkSol.minCut && (
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold border border-primary/20">
                              Min-Cut Capacity: {networkSol.minCut.cutCapacity}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {networkSol.flowBreakdown.map((arc, i) => {
                          const isBottleneck = arc.flow === arc.capacity && arc.capacity > 0;
                          const pct = arc.capacity > 0 ? Math.round((arc.flow / arc.capacity) * 100) : 0;

                          return (
                            <div
                              key={i}
                              className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between gap-1.5 transition-colors ${
                                isBottleneck
                                  ? "bg-primary/10 border-primary/40 text-primary font-semibold"
                                  : arc.flow > 0
                                  ? "bg-canvas border-hairline text-ink"
                                  : "bg-surface-soft/60 border-hairline-soft text-muted opacity-70"
                              }`}
                            >
                              <div className="flex items-center justify-between font-mono">
                                <span className="font-bold">{arc.from} → {arc.to}</span>
                                <span className="text-[10px] font-semibold">{pct}%</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-muted">Flow:</span>
                                <span className="font-mono font-bold">{arc.flow} / {arc.capacity}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Project Planning (CPM / PERT)
                </h3>
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
                  Activity Network Specification
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
                <div className="bg-surface-card text-ink border border-hairline rounded-2xl p-6 shadow-sm space-y-4 animate-keyframe-fade-up">
                  <div className="flex items-center justify-between border-b border-hairline pb-3">
                    <span className="font-semibold text-lg">
                      Critical Path: {cpmSol.criticalPath.join(" → ")}
                    </span>
                    <span className="text-lg font-mono font-bold text-primary">
                      Duration: {cpmSol.projectDuration} Weeks (σ = {cpmSol.projectStdDev})
                    </span>
                  </div>

                  <div className="overflow-x-auto bg-canvas rounded-xl border border-hairline p-1">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-hairline text-muted bg-surface-soft">
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
                            className={`border-b border-hairline-soft ${
                              a.isCritical ? "bg-primary/10 text-primary font-bold" : "text-body"
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
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Inventory Control (EOQ Models)
                </h3>
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
                <div className="bg-surface-card text-ink p-6 rounded-2xl border border-hairline grid grid-cols-2 sm:grid-cols-4 gap-4 shadow-sm animate-keyframe-fade-up">
                  <div className="bg-canvas p-4 rounded-xl border border-hairline text-center shadow-2xs">
                    <span className="text-xs text-muted block mb-1">Optimal EOQ (y*)</span>
                    <span className="font-mono text-2xl font-bold text-primary">
                      {inventorySol.optimalOrderQtyY} units
                    </span>
                  </div>
                  <div className="bg-canvas p-4 rounded-xl border border-hairline text-center shadow-2xs">
                    <span className="text-xs text-muted block mb-1">Cycle Time (t₀)</span>
                    <span className="font-mono text-2xl font-bold text-accent-teal">
                      {inventorySol.cycleTimeT0Days} days
                    </span>
                  </div>
                  <div className="bg-canvas p-4 rounded-xl border border-hairline text-center shadow-2xs">
                    <span className="text-xs text-muted block mb-1">Annual Holding</span>
                    <span className="font-mono text-2xl font-bold text-accent-amber">
                      ${inventorySol.annualHoldingCost}
                    </span>
                  </div>
                  <div className="bg-canvas p-4 rounded-xl border border-hairline text-center shadow-2xs">
                    <span className="text-xs text-muted block mb-1">Total Annual Cost</span>
                    <span className="font-mono text-2xl font-bold text-ink">
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
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Queuing Models
                </h3>
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
                <div className="bg-surface-card text-ink border border-hairline rounded-2xl p-6 shadow-sm space-y-4 animate-keyframe-fade-up">
                  <h4 className="font-editorial-serif text-xl font-medium text-ink border-b border-hairline pb-3">
                    Steady-State Operating Characteristics
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-canvas p-3.5 rounded-xl border border-hairline text-center shadow-2xs">
                      <span className="text-xs text-muted block mb-1">Utilization (ρ)</span>
                      <span className="font-mono text-xl font-bold text-accent-teal">
                        {Math.round(queuingSol.utilizationRho * 1000) / 10}%
                      </span>
                    </div>
                    <div className="bg-canvas p-3.5 rounded-xl border border-hairline text-center shadow-2xs">
                      <span className="text-xs text-muted block mb-1">Avg in Queue (Lq)</span>
                      <span className="font-mono text-xl font-bold text-primary">
                        {queuingSol.avgInQueueLq} units
                      </span>
                    </div>
                    <div className="bg-canvas p-3.5 rounded-xl border border-hairline text-center shadow-2xs">
                      <span className="text-xs text-muted block mb-1">Avg Wait (Wq)</span>
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
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Zero-Sum Game Theory
                </h3>
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
                <div className="bg-surface-card text-ink border border-hairline rounded-2xl p-6 shadow-sm space-y-4 animate-keyframe-fade-up">
                  <div className="flex items-center justify-between border-b border-hairline pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <h4 className="font-editorial-serif text-xl font-medium text-ink">
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
                <h3 className="font-editorial-serif text-2xl font-medium text-ink">
                  Linear Equations
                </h3>
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
                <div className="bg-surface-card text-ink border border-hairline rounded-2xl p-6 shadow-sm space-y-4 animate-keyframe-fade-up">
                  <h4 className="font-editorial-serif text-xl font-medium text-ink border-b border-hairline pb-3">
                    Solution Vector x:
                  </h4>
                  <div className="flex gap-4">
                    {linearEqSol.map((val: number, idx: number) => (
                      <div
                        key={idx}
                        className="bg-canvas p-3 rounded-xl border border-hairline font-mono text-base text-primary font-bold shadow-2xs"
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

        {/* Claude-style Bottom Chat & Problem Input Bar */}
        {/* Light Mode Bottom Chat & Problem Input Bar */}
        <div className="p-4 bg-gradient-to-t from-canvas via-canvas/95 to-transparent border-t border-hairline/60 shrink-0 select-none">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuickQuestionSubmit(e);
            }}
            className="max-w-3xl mx-auto w-full bg-surface-card text-ink rounded-2xl border border-hairline shadow-md p-2 px-3 flex items-center gap-2.5 transition-all focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
          >
            {/* Plus / Category Option Button */}
            <button
              type="button"
              onClick={() => {
                if (onOpenOcr) onOpenOcr(quickQuestionText, "text");
              }}
              className="p-1.5 text-muted hover:text-ink hover:bg-surface-cream rounded-lg transition-colors shrink-0"
              title="Choose Problem Category & Solvers"
            >
              <Plus className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={quickQuestionText}
              onChange={(e) => {
                setQuickQuestionText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuickQuestionSubmit();
                }
              }}
              placeholder="Write a message, paste problem text, or markdown table..."
              className="flex-1 bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none resize-none py-1.5 font-sans leading-relaxed max-h-32"
            />

            {/* Camera Icon Button (replaces voice icon) */}
            {onOpenOcr && (
              <button
                type="button"
                onClick={() => onOpenOcr("", "image")}
                className="p-1.5 text-muted hover:text-primary hover:bg-surface-cream rounded-lg transition-colors shrink-0"
                title="OCR Scan Question Image (Camera)"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            {/* Send Button */}
            <button
              type="submit"
              disabled={!quickQuestionText.trim()}
              className="p-1.5 bg-primary hover:bg-primary-active disabled:bg-surface-soft disabled:text-muted-soft text-on-primary rounded-xl transition-colors shrink-0 shadow-2xs"
              title="Confirm Problem Type & Solve"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
        </div>
        {/* Database Table Importer Modal */}
        {isDbImportOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-keyframe-scale">
            <div className="bg-surface-card border border-hairline rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  <h3 className="font-editorial-serif text-xl font-medium text-ink">
                    Import from SQLite Table
                  </h3>
                </div>
                <button
                  onClick={() => setIsDbImportOpen(false)}
                  className="p-1 text-muted hover:text-ink rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-muted">
                Select an active SQLite database table to import into <strong>{activeModule}</strong>:
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {availableDbTables.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted italic">
                    No tables found in active SQLite database. Load the sample store or connect a database.
                  </div>
                ) : (
                  availableDbTables.map((t) => (
                    <div
                      key={t.name}
                      onClick={() => handleImportTable(t)}
                      className="p-3 bg-canvas hover:bg-surface-cream border border-hairline rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                    >
                      <div>
                        <span className="text-xs font-bold text-ink group-hover:text-primary">
                          {t.name}
                        </span>
                        <div className="text-[11px] text-muted-soft">
                          {t.rowCount} rows • {t.columns.join(", ")}
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                        Import →
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
