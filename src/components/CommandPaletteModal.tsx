import React, { useState, useEffect } from "react";
import {
  Search,
  Terminal,
  Network,
  Sparkles,
  TrendingUp,
  Sun,
  Moon,
  Laptop,
  Play,
  FileCode,
  Download,
  X,
  Command,
} from "lucide-react";
import { OrModule } from "../services/or/types";
import { ThemeMode } from "../services/theme";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateView: (view: "editor" | "diagram" | "ai" | "or") => void;
  onSelectOrModule: (module: OrModule) => void;
  onThemeChange: (mode: ThemeMode) => void;
  onOpenOcr: () => void;
  onExecuteQuery: () => void;
  onExportDb: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateView,
  onSelectOrModule,
  onThemeChange,
  onOpenOcr,
  onExecuteQuery,
  onExportDb,
}) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      category: "Navigation Views",
      items: [
        { name: "TORA Operations Research Suite", shortcut: "⌘1", icon: TrendingUp, run: () => { onNavigateView("or"); onClose(); } },
        { name: "Query Editor & SQL Worksheet", shortcut: "⌘2", icon: Terminal, run: () => { onNavigateView("editor"); onClose(); } },
        { name: "Schema Visualizer (ER Diagram)", shortcut: "⌘3", icon: Network, run: () => { onNavigateView("diagram"); onClose(); } },
        { name: "AI Assistant Chat", shortcut: "⌘4", icon: Sparkles, run: () => { onNavigateView("ai"); onClose(); } },
      ],
    },
    {
      category: "TORA Solvers",
      items: [
        { name: "Transportation & Assignment (VAM)", icon: TrendingUp, run: () => { onSelectOrModule("transportation-assignment"); onNavigateView("or"); onClose(); } },
        { name: "Linear Programming (Simplex / 2D)", icon: TrendingUp, run: () => { onSelectOrModule("linear-programming"); onNavigateView("or"); onClose(); } },
        { name: "Network Models (Dijkstra / MST / Max-Flow)", icon: Network, run: () => { onSelectOrModule("network-models"); onNavigateView("or"); onClose(); } },
        { name: "Project Planning (CPM / PERT)", icon: TrendingUp, run: () => { onSelectOrModule("project-planning"); onNavigateView("or"); onClose(); } },
        { name: "Inventory Control (EOQ)", icon: TrendingUp, run: () => { onSelectOrModule("inventory-control"); onNavigateView("or"); onClose(); } },
        { name: "Queuing Analysis (M/M/1 & M/M/c)", icon: TrendingUp, run: () => { onSelectOrModule("queuing-models"); onNavigateView("or"); onClose(); } },
        { name: "Zero-Sum Games & Matrix Theory", icon: TrendingUp, run: () => { onSelectOrModule("zero-sum-games"); onNavigateView("or"); onClose(); } },
        { name: "Linear Equations (Gauss-Jordan Ax = b)", icon: TrendingUp, run: () => { onSelectOrModule("linear-equations"); onNavigateView("or"); onClose(); } },
      ],
    },
    {
      category: "Actions & Tools",
      items: [
        { name: "Scan OCR Question or Problem Text", shortcut: "⌘O", icon: FileCode, run: () => { onOpenOcr(); onClose(); } },
        { name: "Run SQL Query in SQLite WASM", shortcut: "⌘↵", icon: Play, run: () => { onExecuteQuery(); onClose(); } },
        { name: "Export Current SQLite Database (.sqlite)", icon: Download, run: () => { onExportDb(); onClose(); } },
      ],
    },
    {
      category: "Theme & Display",
      items: [
        { name: "Switch to Light Mode", icon: Sun, run: () => { onThemeChange("light"); onClose(); } },
        { name: "Switch to Dark Mode", icon: Moon, run: () => { onThemeChange("dark"); onClose(); } },
        { name: "Switch to System Auto Theme", icon: Laptop, run: () => { onThemeChange("system"); onClose(); } },
      ],
    },
  ];

  const filteredCategories = actions
    .map((cat) => ({
      category: cat.category,
      items: cat.items.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-start justify-center pt-20 p-4 select-none animate-in fade-in duration-150"
    >
      <div className="bg-surface-card border border-hairline w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-keyframe-scale">
        {/* Search Input */}
        <div className="p-3.5 border-b border-hairline flex items-center gap-3 bg-surface-soft">
          <Search className="w-4 h-4 text-muted shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search view... (Esc to close)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted-soft focus:outline-none font-sans"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-muted bg-canvas border border-hairline px-1.5 py-0.5 rounded">
            <Command className="w-3 h-3" />K
          </kbd>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-ink rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto space-y-3 flex-1 text-xs">
          {filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-muted italic">
              No matching commands found
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div key={cat.category} className="space-y-0.5">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {cat.category}
                </div>
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={item.run}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-surface-cream text-ink font-medium transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-muted group-hover:text-primary transition-colors shrink-0" />
                        <span className="text-xs">{item.name}</span>
                      </div>
                      {item.shortcut && (
                        <kbd className="font-mono text-[10px] text-muted bg-canvas px-1.5 py-0.5 rounded border border-hairline group-hover:border-primary/40 transition-colors">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
