import React, { useState, useEffect } from "react";
import { Sparkles, Play, Copy, Check, Key, HelpCircle, ArrowRight, Settings, ExternalLink, Upload } from "lucide-react";
import { DatabaseSchema } from "../types";
import {
  convertTextToSql,
  generateSmartSuggestions,
  AiGeneratedSql,
  getStoredAiSettings,
  saveStoredAiSettings,
  AiSettings,
} from "../services/aiAssistant";

interface AiAssistantProps {
  schema: DatabaseSchema | null;
  onApplySql: (sql: string, autoRun?: boolean) => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({ schema, onApplySql }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiGeneratedSql | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings>(getStoredAiSettings);
  const fileUploadRef = React.useRef<HTMLInputElement | null>(null);
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
    <div className="flex-1 bg-canvas flex flex-col h-full overflow-y-auto p-6 max-w-4xl mx-auto w-full select-text">
      {/* Hero Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-editorial-serif text-3xl font-medium text-ink">
              AI SQL Assistant
            </h2>
          </div>
          <p className="text-sm text-body leading-relaxed">
            Ask questions in plain English. <span className="font-semibold text-ink">torsz</span> translates your request into accurate SQL.
          </p>
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1.5 bg-surface-card hover:bg-surface-cream text-ink text-xs font-semibold px-3 py-2 rounded-lg border border-hairline transition-colors shadow-2xs"
        >
          <Settings className="w-4 h-4 text-primary" />
          <span>Configure API</span>
        </button>
      </div>

      {/* Groq / LLM Configuration Panel */}
      {showConfig && (
        <div className="bg-surface-card border border-hairline rounded-xl p-5 mb-6 shadow-sm space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-hairline pb-2.5">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-accent-amber" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
                AI Provider Configuration
              </h4>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Provider</label>
              <select
                value={aiSettings.provider}
                onChange={(e) => {
                  const p = e.target.value as AiSettings["provider"];
                  if (p === "groq") {
                    handleUpdateSettings({
                      provider: "groq",
                      baseUrl: "https://api.groq.com/openai/v1",
                      model: "openai/gpt-oss-120b",
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
                className="w-full bg-canvas border border-hairline rounded-md px-3 py-1.5 text-xs text-ink focus:border-primary outline-none"
              >
                <option value="groq">Groq (Ultra-Fast & Free)</option>
                <option value="custom">Custom (OpenAI / Ollama / OpenRouter)</option>
                <option value="claude">Anthropic Claude</option>
                <option value="local">Offline Built-in Engine</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-ink mb-1">
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
                className="w-full bg-canvas border border-hairline rounded-md px-3 py-1.5 text-xs text-ink font-mono focus:border-primary outline-none"
              />
            </div>

            {aiSettings.provider !== "local" && aiSettings.provider !== "claude" && (
              <>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink mb-1">Base URL</label>
                  <input
                    type="text"
                    value={aiSettings.baseUrl}
                    onChange={(e) => handleUpdateSettings({ baseUrl: e.target.value.trim() })}
                    placeholder="https://api.groq.com/openai/v1"
                    className="w-full bg-canvas border border-hairline rounded-md px-3 py-1.5 text-xs text-ink font-mono focus:border-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Model Name</label>
                  <input
                    type="text"
                    value={aiSettings.model}
                    onChange={(e) => handleUpdateSettings({ model: e.target.value.trim() })}
                    placeholder="openai/gpt-oss-120b"
                    className="w-full bg-canvas border border-hairline rounded-md px-3 py-1.5 text-xs text-ink font-mono focus:border-primary outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <p className="text-[11px] text-muted-soft">
            API keys are stored strictly in your local browser storage. Groq runs fast inference with {aiSettings.model}.
          </p>
        </div>
      )}

      {/* Main Input Card */}
      <div className="bg-surface-card border border-hairline rounded-xl p-5 shadow-sm space-y-4 mb-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted">
              Ask in Plain English
            </label>
            <span className="text-[11px] text-muted font-mono bg-canvas px-2 py-0.5 rounded border border-hairline">
              Provider: {aiSettings.provider.toUpperCase()} ({aiSettings.model})
            </span>
          </div>
          <div className="relative">
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="Type or paste your problem statement, business question, or network optimization problem here... (e.g., 'A company named Rent Car is developing a replacement policy... Find the shortest path'). Press ⌘+Enter to generate."
              className="w-full bg-canvas border border-hairline rounded-lg p-3.5 text-sm text-ink placeholder:text-muted-soft focus:border-primary outline-none transition-colors leading-relaxed font-sans"
            />
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Suggested queries for your data:
            </span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPrompt(sug);
                    handleGenerate(sug);
                  }}
                  className="text-xs bg-canvas hover:bg-surface-cream text-ink border border-hairline px-3 py-1.5 rounded-pill transition-colors flex items-center gap-1.5 shadow-2xs group text-left"
                >
                  <Sparkles className="w-3 h-3 text-primary opacity-70 group-hover:opacity-100 shrink-0" />
                  <span>{sug}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-hairline-soft">
          <div className="flex items-center gap-3 text-[11px] text-muted-soft">
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
              className="flex items-center gap-1.5 text-ink hover:text-primary bg-canvas hover:bg-surface-cream px-2.5 py-1 rounded border border-hairline transition-colors"
            >
              <Upload className="w-3 h-3 text-primary" />
              <span>Upload Problem File (.txt / .md)</span>
            </button>
            <span>
              Press <kbd className="font-mono bg-canvas px-1.5 py-0.5 rounded border border-hairline text-ink">⌘ + Enter</kbd>
            </span>
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="flex items-center gap-2 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <Sparkles className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Generating SQL..." : "Generate SQL ✨"}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-[#fdf2f2] border border-[#f5c6c6] text-error p-4 rounded-xl text-xs flex items-center gap-2 mb-6">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Result Card */}
      {result && (
        <div className="bg-surface-dark border border-surface-dark-elevated rounded-xl p-5 shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs text-on-dark-soft border-b border-surface-dark-elevated pb-3">
            <span className="font-semibold text-on-dark uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Generated SQL Statement
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 bg-surface-dark-elevated hover:bg-surface-dark text-on-dark px-2.5 py-1 rounded text-xs transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy SQL"}</span>
              </button>

              <button
                onClick={() => onApplySql(result.sql, true)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary font-semibold px-3.5 py-1 rounded text-xs transition-colors shadow-xs"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Execute Query</span>
              </button>
            </div>
          </div>

          {/* SQL Block */}
          <pre className="font-mono text-xs text-on-dark bg-surface-dark-soft p-4 rounded-lg overflow-x-auto leading-relaxed border border-surface-dark-elevated">
            {result.sql}
          </pre>

          {/* Explanation */}
          {result.explanation && (
            <div className="text-xs text-on-dark-soft flex items-start gap-2 bg-surface-dark-elevated/40 p-3 rounded-lg">
              <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>{result.explanation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
