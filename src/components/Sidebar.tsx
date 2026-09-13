import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    applyTheme(themeMode);
    return initThemeListener((mode) => {
      setThemeMode(mode);
    });
  }, [themeMode]);

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

  return (
    <aside className="w-64 bg-surface-card border-r border-hairline flex flex-col h-[calc(100vh-3.5rem)] select-none text-body shrink-0">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-hairline bg-surface-soft shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="font-editorial-serif text-lg font-medium text-ink truncate">
              TORA Solvers
            </span>
          </div>
          {onToggle && (
            <button
              onClick={onToggle}
              title="Collapse Sidebar (⌘B)"
              className="p-1 text-muted hover:text-ink rounded hover:bg-surface-cream transition-colors"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Solvers */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search optimization models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-canvas border border-hairline rounded-md pl-8 pr-3 py-1 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none"
          />
        </div>
      </div>

      {/* Solvers Vertical Navigation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
          Optimization Models ({filteredOrModules.length})
        </div>

        {filteredOrModules.map((m) => {
          const Icon = m.icon;
          const isActive = activeView === "or" && activeOrModule === m.id;

          return (
            <button
              key={m.id}
              onClick={() => {
                onSelectOrModule(m.id as OrModule);
                onSelectView("or");
              }}
              className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                isActive
                  ? "bg-canvas text-ink border border-hairline shadow-xs font-semibold ring-1 ring-primary/20"
                  : "text-body hover:text-ink hover:bg-surface-cream/70"
              }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? "text-primary font-bold" : "text-muted"}`} />
              <div className="flex-1 truncate">
                <div className={`text-xs truncate ${isActive ? "text-primary font-semibold" : "text-ink font-medium"}`}>
                  {m.name}
                </div>
                <div className="text-[10px] text-muted-soft truncate">
                  {m.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Views Relocated to Bottom of Sidebar */}
      <div className="p-2 border-t border-hairline bg-surface-soft shrink-0 space-y-1 select-none">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted mb-0.5">
          Workspace Views
        </div>

        <div className="grid grid-cols-2 gap-1">
          {views.map((v) => {
            const Icon = v.icon;
            const isActive = activeView === v.id;

            return (
              <button
                key={v.id}
                onClick={() => onSelectView(v.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-left truncate ${
                  isActive
                    ? "bg-surface-card text-ink font-semibold shadow-xs border border-hairline"
                    : "text-muted hover:text-ink hover:bg-surface-cream/50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted"}`} />
                <span className="truncate text-[11px]">{v.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Mode Switcher Pinned to Sidebar Bottom */}
      <div className="p-2.5 border-t border-hairline bg-surface-soft shrink-0 select-none">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5 px-1">
          <span>Theme</span>
          <span className="text-[10px] text-primary capitalize font-medium">{themeMode}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-canvas p-1 rounded-xl border border-hairline">
          <button
            type="button"
            onClick={() => handleThemeChange("light")}
            className={`flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
              themeMode === "light"
                ? "bg-surface-card text-ink shadow-xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-soft"
            }`}
            title="Light Mode (Default)"
          >
            <Sun className="w-3.5 h-3.5 text-accent-amber" />
            <span className="text-[11px]">Light</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("dark")}
            className={`flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
              themeMode === "dark"
                ? "bg-surface-card text-ink shadow-xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-soft"
            }`}
            title="Dark Mode"
          >
            <Moon className="w-3.5 h-3.5 text-accent-teal" />
            <span className="text-[11px]">Dark</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange("system")}
            className={`flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
              themeMode === "system"
                ? "bg-surface-card text-ink shadow-xs border border-hairline font-bold"
                : "text-muted hover:text-ink hover:bg-surface-soft"
            }`}
            title="Auto / System Preference"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span className="text-[11px]">Auto</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
