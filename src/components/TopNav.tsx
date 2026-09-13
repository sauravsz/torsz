import React from "react";
import { Sparkles, RefreshCw, FileSpreadsheet, History, PanelLeft, PanelLeftClose, Download } from "lucide-react";
import { ConnectionConfig } from "../types";
interface TopNavProps {
  activeConnection: ConnectionConfig | null;
  savedConnections: ConnectionConfig[];
  onSelectConnection: (conn: ConnectionConfig) => void;

  onLoadSampleDb: () => void;
  onRefreshSchema: () => void;
  onImportSpreadsheet: (file: File) => void;
  onOpenHistory: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onExportDatabase?: () => void;

  loading: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeConnection,
  savedConnections,
  onSelectConnection,

  onLoadSampleDb,
  onRefreshSchema,

  onImportSpreadsheet,
  onOpenHistory,
  isSidebarOpen = true,
  onToggleSidebar,
  onExportDatabase,

  loading,
}) => {
  return (
    <header className="h-14 bg-canvas border-b border-hairline px-4 flex items-center justify-between select-none z-20">
      {/* Brand & Spike Mark */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer">
          {/* Anthropic 4-spoke radial spike mark */}
          <svg
            className="w-5 h-5 text-primary"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2C12.5523 2 13 6.02944 13 11H18C18 11.5523 13.9706 12 8.97056 12C13.9706 12 18 12.4477 18 13H13C13 17.9706 12.5523 22 12 22C11.4477 22 11 17.9706 11 13H6C6 12.4477 10.0294 12 15.0294 12C10.0294 12 6 11.5523 6 11H11C11 6.02944 11.4477 2 12 2Z" />
          </svg>
          <span className="font-editorial-serif text-[28px] font-bold tracking-tight text-ink">
            torsz
          </span>
        </div>

        {/* Sidebar Collapse Toggle Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={isSidebarOpen ? "Collapse Sidebar (⌘B)" : "Expand Sidebar (⌘B)"}
            className="p-1.5 text-muted hover:text-ink hover:bg-surface-soft rounded-md border border-hairline transition-colors ml-1"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4 text-primary" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Connection & Actions Cluster */}
      <div className="flex items-center gap-2">
        {/* Connection Selector */}
        {activeConnection ? (
          <div className="flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-md border border-hairline">
            <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
            <span className="text-xs font-medium text-ink max-w-[180px] truncate">
              {activeConnection.name}
            </span>
            <span className="text-[10px] text-muted uppercase bg-canvas px-1.5 py-0.5 rounded-sm border border-hairline">
              {activeConnection.driver}
            </span>
            <button
              onClick={onRefreshSchema}
              disabled={loading}
              title="Refresh Schema"
              className="text-muted hover:text-ink transition-colors ml-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        ) : (
          <button
            onClick={onLoadSampleDb}
            disabled={loading}
            className="flex items-center gap-1.5 bg-surface-card hover:bg-surface-cream text-ink text-xs font-medium px-3 py-1.5 rounded-md border border-hairline transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Load Sample SQLite DB
          </button>
        )}

        {/* Saved Connections Dropdown if any */}
        {savedConnections.length > 0 && (
          <select
            value={activeConnection?.id || ""}
            onChange={(e) => {
              const selected = savedConnections.find((c) => c.id === e.target.value);
              if (selected) onSelectConnection(selected);
            }}
            className="bg-canvas border border-hairline text-xs font-medium text-ink px-2.5 py-1.5 rounded-md focus:border-primary outline-none"
          >
            <option value="" disabled>
              Select Connection...
            </option>
            {savedConnections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.driver})
              </option>
            ))}
          </select>
        )}
        {/* Query History Icon-Only Button */}
        <button
          onClick={onOpenHistory}
          className="p-2 text-muted hover:text-ink hover:bg-surface-cream rounded-md border border-hairline transition-colors shadow-2xs"
          title="Query History"
        >
          <History className="w-4 h-4 text-primary" />
        </button>
        {/* Import CSV / Excel Icon-Only Button */}
        <label
          className="p-2 text-muted hover:text-ink hover:bg-surface-cream rounded-md border border-hairline transition-colors cursor-pointer shadow-2xs"
          title="Import CSV / Excel Spreadsheet"
        >
          <FileSpreadsheet className="w-4 h-4 text-accent-teal" />
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.tsv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportSpreadsheet(file);
                e.target.value = "";
              }
            }}
            className="hidden"
          />
        </label>
        {/* Export Full Database Button */}
        {onExportDatabase && (
          <button
            onClick={onExportDatabase}
            className="p-2 text-muted hover:text-ink hover:bg-surface-cream rounded-md border border-hairline transition-colors shadow-2xs"
            title="Export Full Database (.sqlite)"
          >
            <Download className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>
    </header>
  );
};
