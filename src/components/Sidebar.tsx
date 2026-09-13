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
  Sparkles,
  Terminal,
} from "lucide-react";
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
  activeOrModule: OrModule;
  onSelectOrModule: (module: OrModule) => void;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  activeOrModule,
  onSelectOrModule,
  onToggle,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemePreference);
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
    { id: "linear-programming", name: "Linear Programming", icon: TrendingUp, desc: "Simplex & 2D Graphical" },
    { id: "transportation-assignment", name: "Transportation & Assignment", icon: Truck, desc: "VAM & Hungarian" },
    { id: "network-models", name: "Network Models", icon: Network, desc: "Dijkstra, MST, Max Flow" },
    { id: "project-planning", name: "Project Planning (CPM/PERT)", icon: Calendar, desc: "Critical Path & Float" },
    { id: "inventory-control", name: "Inventory Control (EOQ)", icon: Package, desc: "Order Qty & Cycle Times" },
    { id: "queuing-models", name: "Queuing Analysis", icon: Clock, desc: "M/M/1 & M/M/c Waiting" },
    { id: "zero-sum-games", name: "Zero-Sum Games", icon: Swords, desc: "Minimax & Saddle Points" },
    { id: "linear-equations", name: "Linear Equations", icon: Calculator, desc: "Gauss-Jordan Ax = b" },
  ];

  const views = [
    { id: "editor", name: "Query Editor", icon: Terminal },
    { id: "diagram", name: "Schema Visualizer", icon: Network },
    { id: "ai", name: "AI Assistant", icon: Sparkles },
    { id: "or", name: "TORA Solvers", icon: TrendingUp },
  ] as const;

  const filteredOrModules = orModules.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="p-3 border-b border-hairline bg-surface-soft shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">
            Workspace Views
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
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 text-left min-w-0 truncate ${
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

      {/* 2. MIDDLE: Conditional TORA Optimization Models (Only visible when TORA Solvers view is active) */}
      {activeView === "or" ? (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 animate-keyframe-fade-up">
          {/* Solvers Search Header */}
          <div className="p-3 border-b border-hairline bg-surface-soft/60 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted shrink-0" />
              <input
                type="text"
                placeholder={isCompact ? "Search..." : "Search optimization models..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-canvas border border-hairline rounded-md pl-8 pr-3 py-1 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>

          {/* Solvers Vertical Navigation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary mb-1 truncate flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                {isCompact ? `Models (${filteredOrModules.length})` : `Optimization Models (${filteredOrModules.length})`}
              </span>
            </div>

            {filteredOrModules.map((m) => {
              const Icon = m.icon;
              const isActive = activeOrModule === m.id;

              return (
                <button
                  key={m.id}
                  onClick={() => onSelectOrModule(m.id as OrModule)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 min-w-0 ${
                    isActive
                      ? "bg-canvas text-ink border border-hairline shadow-xs font-semibold ring-1 ring-primary/30"
                      : "text-body hover:text-ink hover:bg-surface-cream/70"
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? "text-primary font-bold" : "text-muted"}`} />
                  <div className="flex-1 min-w-0 truncate">
                    <div className={`text-xs truncate ${isActive ? "text-primary font-semibold" : "text-ink font-medium"}`}>
                      {m.name}
                    </div>
                    {!isCompact && (
                      <div className="text-[10px] text-muted-soft truncate">
                        {m.desc}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty / Contextual State when not in TORA Solvers */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted select-none">
          <div className="w-10 h-10 rounded-2xl bg-surface-soft border border-hairline flex items-center justify-center text-muted-soft mb-2.5 shadow-2xs">
            {activeView === "editor" ? (
              <Terminal className="w-5 h-5 text-primary" />
            ) : activeView === "diagram" ? (
              <Network className="w-5 h-5 text-accent-teal" />
            ) : (
              <Sparkles className="w-5 h-5 text-accent-amber" />
            )}
          </div>
          <p className="text-xs font-semibold text-ink capitalize mb-1">
            {activeView === "editor"
              ? "Query Editor Mode"
              : activeView === "diagram"
              ? "Schema Visualizer Mode"
              : "AI Assistant Mode"}
          </p>
          <p className="text-[11px] text-muted-soft leading-relaxed max-w-[190px]">
            {activeView === "editor"
              ? "Use the top tables bar to query database relations."
              : activeView === "diagram"
              ? "Inspect live ER relationships & foreign key maps."
              : "Ask questions or formulate queries with AI."}
          </p>
        </div>
      )}

      {/* 3. BOTTOM: Theme Switcher Pinned to Sidebar Bottom */}
      <div className="p-2.5 border-t border-hairline bg-surface-soft shrink-0 select-none">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 px-1">
          <span>Theme</span>
          <span className="text-[10px] text-primary capitalize font-medium">{themeMode}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-canvas p-1 rounded-xl border border-hairline">
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={`flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all duration-150 truncate ${
              themeMode === "light"
                ? "bg-surface-card text-ink shadow-xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-soft"
            }`}
            title="Light Mode (Default)"
          >
            <Sun className="w-3.5 h-3.5 text-accent-amber shrink-0" />
            <span className="text-[11px] truncate">{isCompact ? "L" : "Light"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={`flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all duration-150 truncate ${
              themeMode === "dark"
                ? "bg-surface-card text-ink shadow-xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-soft"
            }`}
            title="Dark Mode"
          >
            <Moon className="w-3.5 h-3.5 text-accent-teal shrink-0" />
            <span className="text-[11px] truncate">{isCompact ? "D" : "Dark"}</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            className={`flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all duration-150 truncate ${
              themeMode === "system"
                ? "bg-surface-card text-ink shadow-xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-soft"
            }`}
            title="Auto / System Preference"
          >
            <Laptop className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] truncate">{isCompact ? "Auto" : "Auto"}</span>
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
