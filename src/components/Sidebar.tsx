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
const DEFAULT_WIDTH = 270;
const MIN_WIDTH = 200;
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  schema,
  onSelectTable,
  loadingSchema = false,
  activeOrModule,
  onSelectOrModule,
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

  const isCompact = width < 240;

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`relative bg-surface-card border border-hairline rounded-2xl flex flex-col h-full select-none text-body shrink-0 overflow-hidden shadow-2xs transition-none ${
        isDragging ? "cursor-col-resize select-none" : ""
      }`}
    >
      {/* 1. TOP: Workspace Views Section */}
      <div className="p-3 border-b border-hairline bg-surface-soft shrink-0 space-y-2">
        <div className="px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted truncate">
            Views
          </span>
        </div>

        <div className={`grid gap-1.5 ${isCompact ? "grid-cols-1" : "grid-cols-2"}`}>
          {views.map((v) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;

            return (
              <button
                key={v.id}
                onClick={() => onSelectView(v.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left min-w-0 truncate ${
                  isActive
                    ? "bg-canvas text-ink shadow-xs border border-hairline ring-1 ring-primary/30"
                    : "text-muted hover:text-ink hover:bg-surface-cream/70"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary font-bold" : "text-muted"}`} />
                <span className={`truncate text-xs ${isActive ? "text-ink font-bold" : ""}`}>
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
          <div className="p-2.5 border-b border-hairline bg-surface-soft/60 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted shrink-0" />
              <input
                type="text"
                placeholder={isCompact ? "Filter..." : "Filter tables..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingSchema ? (
              <div className="p-4 text-center text-xs text-muted">
                <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-1" />
                <p className="text-xs">Loading schema...</p>
              </div>
            ) : !schema || filteredTables.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted italic">
                No database tables found
              </div>
            ) : (
              <>
                <div className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                  Tables ({filteredTables.length})
                </div>

                {filteredTables.map((table) => (
                  <div key={table.name} className="group">
                    <div
                      onClick={() => toggleTable(table.name)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-surface-cream text-xs text-ink cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {expandedTables[table.name] ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
                        )}
                        <Table className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-xs truncate">{table.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTable(table.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-xs font-semibold text-primary hover:underline px-1.5 py-0.5"
                      >
                        SELECT
                      </button>
                    </div>

                    {/* Columns Subtree */}
                    {expandedTables[table.name] && (
                      <div className="pl-6 pr-1.5 py-1 space-y-1 border-l border-hairline ml-3.5 my-0.5">
                        {table.columns.map((col) => (
                          <div
                            key={col.name}
                            className="flex items-center justify-between text-xs text-body py-0.5"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {col.is_primary_key && (
                                <Key className="w-3 h-3 text-accent-amber shrink-0" />
                              )}
                              <span className="truncate">{col.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-soft bg-canvas px-1.5 py-0.2 rounded border border-hairline-soft shrink-0">
                              {col.data_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {filteredViews.length > 0 && (
                  <div className="pt-2.5 border-t border-hairline-soft mt-2.5">
                    <div className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted mb-1">
                      Views ({filteredViews.length})
                    </div>
                    {filteredViews.map((view) => (
                      <div
                        key={view.name}
                        onClick={() => onSelectTable(view.name)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-cream text-xs text-ink cursor-pointer transition-colors"
                      >
                        <Eye className="w-4 h-4 text-accent-teal opacity-80 shrink-0" />
                        <span className="text-xs truncate">{view.name}</span>
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
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredOrModules.map((m) => {
              const Icon = m.icon;
              const isActive = activeOrModule === m.id;

              return (
                <button
                  key={m.id}
                  onClick={() => onSelectOrModule(m.id as OrModule)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors min-w-0 ${
                    isActive
                      ? "bg-canvas text-ink border border-hairline shadow-xs font-semibold ring-1 ring-primary/30"
                      : "text-body hover:text-ink hover:bg-surface-cream/70"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary font-bold" : "text-muted"}`} />
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

      {/* 3. BOTTOM: Compact Icon-Only Theme Switcher */}
      <div className="p-2 border-t border-hairline bg-surface-soft shrink-0 select-none">
        <div className="grid grid-cols-3 gap-1 bg-canvas p-0.5 rounded-lg border border-hairline">
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={`flex items-center justify-center py-1.5 rounded-md transition-colors ${
              themeMode === "light"
                ? "bg-surface-card text-ink shadow-2xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-cream/60"
            }`}
            title="Light Theme"
          >
            <Sun className="w-4 h-4 text-accent-amber shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={`flex items-center justify-center py-1.5 rounded-md transition-colors ${
              themeMode === "dark"
                ? "bg-surface-card text-ink shadow-2xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-cream/60"
            }`}
            title="Dark Theme"
          >
            <Moon className="w-4 h-4 text-accent-teal shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            className={`flex items-center justify-center py-1.5 rounded-md transition-colors ${
              themeMode === "system"
                ? "bg-surface-card text-ink shadow-2xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-cream/60"
            }`}
            title="Auto (System Theme)"
          >
            <Laptop className="w-4 h-4 text-muted-soft shrink-0" />
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
