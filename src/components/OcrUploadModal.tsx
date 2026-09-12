import React, { useState, useRef } from "react";
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
} from "lucide-react";
import {
  processOrQuestionWithVisionAi,
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
}

export const OcrUploadModal: React.FC<OcrUploadModalProps> = ({
  isOpen,
  onClose,
  onSelectAndSolve,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [ocrText, setOcrText] = useState<string>("");
  const [classification, setClassification] = useState<OcrProblemClassification | null>(null);
  const [selectedModule, setSelectedModule] = useState<OrModule>("network-models");
  const [selectedNetworkSubtype, setSelectedNetworkSubtype] = useState<NetworkSubtype>("shortest-route");
  const [selectedTransSubtype, setSelectedTransSubtype] = useState<TransSubtype>("transportation");
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(getStoredAiSettings);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setScanning(true);
    setScanStatus("Analyzing image with Multimodal AI Vision...");

    try {
      const result = await processOrQuestionWithVisionAi(file, aiSettings);
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

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          handleFileChange(file);
          break;
        }
      }
    }
  };

  const handleConfirmAndSolve = () => {
    onSelectAndSolve(
      selectedModule,
      {
        network: selectedNetworkSubtype,
        trans: selectedTransSubtype,
      },
      classification?.parsedData,
      ocrText
    );
    onClose();
  };

  const problemTypes: {
    id: OrModule;
    name: string;
    description: string;
    icon: any;
    networkSubtype?: NetworkSubtype;
    transSubtype?: TransSubtype;
  }[] = [
    {
      id: "network-models",
      name: "Shortest Route (Dijkstra)",
      description: "Minimum distance/cost path between network nodes (e.g. car replacement).",
      icon: Network,
      networkSubtype: "shortest-route",
    },
    {
      id: "network-models",
      name: "Minimum Spanning Tree (MST)",
      description: "Connect all network nodes with minimal total length (Kruskal/Prim).",
      icon: Network,
      networkSubtype: "minimum-spanning-tree",
    },
    {
      id: "network-models",
      name: "Maximal Flow",
      description: "Maximum fluid/capacity throughput between source and sink.",
      icon: Network,
      networkSubtype: "maximal-flow",
    },
    {
      id: "transportation-assignment",
      name: "Transportation Model (VAM)",
      description: "Minimize shipping matrix costs between supply plants and demand markets.",
      icon: Truck,
      transSubtype: "transportation",
    },
    {
      id: "transportation-assignment",
      name: "Hungarian Task Assignment",
      description: "Allocate N workers to N jobs at minimum total cost.",
      icon: Truck,
      transSubtype: "hungarian-assignment",
    },
    {
      id: "linear-programming",
      name: "Linear Programming (Simplex/2D)",
      description: "Maximize/minimize objective functions with resource constraints.",
      icon: TrendingUp,
    },
    {
      id: "project-planning",
      name: "Project Planning (CPM / PERT)",
      description: "Activity dependencies, earliest/latest times, and critical path duration.",
      icon: Calendar,
    },
    {
      id: "inventory-control",
      name: "Inventory Control (EOQ)",
      description: "Economic order quantity, cycle times, and planned backorder levels.",
      icon: Package,
    },
    {
      id: "queuing-models",
      name: "Queuing Analysis (M/M/1)",
      description: "Queue lengths, wait times, and server utilization characteristics.",
      icon: Clock,
    },
    {
      id: "zero-sum-games",
      name: "Zero-Sum Game Theory",
      description: "2-Player payoff matrices, Minimax/Maximin security levels, saddle points.",
      icon: Swords,
    },
    {
      id: "linear-equations",
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
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial-serif text-xl font-medium text-ink">
                Multimodal AI Vision Question Solver
              </h3>
              <p className="text-xs text-muted">
                Upload or paste a photo of your paper question, graph diagram, or cost matrix.
              </p>
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
                  <span>Free Vision AI Models:</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-0.5 text-[11px] text-primary hover:underline font-semibold"
                  >
                    <span>Free Groq Key (llama-3.2-vision)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span>•</span>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-0.5 text-[11px] text-accent-teal hover:underline font-semibold"
                  >
                    <span>Free OpenRouter Key (gemini-flash)</span>
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
                      } else if (p === "custom") {
                        handleUpdateSettings({
                          provider: "custom",
                          baseUrl: "https://openrouter.ai/api/v1",
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
                    <option value="custom">OpenRouter (qwen/qwen3.8-27b)</option>
                    <option value="claude">Anthropic Claude (Sonnet 3.5)</option>
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
                      : aiSettings.provider === "custom"
                      ? "API Key (sk-...)"
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

          {/* Upload Dropzone */}
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
                  Supports PNG, JPG, WebP, or paste directly with{" "}
                  <kbd className="font-mono bg-surface-card px-1.5 py-0.5 rounded border border-hairline">
                    ⌘ + V
                  </kbd>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Thumbnail & Status Bar */}
              <div className="flex items-start gap-4 p-3 bg-canvas border border-hairline rounded-xl">
                <img
                  src={imagePreview}
                  alt="Scanned Question"
                  className="w-24 h-24 object-cover rounded-lg border border-hairline shrink-0 shadow-2xs"
                />
                <div className="flex-1 space-y-2">
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
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-primary font-medium animate-pulse">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        <span>{scanStatus}</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface-soft rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-2/3 animate-pulse rounded-full" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Question & Parameters Extracted Successfully</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted Text Preview */}
              {ocrText && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Extracted Question Transcription:
                  </span>
                  <div className="p-3 bg-canvas border border-hairline rounded-xl text-xs font-mono text-body max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {ocrText}
                  </div>
                </div>
              )}

              {/* Interactive Problem Type Selection */}
              <div className="space-y-2.5">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                  {problemTypes.map((pt, idx) => {
                    const Icon = pt.icon;
                    const isSelected =
                      selectedModule === pt.id &&
                      (!pt.networkSubtype || selectedNetworkSubtype === pt.networkSubtype) &&
                      (!pt.transSubtype || selectedTransSubtype === pt.transSubtype);

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedModule(pt.id);
                          if (pt.networkSubtype) setSelectedNetworkSubtype(pt.networkSubtype);
                          if (pt.transSubtype) setSelectedTransSubtype(pt.transSubtype);
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
            disabled={!imagePreview || scanning}
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
