import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  TrendingUp,
  Truck,
  Network,
  Calendar,
  Package,
  Clock,
  Swords,
  Calculator,
  PanelLeftClose,
  Sun,
  Moon,
  Laptop,
  Terminal,
  Sparkles,
  Table,
  Eye,
  ChevronRight,
  ChevronDown,
  Key,
} from "lucide-react";
import { DatabaseSchema } from "../types";
import { OrModule } from "../services/or/types";
import {
  getThemePreference,
  applyTheme,
  initThemeListener,
  ThemeMode,
} from "../services/theme";

const STORAGE_WIDTH_KEY = "torsz_sidebar_width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

interface SidebarProps {
  activeView: "editor" | "diagram" | "ai" | "or";
  onSelectView: (view: "editor" | "diagram" | "ai" | "or") => void;
  schema: DatabaseSchema | null;
  selectedTable?: string | null;
  onSelectTable: (tableName: string) => void;
  loadingSchema?: boolean;
  activeOrModule: OrModule;
  onSelectOrModule: (module: OrModule) => void;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  schema,
  onSelectTable,
  loadingSchema = false,
  activeOrModule,
  onSelectOrModule,
  onToggle,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemePreference);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [width, setWidth] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_WIDTH_KEY);
      if (stored) {
        const val = parseInt(stored, 10);
        if (val >= MIN_WIDTH && val <= MAX_WIDTH) return val;
      }
    } catch {}
    return DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    applyTheme(themeMode);
    return initThemeListener((mode) => {
      setThemeMode(mode);
    });
  }, [themeMode]);

  // Save width to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WIDTH_KEY, String(width));
    } catch {}
  }, [width]);

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = widthRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX))
      );
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleDoubleClickReset = () => {
    setWidth(DEFAULT_WIDTH);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
  };

  const orModules = [
    { id: "linear-programming", name: "Linear Programming", icon: TrendingUp },
    { id: "transportation-assignment", name: "Transportation & Assignment", icon: Truck },
    { id: "network-models", name: "Network Models", icon: Network },
    { id: "project-planning", name: "Project Planning (CPM/PERT)", icon: Calendar },
    { id: "inventory-control", name: "Inventory Control (EOQ)", icon: Package },
    { id: "queuing-models", name: "Queuing Analysis", icon: Clock },
    { id: "zero-sum-games", name: "Zero-Sum Games", icon: Swords },
    { id: "linear-equations", name: "Linear Equations", icon: Calculator },
  ];

  const views = [
    { id: "editor", name: "Query Editor", icon: Terminal },
    { id: "diagram", name: "Schema Visualizer", icon: Network },
    { id: "ai", name: "AI Assistant", icon: Sparkles },
    { id: "or", name: "TORA Solvers", icon: TrendingUp },
  ] as const;

  const tables = schema?.tables.filter((t) => t.table_type === "table") || [];
  const viewsList = schema?.tables.filter((t) => t.table_type === "view") || [];

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredViews = viewsList.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrModules = orModules.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCompact = width < 230;

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`relative bg-surface-card border-r border-hairline flex flex-col h-[calc(100vh-3.5rem)] select-none text-body shrink-0 transition-none ${
        isDragging ? "cursor-col-resize select-none" : ""
      }`}
    >
      {/* 1. TOP: Workspace Views Section */}
      <div className="p-2.5 border-b border-hairline bg-surface-soft shrink-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
            Views
          </span>
          {onToggle && (
            <button
              onClick={onToggle}
              title="Collapse Sidebar (⌘B)"
              className="p-1 text-muted hover:text-ink rounded hover:bg-surface-cream transition-colors shrink-0"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className={`grid gap-1 ${isCompact ? "grid-cols-1" : "grid-cols-2"}`}>
          {views.map((v) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;

            return (
              <button
                key={v.id}
                onClick={() => onSelectView(v.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left min-w-0 truncate ${
                  isActive
                    ? "bg-canvas text-ink font-semibold shadow-xs border border-hairline ring-1 ring-primary/20"
                    : "text-muted hover:text-ink hover:bg-surface-cream/70"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary font-bold" : "text-muted"}`} />
                <span className={`truncate text-[11px] ${isActive ? "text-ink font-semibold" : ""}`}>
                  {v.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MIDDLE: Context-Aware Section */}
      {activeView === "editor" ? (
        /* Query Editor: Database Tables & Schema Trees */
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 animate-keyframe-fade-up">
          <div className="p-2 border-b border-hairline bg-surface-soft/60 shrink-0">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-muted shrink-0" />
              <input
                type="text"
                placeholder={isCompact ? "Filter..." : "Filter tables..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-md pl-7 pr-2.5 py-1 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {loadingSchema ? (
              <div className="p-4 text-center text-xs text-muted">
                <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
                <p className="text-[11px]">Loading schema...</p>
              </div>
            ) : !schema || filteredTables.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted italic">
                No database tables found
              </div>
            ) : (
              <>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">
                  Tables ({filteredTables.length})
                </div>

                {filteredTables.map((table) => (
                  <div key={table.name} className="group">
                    <div
                      onClick={() => toggleTable(table.name)}
                      className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-surface-cream text-xs text-ink cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {expandedTables[table.name] ? (
                          <ChevronDown className="w-3 h-3 text-muted shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted shrink-0" />
                        )}
                        <Table className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-[11px] truncate">{table.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTable(table.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-primary hover:underline px-1 py-0.2"
                      >
                        SELECT
                      </button>
                    </div>

                    {/* Columns Subtree */}
                    {expandedTables[table.name] && (
                      <div className="pl-5 pr-1 py-0.5 space-y-0.5 border-l border-hairline ml-3 my-0.5">
                        {table.columns.map((col) => (
                          <div
                            key={col.name}
                            className="flex items-center justify-between text-[10px] text-body py-0.2"
                          >
                            <div className="flex items-center gap-1 truncate">
                              {col.is_primary_key && (
                                <Key className="w-2.5 h-2.5 text-accent-amber shrink-0" />
                              )}
                              <span className="truncate">{col.name}</span>
                            </div>
                            <span className="text-[9px] font-mono text-muted-soft bg-canvas px-1 rounded border border-hairline-soft shrink-0">
                              {col.data_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {filteredViews.length > 0 && (
                  <div className="pt-2 border-t border-hairline-soft mt-2">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">
                      Views ({filteredViews.length})
                    </div>
                    {filteredViews.map((view) => (
                      <div
                        key={view.name}
                        onClick={() => onSelectTable(view.name)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-surface-cream text-xs text-ink cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-accent-teal opacity-80 shrink-0" />
                        <span className="text-[11px] truncate">{view.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : activeView === "or" ? (
        /* TORA Solvers: Optimization Models Navigation */
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 animate-keyframe-fade-up">
          <div className="p-2 border-b border-hairline bg-surface-soft/60 shrink-0">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2 text-muted shrink-0" />
              <input
                type="text"
                placeholder={isCompact ? "Search..." : "Filter solvers..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-md pl-7 pr-2.5 py-1 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOrModules.map((m) => {
              const Icon = m.icon;
              const isActive = activeOrModule === m.id;

              return (
                <button
                  key={m.id}
                  onClick={() => onSelectOrModule(m.id as OrModule)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors min-w-0 ${
                    isActive
                      ? "bg-canvas text-ink border border-hairline shadow-xs font-semibold ring-1 ring-primary/30"
                      : "text-body hover:text-ink hover:bg-surface-cream/70"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary font-bold" : "text-muted"}`} />
                  <span className={`text-xs truncate ${isActive ? "text-primary font-semibold" : "text-ink font-medium"}`}>
                    {m.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* 3. BOTTOM: Compact Theme Switcher */}
      <div className="p-2 border-t border-hairline bg-surface-soft shrink-0 select-none">
        <div className="grid grid-cols-3 gap-1 bg-canvas p-0.5 rounded-lg border border-hairline">
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={`flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold transition-colors truncate ${
              themeMode === "light"
                ? "bg-surface-card text-ink shadow-2xs border border-hairline font-bold"
                : "text-muted hover:text-ink"
            }`}
            title="Light Mode"
          >
            <Sun className="w-3 h-3 text-accent-amber shrink-0" />
            <span>Light</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={`flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold transition-colors truncate ${
              themeMode === "dark"
                ? "bg-surface-card text-ink shadow-2xs border border-hairline font-bold"
                : "text-muted hover:text-ink"
            }`}
            title="Dark Mode"
          >
            <Moon className="w-3 h-3 text-accent-teal shrink-0" />
            <span>Dark</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            className={`flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold transition-colors truncate ${
              themeMode === "system"
                ? "bg-surface-card text-ink shadow-2xs border border-hairline font-bold"
                : "text-muted hover:text-ink"
            }`}
            title="Auto"
          >
            <Laptop className="w-3 h-3 shrink-0" />
            <span>Auto</span>
          </button>
        </div>
      </div>

      {/* Interactive Resizing Drag Handle */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClickReset}
        title="Drag to resize sidebar (Double-click to reset)"
        className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 transition-colors z-30 group ${
          isDragging ? "bg-primary w-2" : "bg-transparent"
        }`}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-hairline group-hover:bg-primary transition-colors opacity-0 group-hover:opacity-100" />
      </div>
    </aside>
  );
};
