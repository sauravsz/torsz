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
  const [autoAnalyze, setAutoAnalyze] = useState(false); // Default OFF
  const [classification, setClassification] = useState<OcrProblemClassification | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("shortest-route");
  const [selectedModule, setSelectedModule] = useState<OrModule>("network-models");
  const [selectedNetworkSubtype, setSelectedNetworkSubtype] = useState<NetworkSubtype>("shortest-route");
  const [selectedTransSubtype, setSelectedTransSubtype] = useState<TransSubtype>("transportation");
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(getStoredAiSettings);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      description: "Minimum distance/cost path between network nodes.",
      icon: Network,
      networkSubtype: "shortest-route",
    },
    {
      id: "network-models",
      key: "minimum-spanning-tree",
      name: "Minimum Spanning Tree (MST)",
      description: "Connect all nodes with minimal total length (Kruskal/Prim).",
      icon: Network,
      networkSubtype: "minimum-spanning-tree",
    },
    {
      id: "network-models",
      key: "maximal-flow",
      name: "Maximal Flow",
      description: "Maximum throughput between source and sink.",
      icon: Network,
      networkSubtype: "maximal-flow",
    },
    {
      id: "transportation-assignment",
      key: "transportation",
      name: "Transportation Model (VAM)",
      description: "Minimize shipping costs between plants and markets.",
      icon: Truck,
      transSubtype: "transportation",
    },
    {
      id: "transportation-assignment",
      key: "hungarian-assignment",
      name: "Hungarian Task Assignment",
      description: "Allocate N workers to N tasks at minimum total cost.",
      icon: Truck,
      transSubtype: "hungarian-assignment",
    },
    {
      id: "linear-programming",
      key: "linear-programming",
      name: "Linear Programming (Simplex / 2D)",
      description: "Maximize/minimize linear objective with constraints.",
      icon: TrendingUp,
    },
    {
      id: "project-planning",
      key: "project-planning",
      name: "Project Planning (CPM / PERT)",
      description: "Activity network, critical paths, and duration.",
      icon: Calendar,
    },
    {
      id: "inventory-control",
      key: "inventory-control",
      name: "Inventory Control (EOQ)",
      description: "Economic order quantity, holding, and backorders.",
      icon: Package,
    },
    {
      id: "queuing-models",
      key: "queuing-models",
      name: "Queuing Analysis (M/M/1)",
      description: "Queue lengths, wait times, and server utilization.",
      icon: Clock,
    },
    {
      id: "zero-sum-games",
      key: "zero-sum-games",
      name: "Zero-Sum Game Theory",
      description: "Payoff matrix, Minimax/Maximin, and saddle points.",
      icon: Swords,
    },
    {
      id: "linear-equations",
      key: "linear-equations",
      name: "Linear Equations (Ax = b)",
      description: "Simultaneous linear equations via Gauss-Jordan.",
      icon: Calculator,
    },
  ];

  const applyProblemType = (key: string) => {
    setSelectedKey(key);
    const pt = problemTypes.find((p) => p.key === key);
    if (!pt) return;
    setSelectedModule(pt.id);
    if (pt.networkSubtype) setSelectedNetworkSubtype(pt.networkSubtype);
    if (pt.transSubtype) setSelectedTransSubtype(pt.transSubtype);
  };

  useEffect(() => {
    if (initialText) {
      setOcrText(initialText);
      setInputMode("text");
      if (autoAnalyze) {
        handleAnalyzeText(initialText);
      }
    }
  }, [initialText]);

  if (!isOpen) return null;

  const handleUpdateSettings = (updated: Partial<AiSettings>) => {
    const next = { ...aiSettings, ...updated };
    setAiSettings(next);
    saveStoredAiSettings(updated);
  };

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);

    if (autoAnalyze) {
      setScanning(true);
      setScanStatus("Analyzing image with Multimodal AI Vision...");

      const hint = {
        module: selectedModule,
        networkSubtype: selectedNetworkSubtype,
        transSubtype: selectedTransSubtype,
      };

      try {
        const result = await processOrQuestionWithVisionAi(file, aiSettings, hint);
        setClassification(result);
        setOcrText(result.transcription || result.reason);
        setSelectedModule(result.detectedModule);
        if (result.networkSubtype) setSelectedNetworkSubtype(result.networkSubtype);
        if (result.transSubtype) setSelectedTransSubtype(result.transSubtype);

        const matchedPt = problemTypes.find((p) =>
          p.id === result.detectedModule &&
          (!p.networkSubtype || p.networkSubtype === result.networkSubtype) &&
          (!p.transSubtype || p.transSubtype === result.transSubtype)
        );
        if (matchedPt) setSelectedKey(matchedPt.key);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setScanning(false);
      }
    }
  };

  const handleAnalyzeText = async (textToAnalyze?: string) => {
    const text = textToAnalyze || ocrText;
    if (!text.trim()) return;

    setError(null);
    setScanning(true);
    setScanStatus("Analyzing problem statement with AI...");

    const hint = {
      module: selectedModule,
      networkSubtype: selectedNetworkSubtype,
      transSubtype: selectedTransSubtype,
    };

    try {
      const result = await parseOrQuestionTextWithAi(text, aiSettings, hint);
      setClassification(result);
      setSelectedModule(result.detectedModule);
      if (result.networkSubtype) setSelectedNetworkSubtype(result.networkSubtype);
      if (result.transSubtype) setSelectedTransSubtype(result.transSubtype);

      const matchedPt = problemTypes.find((p) =>
        p.id === result.detectedModule &&
        (!p.networkSubtype || p.networkSubtype === result.networkSubtype) &&
        (!p.transSubtype || p.transSubtype === result.transSubtype)
      );
      if (matchedPt) setSelectedKey(matchedPt.key);
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
      const hint = {
        module: selectedModule,
        networkSubtype: selectedNetworkSubtype,
        transSubtype: selectedTransSubtype,
      };
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

  return (
    <div
      onPaste={handlePaste}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none transition-opacity duration-300 ease-apple-ease"
    >
      <div className="bg-surface-card border border-hairline w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-keyframe-scale">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between bg-surface-soft">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-canvas p-1 rounded-xl border border-hairline">
              <button
                type="button"
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
                type="button"
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
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1 text-xs text-primary font-medium bg-canvas hover:bg-surface-cream px-2.5 py-1.5 rounded-lg border border-hairline transition-colors shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Vision API</span>
            </button>
            <button
              type="button"
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
                    className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1.5 text-xs text-ink focus:border-primary outline-none"
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
                    className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1.5 text-xs text-ink font-mono focus:border-primary outline-none"
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
                    className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1.5 text-xs text-ink font-mono focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mode 1: Image Upload Dropzone */}
          {inputMode === "image" && (
            <div>
              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-hairline hover:border-primary bg-canvas hover:bg-surface-cream/50 rounded-2xl p-7 text-center cursor-pointer transition-colors space-y-3"
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
                <div className="flex items-start gap-4 p-3 bg-canvas border border-hairline rounded-xl">
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
                        type="button"
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
                      <div className="flex items-center gap-2 text-xs text-primary font-medium animate-pulse">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        <span>{scanStatus}</span>
                      </div>
                    ) : classification ? (
                      <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>AI Analysis Complete</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectedFile && handleFileChange(selectedFile)}
                        className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Run AI Vision Analysis</span>
                      </button>
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
                  Problem Statement or Markdown Table:
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
                  setOcrText(e.target.value);
                }}
                placeholder="Paste or type question text, linear equations, network arcs, or cost matrix here..."
                className="w-full bg-canvas border border-hairline rounded-xl p-3 text-xs text-ink placeholder:text-muted focus:border-primary outline-none transition-colors font-sans leading-relaxed"
              />
            </div>
          )}

          {/* SINGLE Problem Type Selection Section with Auto-Analyze Toggle */}
          <div className="space-y-3 pt-3 border-t border-hairline">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                Select Problem Type:
              </span>

              {/* Auto-Analysing Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAnalyze}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoAnalyze(checked);
                    if (checked) {
                      if (inputMode === "text" && ocrText.trim()) {
                        handleAnalyzeText(ocrText);
                      } else if (inputMode === "image" && selectedFile) {
                        handleFileChange(selectedFile);
                      }
                    }
                  }}
                  className="rounded border-hairline text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="text-xs font-medium text-body">
                  Auto-analyse with AI
                </span>
                {autoAnalyze && classification && (
                  <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    {Math.round(classification.confidence * 100)}% match
                  </span>
                )}
              </label>
            </div>

            {/* Single Unified Grid of Problem Types */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
              {problemTypes.map((pt) => {
                const Icon = pt.icon;
                const isSelected = selectedKey === pt.key;

                return (
                  <button
                    key={pt.key}
                    type="button"
                    onClick={() => applyProblemType(pt.key)}
                    className={`p-2.5 px-3 rounded-xl border text-left transition-all duration-150 flex items-center gap-2 ${
                      isSelected
                        ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40 text-primary font-semibold"
                        : "bg-canvas border-hairline hover:bg-surface-cream text-ink font-medium"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted"}`} />
                    <span className="text-xs truncate">{pt.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-body hover:text-ink transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
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
