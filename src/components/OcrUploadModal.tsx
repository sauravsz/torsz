import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Camera,
  CheckCircle2,
  Sparkles,
  Play,
  TrendingUp,
  Truck,
  Network,
  Calendar,
  Package,
  Clock,
  Swords,
  Calculator,
  HelpCircle,
  Key,
  ExternalLink,
  Settings,
  FileText,
  Filter,
} from "lucide-react";
import {
  processOrQuestionWithVisionAi,
  parseOrQuestionTextWithAi,
  classifyOrProblemFromText,
  OcrProblemClassification,
} from "../services/ocr";
import { OrModule, NetworkSubtype, TransSubtype } from "../services/or/types";
import { AiSettings, getStoredAiSettings, saveStoredAiSettings } from "../services/aiAssistant";

interface OcrUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAndSolve: (
    module: OrModule,
    subtypes?: { network?: NetworkSubtype; trans?: TransSubtype },
    parsedData?: any,
    rawText?: string
  ) => void;
  initialText?: string;
  initialMode?: "image" | "text";
}

export const OcrUploadModal: React.FC<OcrUploadModalProps> = ({
  isOpen,
  onClose,
  onSelectAndSolve,
  initialText = "",
  initialMode = "image",
}) => {
  const [inputMode, setInputMode] = useState<"image" | "text">(initialMode);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [ocrText, setOcrText] = useState<string>(initialText);
  const [targetHintKey, setTargetHintKey] = useState<string>("auto");
  const [classification, setClassification] = useState<OcrProblemClassification | null>(null);
  const [selectedModule, setSelectedModule] = useState<OrModule>("network-models");
  const [selectedNetworkSubtype, setSelectedNetworkSubtype] = useState<NetworkSubtype>("shortest-route");
  const [selectedTransSubtype, setSelectedTransSubtype] = useState<TransSubtype>("transportation");
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(getStoredAiSettings);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getHintObject = (key: string): { module?: OrModule; networkSubtype?: NetworkSubtype; transSubtype?: TransSubtype } | undefined => {
    if (key === "auto") return undefined;
    if (key === "shortest-route") return { module: "network-models", networkSubtype: "shortest-route" };
    if (key === "minimum-spanning-tree") return { module: "network-models", networkSubtype: "minimum-spanning-tree" };
    if (key === "maximal-flow") return { module: "network-models", networkSubtype: "maximal-flow" };
    if (key === "transportation") return { module: "transportation-assignment", transSubtype: "transportation" };
    if (key === "hungarian-assignment") return { module: "transportation-assignment", transSubtype: "hungarian-assignment" };
    if (key === "linear-programming") return { module: "linear-programming" };
    if (key === "project-planning") return { module: "project-planning" };
    if (key === "inventory-control") return { module: "inventory-control" };
    if (key === "queuing-models") return { module: "queuing-models" };
    if (key === "zero-sum-games") return { module: "zero-sum-games" };
    if (key === "linear-equations") return { module: "linear-equations" };
    return undefined;
  };

  useEffect(() => {
    if (initialText) {
      setOcrText(initialText);
      setInputMode("text");
      handleAnalyzeText(initialText);
    }
  }, [initialText]);

  if (!isOpen) return null;

  const handleUpdateSettings = (updated: Partial<AiSettings>) => {
    const next = { ...aiSettings, ...updated };
    setAiSettings(next);
    saveStoredAiSettings(updated);
  };

  const handleFileChange = async (file: File, hintKey?: string) => {
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
    setScanning(true);
    setScanStatus("Analyzing image with Multimodal AI Vision...");

    const hint = getHintObject(hintKey !== undefined ? hintKey : targetHintKey);

    try {
      const result = await processOrQuestionWithVisionAi(file, aiSettings, hint);
      setClassification(result);
      setOcrText(result.transcription || result.reason);
      setSelectedModule(result.detectedModule);
      if (result.networkSubtype) setSelectedNetworkSubtype(result.networkSubtype);
      if (result.transSubtype) setSelectedTransSubtype(result.transSubtype);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyzeText = async (textToAnalyze?: string, hintKey?: string) => {
    const text = textToAnalyze || ocrText;
    if (!text.trim()) return;

    setError(null);
    setScanning(true);
    setScanStatus("Analyzing problem statement with AI...");

    const hint = getHintObject(hintKey !== undefined ? hintKey : targetHintKey);

    try {
      const result = await parseOrQuestionTextWithAi(text, aiSettings, hint);
      setClassification(result);
      setSelectedModule(result.detectedModule);
      if (result.networkSubtype) setSelectedNetworkSubtype(result.networkSubtype);
      if (result.transSubtype) setSelectedTransSubtype(result.transSubtype);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setInputMode("image");
          handleFileChange(file);
          break;
        }
      }
    }
  };

  const handleConfirmAndSolve = () => {
    let finalParsedData = classification?.parsedData;
    if (!finalParsedData || Object.keys(finalParsedData).length === 0) {
      const hint = getHintObject(targetHintKey);
      const fallback = classifyOrProblemFromText(ocrText, hint);
      finalParsedData = fallback.parsedData;
    }

    onSelectAndSolve(
      selectedModule,
      {
        network: selectedNetworkSubtype,
        trans: selectedTransSubtype,
      },
      finalParsedData,
      ocrText
    );
    onClose();
  };

  const problemTypes: {
    id: OrModule;
    key: string;
    name: string;
    description: string;
    icon: any;
    networkSubtype?: NetworkSubtype;
    transSubtype?: TransSubtype;
  }[] = [
    {
      id: "network-models",
      key: "shortest-route",
      name: "Shortest Route (Dijkstra)",
      description: "Minimum distance/cost path between network nodes (e.g. car replacement).",
      icon: Network,
      networkSubtype: "shortest-route",
    },
    {
      id: "network-models",
      key: "minimum-spanning-tree",
      name: "Minimum Spanning Tree (MST)",
      description: "Connect all network nodes with minimal total length (Kruskal/Prim).",
      icon: Network,
      networkSubtype: "minimum-spanning-tree",
    },
    {
      id: "network-models",
      key: "maximal-flow",
      name: "Maximal Flow",
      description: "Maximum fluid/capacity throughput between source and sink.",
      icon: Network,
      networkSubtype: "maximal-flow",
    },
    {
      id: "transportation-assignment",
      key: "transportation",
      name: "Transportation Model (VAM)",
      description: "Minimize shipping matrix costs between supply plants and demand markets.",
      icon: Truck,
      transSubtype: "transportation",
    },
    {
      id: "transportation-assignment",
      key: "hungarian-assignment",
      name: "Hungarian Task Assignment",
      description: "Allocate N workers to N jobs at minimum total cost.",
      icon: Truck,
      transSubtype: "hungarian-assignment",
    },
    {
      id: "linear-programming",
      key: "linear-programming",
      name: "Linear Programming (Simplex/2D)",
      description: "Maximize/minimize objective functions with resource constraints.",
      icon: TrendingUp,
    },
    {
      id: "project-planning",
      key: "project-planning",
      name: "Project Planning (CPM / PERT)",
      description: "Activity dependencies, earliest/latest times, and critical path duration.",
      icon: Calendar,
    },
    {
      id: "inventory-control",
      key: "inventory-control",
      name: "Inventory Control (EOQ)",
      description: "Economic order quantity, cycle times, and planned backorder levels.",
      icon: Package,
    },
    {
      id: "queuing-models",
      key: "queuing-models",
      name: "Queuing Analysis (M/M/1)",
      description: "Queue lengths, wait times, and server utilization characteristics.",
      icon: Clock,
    },
    {
      id: "zero-sum-games",
      key: "zero-sum-games",
      name: "Zero-Sum Game Theory",
      description: "2-Player payoff matrices, Minimax/Maximin security levels, saddle points.",
      icon: Swords,
    },
    {
      id: "linear-equations",
      key: "linear-equations",
      name: "Linear Equations (Ax = b)",
      description: "Simultaneous linear equation systems via Gauss-Jordan elimination.",
      icon: Calculator,
    },
  ];

  return (
    <div
      onPaste={handlePaste}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div className="bg-surface-card border border-hairline w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between bg-surface-soft">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-canvas p-1 rounded-xl border border-hairline">
              <button
                onClick={() => setInputMode("image")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  inputMode === "image"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Image / Photo Scan</span>
              </button>
              <button
                onClick={() => setInputMode("text")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  inputMode === "text"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Plain Text / Markdown</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1 text-xs text-primary font-medium bg-canvas hover:bg-surface-cream px-2.5 py-1 rounded-lg border border-hairline transition-colors shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Vision API</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-ink hover:bg-surface-cream rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Vision API Key Configuration Drawer */}
          {showConfig && (
            <div className="bg-surface-soft border border-hairline rounded-xl p-4 space-y-3 animate-in fade-in duration-100 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  <Key className="w-3.5 h-3.5 text-accent-amber" />
                  <span>Free Vision AI Model Settings:</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-0.5 text-[11px] text-primary hover:underline font-semibold"
                  >
                    <span>Get Free Groq API Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1 text-xs text-ink focus:border-primary outline-none"
                  >
                    <option value="groq">Groq (qwen/qwen3.8-27b)</option>
                    <option value="claude">Anthropic Claude (Sonnet 3.5)</option>
                    <option value="custom">Custom Endpoint</option>
                    <option value="local">In-Browser OCR (Offline)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">Model Name</label>
                  <input
                    type="text"
                    value={aiSettings.model}
                    onChange={(e) => handleUpdateSettings({ model: e.target.value.trim() })}
                    placeholder="qwen/qwen3.8-27b"
                    className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1 text-xs text-ink font-mono focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    {aiSettings.provider === "groq"
                      ? "Groq API Key (gsk_...)"
                      : "API Key"}
                  </label>
                  <input
                    type="password"
                    value={aiSettings.apiKey}
                    onChange={(e) => handleUpdateSettings({ apiKey: e.target.value.trim() })}
                    placeholder={aiSettings.provider === "groq" ? "gsk_..." : "sk-..."}
                    className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1 text-xs text-ink font-mono focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Problem Type Selector Dropdown Filter */}
          <div className="bg-canvas border border-hairline rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-semibold text-ink">Target Problem Category:</span>
            </div>

            <select
              value={targetHintKey}
              onChange={(e) => {
                const newKey = e.target.value;
                setTargetHintKey(newKey);
                const hint = getHintObject(newKey);
                if (hint?.module) setSelectedModule(hint.module);
                if (hint?.networkSubtype) setSelectedNetworkSubtype(hint.networkSubtype);
                if (hint?.transSubtype) setSelectedTransSubtype(hint.transSubtype);

                // Re-analyze with new target hint if text or image present
                if (ocrText.trim()) {
                  handleAnalyzeText(ocrText, newKey);
                } else if (selectedFile) {
                  handleFileChange(selectedFile, newKey);
                }
              }}
              className="bg-surface-card border border-hairline rounded-lg px-3 py-1.5 text-xs font-semibold text-primary focus:border-primary outline-none shadow-2xs cursor-pointer"
            >
              <option value="auto">✨ Auto-Detect (AI Classification)</option>
              <option value="minimum-spanning-tree">🌐 Minimum Spanning Tree (MST - Kruskal / Prim)</option>
              <option value="shortest-route">🛣️ Shortest Route (Dijkstra / Replacement)</option>
              <option value="maximal-flow">🚰 Maximal Flow Capacity</option>
              <option value="transportation">🚚 Transportation Cost Matrix (VAM)</option>
              <option value="hungarian-assignment">👷 Hungarian Task Assignment</option>
              <option value="linear-programming">📈 Linear Programming (Simplex / Graphical)</option>
              <option value="project-planning">📅 Project Planning (CPM / PERT)</option>
              <option value="inventory-control">📦 Inventory Control (EOQ)</option>
              <option value="queuing-models">⏱️ Queuing Analysis (M/M/1)</option>
              <option value="zero-sum-games">⚔️ Zero-Sum Game Theory</option>
              <option value="linear-equations">🔢 Linear Equations (Ax = b)</option>
            </select>
          </div>

          {/* Mode 1: Image Upload Dropzone */}
          {inputMode === "image" && (
            <div>
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-hairline hover:border-primary bg-canvas hover:bg-surface-cream/50 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(file);
                    }}
                    className="hidden"
                  />
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Click to upload or drag & drop question photo
                    </p>
                    <p className="text-xs text-muted-soft mt-1">
                      Supports PNG, JPG, HEIC, WebP, or paste directly with{" "}
                      <kbd className="font-mono bg-surface-card px-1.5 py-0.5 rounded border border-hairline">
                        ⌘ + V
                      </kbd>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 p-3 bg-canvas border border-hairline rounded-xl mb-4">
                  <img
                    src={imagePreview}
                    alt="Scanned Question"
                    className="w-20 h-20 object-cover rounded-lg border border-hairline shrink-0 shadow-2xs"
                  />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink truncate max-w-[240px]">
                        {selectedFile?.name || "Pasted Image"}
                      </span>
                      <button
                        onClick={() => {
                          setImagePreview(null);
                          setSelectedFile(null);
                          setOcrText("");
                          setClassification(null);
                        }}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Scan Another
                      </button>
                    </div>

                    {scanning ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-primary font-medium animate-pulse">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>{scanStatus}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Parameters Extracted</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Plain Text / Markdown Editor */}
          {inputMode === "text" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Paste Problem Statement or Markdown Table:
                </label>
                <button
                  type="button"
                  onClick={() => handleAnalyzeText()}
                  disabled={!ocrText.trim() || scanning}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors shadow-2xs"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
                  <span>{scanning ? "Analyzing..." : "Analyze with AI ✨"}</span>
                </button>
              </div>

              <textarea
                rows={4}
                value={ocrText}
                onChange={(e) => {
                  const val = e.target.value;
                  setOcrText(val);
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted && pasted.trim().length > 10) {
                    setTimeout(() => {
                      handleAnalyzeText(pasted);
                    }, 50);
                  }
                }}
                placeholder="Paste or type question in plain text or markdown here. AI will automatically parse and optimize the data structure for TORA..."
                className="w-full bg-canvas border border-hairline rounded-xl p-3 text-xs text-ink placeholder:text-muted focus:border-primary outline-none transition-colors font-sans leading-relaxed"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-soft">
                <span>Pasting raw text automatically triggers AI optimization for TORA.</span>
                <span>
                  Press <kbd className="font-mono bg-canvas px-1 rounded border border-hairline text-ink">⌘ + Enter</kbd> to solve
                </span>
              </div>
            </div>
          )}

          {/* Interactive Problem Type Selection Grid */}
          {(ocrText || imagePreview) && (
            <div className="space-y-2.5 pt-2 border-t border-hairline">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Confirm Problem Type:</span>
                </span>
                {classification && (
                  <span className="text-[11px] text-primary font-medium bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                    Auto-detected: {Math.round(classification.confidence * 100)}% match
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
                {problemTypes.map((pt, idx) => {
                  const Icon = pt.icon;
                  const isSelected =
                    selectedModule === pt.id &&
                    (!pt.networkSubtype || selectedNetworkSubtype === pt.networkSubtype) &&
                    (!pt.transSubtype || selectedTransSubtype === pt.transSubtype);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedModule(pt.id);
                        if (pt.networkSubtype) setSelectedNetworkSubtype(pt.networkSubtype);
                        if (pt.transSubtype) setSelectedTransSubtype(pt.transSubtype);
                        setTargetHintKey(pt.key);

                        // Re-trigger extraction specifically for chosen model
                        if (ocrText.trim()) {
                          handleAnalyzeText(ocrText, pt.key);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40"
                          : "bg-canvas border-hairline hover:bg-surface-cream"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${isSelected ? "text-primary font-bold" : "text-muted"}`} />
                        <span className={`text-xs font-semibold ${isSelected ? "text-primary" : "text-ink"}`}>
                          {pt.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-tight">
                        {pt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#fdf2f2] border border-[#f5c6c6] text-error p-3.5 rounded-xl text-xs flex items-center gap-2">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-hairline bg-surface-soft flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-body hover:text-ink transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmAndSolve}
            disabled={(!imagePreview && !ocrText.trim()) || scanning}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Populate & Solve in TORA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
