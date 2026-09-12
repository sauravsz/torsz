import React, { useState, useEffect } from "react";
import { History, X, Play, Copy, Check, Trash2, Search, Clock, Hash, AlertCircle, CheckCircle2 } from "lucide-react";
import { QueryHistoryItem, getQueryHistory, deleteHistoryItem, clearQueryHistory } from "../services/history";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (sql: string, autoRun?: boolean) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectQuery,
}) => {
  const [items, setItems] = useState<QueryHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setItems(getQueryHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = items.filter((item) =>
    item.sql.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = (item: QueryHistoryItem) => {
    navigator.clipboard.writeText(item.sql);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    const updated = deleteHistoryItem(id);
    setItems(updated);
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all query history?")) {
      clearQueryHistory();
      setItems([]);
    }
  };

  const formatTimestamp = (ts: number): string => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-canvas border border-hairline rounded-xl shadow-2xl max-w-3xl w-full h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-surface-card px-6 py-4 border-b border-hairline flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-editorial-serif text-2xl font-medium text-ink">
              Query History
            </h3>
            <span className="text-xs font-mono text-muted bg-canvas px-2 py-0.5 rounded-full border border-hairline ml-2">
              {items.length} queries
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-muted hover:text-ink p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 bg-surface-soft border-b border-hairline flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Search past queries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-canvas border border-hairline rounded-lg pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none"
            />
          </div>

          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs text-muted hover:text-error px-2.5 py-1.5 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {/* History Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted">
              <Clock className="w-10 h-10 text-muted-soft opacity-50 mb-2" />
              <p className="font-editorial-serif text-lg text-ink mb-1">
                {search ? "No Matching Queries" : "No Query History Yet"}
              </p>
              <p className="text-xs text-muted-soft">
                {search
                  ? "Try a different search term."
                  : "Executed queries will automatically be recorded here across sessions."}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-surface-card border border-hairline hover:border-primary/50 rounded-xl p-4 transition-all duration-150 shadow-2xs space-y-3 group"
              >
                {/* Item Header */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 font-medium text-ink">
                      {item.status === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-error" />
                      )}
                      <span className="text-[11px] text-muted">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-muted-soft text-[11px]">
                      <Clock className="w-3 h-3" />
                      <span>{item.executionTimeMs} ms</span>
                    </div>

                    {item.rowCount !== null && (
                      <div className="flex items-center gap-1 text-muted-soft text-[11px]">
                        <Hash className="w-3 h-3" />
                        <span>{item.rowCount} rows</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
                    <button
                      onClick={() => handleCopy(item)}
                      className="flex items-center gap-1 text-[11px] text-muted hover:text-ink bg-canvas px-2 py-1 rounded border border-hairline transition-colors"
                      title="Copy SQL"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-success" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedId === item.id ? "Copied" : "Copy"}</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectQuery(item.sql, false);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-ink bg-surface-cream hover:bg-canvas px-2.5 py-1 rounded border border-hairline transition-colors"
                    >
                      <span>Load in Editor</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectQuery(item.sql, true);
                        onClose();
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-on-primary bg-primary hover:bg-primary-active px-2.5 py-1 rounded transition-colors shadow-2xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Run</span>
                    </button>

                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-muted hover:text-error p-1 rounded transition-colors ml-1"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* SQL Body */}
                <pre className="font-mono text-xs text-on-dark bg-surface-dark p-3 rounded-lg overflow-x-auto leading-relaxed border border-surface-dark-elevated max-h-36">
                  {item.sql}
                </pre>

                {item.errorMessage && (
                  <p className="text-[11px] text-error bg-[#fdf2f2] p-2 rounded border border-[#f5c6c6]">
                    {item.errorMessage}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
