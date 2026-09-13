import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Play,
  Copy,
  Check,
  Key,
  HelpCircle,
  ArrowRight,
  Settings,
  ExternalLink,
  Upload,
  TrendingUp,
  Terminal,
  Network,
  Truck,
  Package,
  Calendar,
  Clock,
  Swords,
  Calculator,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DatabaseSchema } from "../types";
import {
  convertTextToSql,
  generateSmartSuggestions,
  AiGeneratedSql,
  getStoredAiSettings,
  saveStoredAiSettings,
  AiSettings,
} from "../services/aiAssistant";
import {
  parseOrQuestionTextWithAi,
  OcrProblemClassification,
} from "../services/ocr";
import { OrModule, NetworkSubtype, TransSubtype } from "../services/or/types";

interface AiAssistantProps {
  schema: DatabaseSchema | null;
  onApplySql: (sql: string, autoRun?: boolean) => void;
  onNavigateToOr?: (module?: string) => void;
  onPopulateAndSolveOr?: (
    module: OrModule,
    subtypes?: { network?: NetworkSubtype; trans?: TransSubtype },
    parsedData?: Record<string, unknown>,
    rawText?: string
  ) => void;
  initialPrompt?: string;
  initialMode?: "sql" | "or";
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  schema,
  onApplySql,
  onNavigateToOr,
  onPopulateAndSolveOr,
  initialPrompt,
  initialMode = "sql",
}) => {
  const [activeMode, setActiveMode] = useState<"sql" | "or">(initialMode);
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [loading, setLoading] = useState(false);
  const [sqlResult, setSqlResult] = useState<AiGeneratedSql | null>(null);
  const [orResult, setOrResult] = useState<OcrProblemClassification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sqlSuggestions, setSqlSuggestions] = useState<string[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings>(getStoredAiSettings);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  const orSuggestions = [
    "Maximize Z = 3x1 + 5x2 subject to x1 <= 4, 2x2 <= 12, 3x1 + 2x2 <= 18 (Simplex LP)",
    "Meridian Manufacturing 4-plant to 5-warehouse transportation cost minimization (VAM)",
    "Arcadia Water Authority 22-district irrigation canal network minimum spanning tree (MST)",
    "Shortest route from node 1 to 5 with intermediate arc costs (Dijkstra)",
    "Single-server queuing system with arrival rate 4/hr and service rate 6/hr (M/M/1)",
    "Economic Order Quantity (EOQ) with annual demand 5000, order cost $49, and 20% holding cost",
    "Project critical path schedule for tasks A through G with duration and dependencies (CPM)",
    "Zero-sum 3x3 payoff matrix game theory with saddle point detection",
  ];

  useEffect(() => {
    setSqlSuggestions(generateSmartSuggestions(schema));
  }, [schema]);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      handleGenerate(initialPrompt);
    }
  }, [initialPrompt]);

  const handleUpdateSettings = (updated: Partial<AiSettings>) => {
    const next = { ...aiSettings, ...updated };
    setAiSettings(next);
    saveStoredAiSettings(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setPrompt(text);
    } catch (err) {
      console.error("Failed to read file:", err);
    }
  };

  const handleGenerate = async (queryPrompt?: string) => {
    const textToRun = queryPrompt || prompt;
    if (!textToRun.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (activeMode === "sql") {
        const genResult = await convertTextToSql(textToRun, schema, aiSettings);
        setSqlResult(genResult);
        setOrResult(null);
      } else {
        const classification = await parseOrQuestionTextWithAi(textToRun, aiSettings);
        setOrResult(classification);
        setSqlResult(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = () => {
    if (!sqlResult) return;
    navigator.clipboard.writeText(sqlResult.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePopulateOr = () => {
    if (!orResult) return;
    if (onPopulateAndSolveOr) {
      onPopulateAndSolveOr(
        orResult.detectedModule,
        {
          network: orResult.networkSubtype,
          trans: orResult.transSubtype,
        },
        orResult.parsedData,
        orResult.transcription || prompt
      );
    } else if (onNavigateToOr) {
      onNavigateToOr(orResult.detectedModule);
    }
  };

  const getModuleIcon = (mod: OrModule) => {
    switch (mod) {
      case "linear-programming":
        return TrendingUp;
      case "transportation-assignment":
        return Truck;
      case "network-models":
        return Network;
      case "project-planning":
        return Calendar;
      case "inventory-control":
        return Package;
      case "queuing-models":
        return Clock;
      case "zero-sum-games":
        return Swords;
      case "linear-equations":
        return Calculator;
      default:
        return Sparkles;
    }
  };

  const getModuleName = (mod: OrModule, netSub?: NetworkSubtype, trSub?: TransSubtype) => {
    if (mod === "network-models") {
      if (netSub === "minimum-spanning-tree") return "Minimum Spanning Tree (MST)";
      if (netSub === "maximal-flow") return "Maximal Flow";
      return "Shortest Route (Dijkstra)";
    }
    if (mod === "transportation-assignment") {
      if (trSub === "hungarian-assignment") return "Hungarian Task Assignment";
      return "Transportation Model (VAM)";
    }
    switch (mod) {
      case "linear-programming":
        return "Linear Programming (Simplex / 2D)";
      case "project-planning":
        return "Project Planning (CPM / PERT)";
      case "inventory-control":
        return "Inventory Control (EOQ)";
      case "queuing-models":
        return "Queuing Analysis (Waiting Lines)";
      case "zero-sum-games":
        return "Zero-Sum Game Theory";
      case "linear-equations":
        return "Linear Equations (Ax = b)";
      default:
        return "Operations Research Model";
    }
  };

  return (
    <div className="flex-1 bg-canvas flex flex-col h-full overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto w-full select-text">
      {/* Top Header & Mode Switcher */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="font-editorial-serif text-xl font-medium text-ink">
            AI Assistant
          </h2>
        </div>

        {/* Segmented Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-soft p-1 rounded-xl border border-hairline shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setActiveMode("sql");
                setSqlResult(null);
                setOrResult(null);
                setError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeMode === "sql"
                  ? "bg-canvas text-ink shadow-xs border border-hairline ring-1 ring-primary/20"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Terminal className={`w-3.5 h-3.5 ${activeMode === "sql" ? "text-primary" : "text-muted"}`} />
              <span>SQL Query Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode("or");
                setSqlResult(null);
                setOrResult(null);
                setError(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeMode === "or"
                  ? "bg-canvas text-ink shadow-xs border border-hairline ring-1 ring-primary/20"
                  : "text-muted hover:text-ink"
              }`}
            >
              <TrendingUp className={`w-3.5 h-3.5 ${activeMode === "or" ? "text-primary" : "text-muted"}`} />
              <span>TORA OR Solvers</span>
            </button>
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink bg-surface-card hover:bg-surface-cream px-2.5 py-1.5 rounded-xl border border-hairline transition-colors shadow-2xs shrink-0"
            title="AI Settings"
          >
            <Settings className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Settings Drawer */}
      {showConfig && (
        <div className="bg-surface-card border border-hairline rounded-2xl p-4 mb-4 shadow-sm space-y-3 animate-keyframe-fade-up text-xs">
          <div className="flex items-center justify-between border-b border-hairline pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              <Key className="w-3.5 h-3.5 text-accent-amber" />
              <span>AI Provider Configuration</span>
            </div>
            {aiSettings.provider === "groq" && (
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
              >
                <span>Get Free Groq API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">Provider</label>
              <select
                value={aiSettings.provider}
                onChange={(e) => {
                  const p = e.target.value as AiSettings["provider"];
                  if (p === "groq") {
                    handleUpdateSettings({
                      provider: "groq",
                      baseUrl: "https://api.groq.com/openai/v1",
                      model: "qwen/qwen3.8-27b",
                    });
                  } else if (p === "claude") {
                    handleUpdateSettings({
                      provider: "claude",
                      model: "claude-3-5-sonnet-20241022",
                    });
                  } else {
                    handleUpdateSettings({ provider: p });
                  }
                }}
                className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1.5 text-xs text-ink focus:border-primary outline-none"
              >
                <option value="groq">Groq (qwen/qwen3.8-27b - Free)</option>
                <option value="claude">Anthropic Claude (Sonnet 3.5)</option>
                <option value="custom">Custom OpenAI-Compatible</option>
                <option value="local">In-Browser Rules Engine (Offline)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">Model Name</label>
              <input
                type="text"
                value={aiSettings.model}
                onChange={(e) => handleUpdateSettings({ model: e.target.value.trim() })}
                placeholder="qwen/qwen3.8-27b"
                className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1.5 text-xs text-ink font-mono focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1">
                {aiSettings.provider === "groq" ? "Groq API Key (gsk_...)" : "API Key"}
              </label>
              <input
                type="password"
                value={aiSettings.apiKey}
                onChange={(e) => handleUpdateSettings({ apiKey: e.target.value.trim() })}
                placeholder={aiSettings.provider === "groq" ? "gsk_..." : "sk-..."}
                className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1.5 text-xs text-ink font-mono focus:border-primary outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Prompt Card */}
      <div className="bg-surface-card border border-hairline rounded-3xl p-5 shadow-sm mb-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            {activeMode === "sql" ? (
              <>
                <Terminal className="w-3.5 h-3.5 text-primary" />
                <span>Ask Database Question in Natural Language</span>
              </>
            ) : (
              <>
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span>Formulate & Solve Operations Research Question</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileUploadRef.current?.click()}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-ink hover:underline transition-colors"
              title="Upload text file"
            >
              <Upload className="w-3 h-3" />
              <span>Import File</span>
            </button>
            <input
              ref={fileUploadRef}
              type="file"
              accept=".sql,.txt,.csv,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder={
              activeMode === "sql"
                ? "e.g. Find top 5 customers with highest total spending, or count active products by category..."
                : "e.g. Maximize Z = 3x1 + 5x2 subject to x1 <= 4, 2x2 <= 12, or paste a transportation cost matrix..."
            }
            className="w-full bg-canvas border border-hairline rounded-2xl p-3.5 text-sm text-ink placeholder:text-muted-soft focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all resize-none leading-relaxed"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-1 text-xs text-primary font-medium hover:underline select-none"
          >
            <span>✦ Example {activeMode === "sql" ? "Queries" : "Problems"}</span>
            {showSuggestions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 bg-primary hover:bg-primary-active disabled:bg-primary-disabled disabled:text-muted text-on-primary text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Analyzing..." : activeMode === "sql" ? "Generate SQL (⌘↵)" : "Formulate & Solve (⌘↵)"}</span>
          </button>
        </div>

        {/* Suggestion Chips Drawer */}
        {showSuggestions && (
          <div className="pt-2 border-t border-hairline-soft flex flex-wrap gap-1.5 animate-keyframe-fade-up">
            {(activeMode === "sql" ? sqlSuggestions : orSuggestions).map((sugg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(sugg);
                  handleGenerate(sugg);
                }}
                className="text-left text-xs bg-canvas hover:bg-surface-cream text-body hover:text-ink px-2.5 py-1.5 rounded-lg border border-hairline transition-colors leading-relaxed"
              >
                {sugg}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-[#fdf2f2] border border-[#f5c6c6] text-error p-4 rounded-2xl text-xs flex items-start gap-2.5 mb-4 shadow-sm">
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold block mb-0.5">Generation Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Mode 1: SQL Assistant Result */}
      {activeMode === "sql" && sqlResult && (
        <div className="bg-[#181715] border border-[#252320] rounded-3xl p-5 text-[#faf9f5] shadow-xl space-y-4 animate-keyframe-scale">
          <div className="flex items-center justify-between border-b border-[#252320] pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-[#faf9f5]">Generated SQL Query</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 text-xs text-[#a09d96] hover:text-[#faf9f5] bg-[#252320] hover:bg-[#2e2b27] px-2.5 py-1 rounded-lg transition-colors border border-surface-dark-elevated"
                title="Copy SQL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                onClick={() => onApplySql(sqlResult.sql, true)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-3.5 py-1 rounded-lg transition-colors shadow-2xs"
                title="Run in Worksheet"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Apply & Run (⌘↵)</span>
              </button>
            </div>
          </div>

          <pre className="font-mono text-xs text-[#5db8a6] bg-[#141312] p-3.5 rounded-xl overflow-x-auto border border-[#252320] leading-relaxed">
            {sqlResult.sql}
          </pre>

          {sqlResult.explanation && (
            <div className="text-xs text-[#a09d96] bg-[#1f1e1b] p-3 rounded-xl border border-[#252320] leading-relaxed">
              <span className="font-semibold text-[#faf9f5] block mb-1">Explanation:</span>
              {sqlResult.explanation}
            </div>
          )}
        </div>
      )}

      {/* Mode 2: TORA Solver Assistant Result */}
      {activeMode === "or" && orResult && (
        <div className="bg-surface-card border border-hairline rounded-3xl p-5 shadow-xl space-y-4 animate-keyframe-scale">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2">
              {React.createElement(getModuleIcon(orResult.detectedModule), {
                className: "w-5 h-5 text-primary",
              })}
              <div>
                <h3 className="font-editorial-serif text-lg font-semibold text-ink">
                  {getModuleName(orResult.detectedModule, orResult.networkSubtype, orResult.transSubtype)}
                </h3>
                <span className="text-[11px] text-muted">
                  Confidence: {Math.round(orResult.confidence * 100)}% match
                </span>
              </div>
            </div>

            <button
              onClick={handlePopulateOr}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <span>Populate & Solve in TORA</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reasoning & Mathematical Formulation */}
          <div className="text-xs text-body bg-canvas p-3.5 rounded-2xl border border-hairline leading-relaxed space-y-2">
            <div className="font-semibold text-ink uppercase tracking-wider text-[10px]">
              Mathematical Formulation & Diagnostic:
            </div>
            <p>{orResult.reason}</p>
          </div>

          {/* Quick Problem Details */}
          {orResult.parsedData && Object.keys(orResult.parsedData).length > 0 && (
            <div className="bg-surface-soft p-3 rounded-2xl border border-hairline text-xs font-mono text-ink space-y-1">
              <div className="text-[10px] font-sans font-semibold uppercase text-muted tracking-wider">
                Extracted Table Parameters:
              </div>
              <pre className="text-[11px] whitespace-pre-wrap overflow-x-auto text-body">
                {JSON.stringify(orResult.parsedData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
