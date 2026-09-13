import React, { useState, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import {
  Play,
  RotateCcw,
  Plus,
  X,
  FileCode,
  SearchCheck,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
  ArrowUp,
  AlignLeft,
} from "lucide-react";
import { formatSqlQuery } from "../services/sqlFormatter";
import { DatabaseSchema } from "../types";
const LOCAL_STORAGE_WORKSHEETS_KEY = "torsz_monaco_worksheets";

interface WorksheetTab {
  id: string;
  name: string;
  sql: string;
}

interface SqlEditorProps {
  sql: string;
  onChangeSql: (val: string) => void;
  onExecute: () => void;
  onExplainPlan?: () => void;
  onGenerateFromPrompt?: (prompt: string) => Promise<void>;
  onOpenOptimizationSuite?: (module?: string) => void;
  schema?: DatabaseSchema | null;
  loading: boolean;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  sql,
  onChangeSql,
  onExecute,
  onExplainPlan,
  onGenerateFromPrompt,
  loading,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tabs, setTabs] = useState<WorksheetTab[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_WORKSHEETS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [{ id: "tab_1", name: "Worksheet 1", sql }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || "tab_1");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabRenameValue, setTabRenameValue] = useState("");

  // Persist open worksheets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_WORKSHEETS_KEY, JSON.stringify(tabs));
    } catch {}
  }, [tabs]);

  // Keep active tab synced with current SQL text
  useEffect(() => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, sql } : t))
    );
  }, [sql, activeTabId]);

  const switchTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      setActiveTabId(tabId);
      onChangeSql(target.sql);
    }
  };

  const createTab = () => {
    const nextIdx = tabs.length + 1;
    const newTab: WorksheetTab = {
      id: `tab_${Date.now()}`,
      name: `Worksheet ${nextIdx}`,
      sql: `-- Worksheet ${nextIdx}\nSELECT * FROM products LIMIT 50;\n`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    onChangeSql(newTab.sql);
  };

  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      const nextActive = nextTabs[nextTabs.length - 1];
      setActiveTabId(nextActive.id);
      onChangeSql(nextActive.sql);
    }
  };

  const startRenameTab = (tab: WorksheetTab) => {
    setEditingTabId(tab.id);
    setTabRenameValue(tab.name);
  };

  const commitRenameTab = () => {
    if (editingTabId && tabRenameValue.trim()) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === editingTabId ? { ...t, name: tabRenameValue.trim() } : t
        )
      );
    }
    setEditingTabId(null);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    monaco.editor.defineTheme("torsz-dark-editorial", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "cc785c", fontStyle: "bold" },
        { token: "string", foreground: "5db8a6" },
        { token: "number", foreground: "e8a55a" },
        { token: "comment", foreground: "6c6a64", fontStyle: "italic" },
        { token: "type", foreground: "e8a55a" },
        { token: "identifier", foreground: "faf9f5" },
        { token: "delimiter", foreground: "8e8b82" },
      ],
      colors: {
        "editor.background": "#181715",
        "editor.foreground": "#faf9f5",
        "editor.lineHighlightBackground": "#252320",
        "editorCursor.foreground": "#cc785c",
        "editorLineNumber.foreground": "#6c6a64",
        "editorLineNumber.activeForeground": "#cc785c",
        "editor.selectionBackground": "#3d3d3a80",
        "editor.inactiveSelectionBackground": "#25252380",
      },
    });
    monaco.editor.setTheme("torsz-dark-editorial");

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute();
    });

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      const current = editor.getValue();
      const formatted = formatSqlQuery(current);
      editor.setValue(formatted);
      onChangeSql(formatted);
    });
  };
  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() || !onGenerateFromPrompt) return;
    setIsGenerating(true);
    try {
      await onGenerateFromPrompt(promptText.trim());
      setPromptText("");
    } finally {
      setIsGenerating(false);
    }
  };

  const templates = [
    {
      title: "Active Products by Category",
      sql: `-- Products Grouped by Category with Aggregations\nSELECT \n  c.name AS category_name,\n  COUNT(p.id) AS total_products,\n  ROUND(AVG(p.price), 2) AS avg_price,\n  SUM(p.stock) AS total_units_in_stock\nFROM products p\nJOIN categories c ON p.category_id = c.id\nGROUP BY c.id, c.name\nORDER BY total_products DESC;`,
    },
    {
      title: "Top Spending Customers",
      sql: `-- High Value Customers with Lifetime Spend\nSELECT \n  c.id,\n  c.first_name || ' ' || c.last_name AS customer_name,\n  c.email,\n  COUNT(o.id) AS total_orders,\n  COALESCE(SUM(o.total_amount), 0.0) AS lifetime_spent\nFROM customers c\nLEFT JOIN orders o ON c.id = o.customer_id\nGROUP BY c.id\nORDER BY lifetime_spent DESC\nLIMIT 10;`,
    },
    {
      title: "Transportation Shipping Matrix",
      sql: `-- Shipping Cost Matrix & Route Constraints\nCREATE TABLE IF NOT EXISTS shipping_costs (\n  origin VARCHAR(50),\n  destination VARCHAR(50),\n  cost_per_unit REAL,\n  capacity_units INTEGER\n);\n\nINSERT OR REPLACE INTO shipping_costs VALUES\n  ('Plant A', 'Warehouse 1', 10.0, 100),\n  ('Plant A', 'Warehouse 2', 20.0, 150),\n  ('Plant B', 'Warehouse 1', 12.0, 80),\n  ('Plant B', 'Warehouse 2', 15.0, 200);\n\nSELECT * FROM shipping_costs;`,
    },
    {
      title: "Project CPM Schedule",
      sql: `-- Critical Path Project Activities\nCREATE TABLE IF NOT EXISTS project_tasks (\n  id VARCHAR(5) PRIMARY KEY,\n  name VARCHAR(50),\n  duration_weeks INTEGER,\n  is_critical BOOLEAN\n);\n\nINSERT OR REPLACE INTO project_tasks VALUES\n  ('A', 'Site Prep', 2, 1),\n  ('B', 'Foundation', 4, 1),\n  ('C', 'Framing', 10, 1),\n  ('D', 'Finishing', 7, 1);\n\nSELECT * FROM project_tasks WHERE is_critical = 1;`,
    },
    {
      title: "Inventory Parameters",
      sql: `-- Economic Order Quantity Model\nCREATE TABLE IF NOT EXISTS inventory_eoq (\n  annual_demand INTEGER,\n  order_cost REAL,\n  holding_cost REAL,\n  optimal_order_qty REAL\n);\n\nINSERT OR REPLACE INTO inventory_eoq VALUES (1000, 100.0, 2.0, ROUND(SQRT((2.0 * 100.0 * 1000.0) / 2.0)));\nSELECT * FROM inventory_eoq;`,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#181715] rounded-2xl border border-surface-dark-elevated shadow-lg overflow-hidden select-text">
      {/* Sleek Top Tabs Bar */}
      <div className="h-8 bg-[#141312] border-b border-surface-dark-elevated px-2 flex items-center justify-between select-none overflow-x-auto">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                onDoubleClick={() => startRenameTab(tab)}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                  isActive
                    ? "bg-[#181715] text-[#faf9f5] border border-surface-dark-elevated shadow-xs font-semibold"
                    : "text-muted-soft hover:text-on-dark hover:bg-surface-dark-elevated/40"
                }`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={tabRenameValue}
                    autoFocus
                    onChange={(e) => setTabRenameValue(e.target.value)}
                    onBlur={commitRenameTab}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRenameTab();
                      if (e.key === "Escape") setEditingTabId(null);
                    }}
                    className="bg-surface-dark-elevated text-on-dark text-[11px] px-1 rounded outline-none border border-primary w-20"
                  />
                ) : (
                  <span className="truncate max-w-[100px]">{tab.name}</span>
                )}

                {tabs.length > 1 && (
                  <button
                    onClick={(e) => closeTab(e, tab.id)}
                    className="text-muted-soft hover:text-error p-0.5 rounded transition-colors ml-0.5"
                    title="Close"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={createTab}
            className="p-0.5 text-muted-soft hover:text-on-dark hover:bg-surface-dark rounded transition-colors"
            title="New worksheet"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Minimal Actions Strip */}
        <div className="flex items-center gap-1.5 relative">
          {/* Templates Menu */}
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1 text-[11px] text-muted-soft hover:text-on-dark px-2 py-0.5 rounded hover:bg-surface-dark-elevated transition-colors"
              title="Templates"
            >
              <FileCode className="w-3 h-3 text-accent-teal" />
              <span>Templates</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {showTemplates && (
              <div className="absolute right-0 top-7 w-56 bg-surface-dark border border-surface-dark-elevated rounded-xl shadow-2xl p-1.5 z-50 animate-keyframe-fade-up">
                {templates.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onChangeSql(tpl.sql + "\n");
                      setShowTemplates(false);
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-surface-dark-elevated text-[11px] font-medium text-on-dark transition-colors"
                  >
                    {tpl.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* More Actions (Explain Plan / Format / Clear) */}
          <div className="relative">
            <button
              onClick={() => setShowMoreActions(!showMoreActions)}
              className="p-1 text-muted-soft hover:text-on-dark rounded hover:bg-surface-dark-elevated transition-colors"
              title="More Actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {showMoreActions && (
              <div className="absolute right-0 top-7 w-48 bg-surface-dark border border-surface-dark-elevated rounded-xl shadow-2xl p-1 z-50 animate-keyframe-fade-up text-[11px]">
                {onExplainPlan && (
                  <button
                    onClick={() => {
                      onExplainPlan();
                      setShowMoreActions(false);
                    }}
                    className="w-full flex items-center gap-1.5 p-2 rounded-lg hover:bg-surface-dark-elevated text-on-dark transition-colors"
                  >
                    <SearchCheck className="w-3.5 h-3.5 text-accent-teal" />
                    <span>Explain Plan & Profiler</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const formatted = formatSqlQuery(sql);
                    onChangeSql(formatted);
                    setShowMoreActions(false);
                  }}
                  className="w-full flex items-center gap-1.5 p-2 rounded-lg hover:bg-surface-dark-elevated text-on-dark transition-colors"
                >
                  <AlignLeft className="w-3.5 h-3.5 text-accent-amber" />
                  <span>Format SQL (⇧⌥F)</span>
                </button>
                <button
                  onClick={() => {
                    onChangeSql("");
                    setShowMoreActions(false);
                  }}
                  className="w-full flex items-center gap-1.5 p-2 rounded-lg hover:bg-surface-dark-elevated text-muted-soft hover:text-on-dark transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Editor</span>
                </button>
              </div>
            )}
          </div>
          {/* Primary Run Button */}
          <button
            onClick={onExecute}
            disabled={loading || !sql.trim()}
            className="flex items-center gap-1 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-[11px] font-semibold px-3 py-0.5 rounded-md transition-colors shadow-2xs"
          >
            <Play className={`w-3 h-3 fill-current ${loading ? "animate-spin" : ""}`} />
            <span>Run</span>
          </button>
        </div>
      </div>

      {/* Monaco Code Editor Canvas */}
      <div className="flex-1 w-full h-full relative">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={sql}
          onChange={(val) => onChangeSql(val || "")}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14.5,
            lineHeight: 22,
            fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', monospace",
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            padding: { top: 8, bottom: 44 }, // padding at bottom to clear floating AI input
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            renderLineHighlight: "all",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
          }}
        />

        {/* Small Floating AI Prompt Box */}
        {onGenerateFromPrompt && (
          <div className="absolute bottom-2.5 left-4 right-4 max-w-xl z-20">
            <form
              onSubmit={handlePromptSubmit}
              className="bg-[#1f1e1b]/95 backdrop-blur-md border border-surface-dark-elevated rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-xl focus-within:border-primary/60 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
              <input
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Ask AI to generate, optimize, or fix SQL..."
                className="flex-1 bg-transparent text-xs text-on-dark placeholder:text-muted-soft focus:outline-none font-sans"
              />
              <button
                type="submit"
                disabled={!promptText.trim() || isGenerating}
                className="p-1 bg-primary hover:bg-primary-active disabled:bg-surface-dark disabled:text-muted-soft text-on-primary rounded-lg transition-colors shadow-2xs shrink-0"
                title="Generate SQL with AI"
              >
                <ArrowUp className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
