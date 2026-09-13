import React, { useState, useEffect } from "react";
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
  Calculator,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DatabaseSchema } from "../types";
import {
  convertTextToSql,
  generateSmartSuggestions,
  generateOptimizationSuggestions,
  AiGeneratedSql,
  getStoredAiSettings,
  saveStoredAiSettings,
  AiSettings,
} from "../services/aiAssistant";

interface AiAssistantProps {
  schema: DatabaseSchema | null;
  onApplySql: (sql: string, autoRun?: boolean) => void;
  onNavigateToOr?: (module?: string) => void;
  initialPrompt?: string;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  schema,
  onApplySql,
  onNavigateToOr,
  initialPrompt,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiGeneratedSql | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings>(getStoredAiSettings);
  const fileUploadRef = React.useRef<HTMLInputElement | null>(null);

  const optimizationSuggestions = generateOptimizationSuggestions();

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

  useEffect(() => {
    setSuggestions(generateSmartSuggestions(schema));
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

  const handleGenerate = async (queryPrompt?: string) => {
    const textToRun = queryPrompt || prompt;
    if (!textToRun.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const genResult = await convertTextToSql(textToRun, schema, aiSettings);
      setResult(genResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-canvas flex flex-col h-full overflow-y-auto p-6 max-w-3xl mx-auto w-full select-text">
      {/* Minimal Header */}
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="font-editorial-serif text-xl font-medium text-ink">
            AI Assistant
          </h2>
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-ink bg-surface-card hover:bg-surface-cream px-2.5 py-1 rounded-lg border border-hairline transition-colors shadow-2xs"
        >
          <Settings className="w-3.5 h-3.5 text-primary" />
          <span>Settings</span>
        </button>
      </div>

      {/* Settings Drawer */}
      {showConfig && (
        <div className="bg-surface-card border border-hairline rounded-xl p-4 mb-4 shadow-sm space-y-3 animate-keyframe-fade-up text-xs">
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
                <span>Free Groq API Key</span>
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
                className="w-full bg-canvas border border-hairline rounded-md px-2.5 py-1 text-xs text-ink focus:border-primary outline-none"
              >
                <option value="groq">Groq (qwen/qwen3.8-27b)</option>
                <option value="custom">Custom (OpenAI / Ollama / Local)</option>
                <option value="claude">Anthropic Claude</option>
                <option value="local">Offline Built-in Engine</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-muted mb-1">
                {aiSettings.provider === "groq"
                  ? "Groq API Key (gsk_...)"
                  : aiSettings.provider === "claude"
                  ? "Anthropic API Key (sk-ant-...)"
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

      {/* Centered Minimal Prompt Container */}
      <div className="bg-surface-card border border-hairline rounded-2xl p-4 shadow-sm space-y-3 mb-4 transition-all">
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
          placeholder="Ask a question about your data or describe an optimization problem... (⌘↵ to run)"
          className="w-full bg-canvas border border-hairline rounded-xl p-3 text-xs text-ink placeholder:text-muted focus:border-primary outline-none transition-colors leading-relaxed font-sans resize-y max-h-48"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <input
              ref={fileUploadRef}
              type="file"
              accept=".txt,.md,.sql,.csv,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileUploadRef.current?.click()}
              className="flex items-center gap-1 text-muted hover:text-ink text-[11px] bg-canvas hover:bg-surface-soft px-2 py-1 rounded-lg border border-hairline transition-colors"
              title="Upload text or markdown problem file"
            >
              <Upload className="w-3 h-3 text-primary" />
              <span>Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center gap-1 text-[11px] text-muted hover:text-ink px-2 py-1 rounded-lg border border-hairline hover:bg-surface-soft transition-colors"
            >
              <Sparkles className="w-3 h-3 text-accent-amber" />
              <span>Examples</span>
              {showSuggestions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors shadow-2xs"
          >
            <Sparkles className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Generating..." : "Generate ✨"}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Examples Strip */}
      {showSuggestions && (
        <div className="bg-surface-soft/60 border border-hairline rounded-xl p-3.5 mb-4 space-y-2 animate-keyframe-fade-up text-xs">
          <div className="font-semibold text-primary uppercase text-[10px] tracking-wider flex items-center gap-1">
            <Calculator className="w-3 h-3" />
            <span>Optimization Solvers:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {optimizationSuggestions.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPrompt(opt.prompt);
                  handleGenerate(opt.prompt);
                }}
                className="text-[11px] bg-canvas hover:bg-surface-cream text-ink border border-hairline px-2.5 py-1 rounded-pill transition-colors flex items-center gap-1 shadow-2xs text-left"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span>{opt.title}</span>
              </button>
            ))}
          </div>

          {suggestions.length > 0 && (
            <>
              <div className="font-semibold text-muted uppercase text-[10px] tracking-wider pt-2 border-t border-hairline">
                Database Queries:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(sug);
                      handleGenerate(sug);
                    }}
                    className="text-[11px] bg-canvas hover:bg-surface-cream text-ink border border-hairline px-2.5 py-1 rounded-pill transition-colors flex items-center gap-1 shadow-2xs text-left"
                  >
                    <Sparkles className="w-3 h-3 text-primary opacity-60" />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-[#fdf2f2] border border-[#f5c6c6] text-error p-3.5 rounded-xl text-xs flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="bg-surface-card border border-hairline rounded-2xl p-4 shadow-sm space-y-3 animate-keyframe-fade-up text-ink">
          <div className="flex items-center justify-between text-xs border-b border-hairline pb-2.5">
            <span className="font-semibold text-ink uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {result.isOptimizationModel ? "Optimization Formulation" : "Generated SQL Query"}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 bg-canvas hover:bg-surface-soft text-ink px-2.5 py-1 rounded-lg text-xs border border-hairline transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              {result.isOptimizationModel && onNavigateToOr && (
                <button
                  onClick={() => onNavigateToOr(result.orModule)}
                  className="flex items-center gap-1 bg-accent-teal/15 text-accent-teal hover:bg-accent-teal/25 border border-accent-teal/30 font-semibold px-2.5 py-1 rounded-lg text-xs transition-colors"
                >
                  <Calculator className="w-3 h-3" />
                  <span>Open Solver</span>
                </button>
              )}

              <button
                onClick={() => onApplySql(result.sql, true)}
                className="flex items-center gap-1 bg-primary hover:bg-primary-active text-on-primary font-semibold px-3 py-1 rounded-lg text-xs transition-colors shadow-2xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Execute</span>
              </button>
            </div>
          </div>

          <pre className="font-mono text-xs text-ink bg-canvas p-3.5 rounded-xl overflow-x-auto leading-relaxed border border-hairline">
            {result.sql}
          </pre>

          {result.explanation && (
            <div className="text-xs text-body flex items-start gap-2 bg-canvas/60 p-3 rounded-xl leading-relaxed whitespace-pre-line border border-hairline-soft">
              <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>{result.explanation}</span>
            </div>
          )}

          {result.suggestedQuestions && result.suggestedQuestions.length > 0 && (
            <div className="pt-2 border-t border-hairline space-y-1">
              <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">
                Follow-up Questions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {result.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(q);
                      handleGenerate(q);
                    }}
                    className="text-[11px] bg-canvas hover:bg-surface-cream text-ink px-2.5 py-0.5 rounded-md border border-hairline transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
