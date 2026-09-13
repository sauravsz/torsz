import React, { useRef, useState, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { Play, RotateCcw, Sparkles, Plus, X, Terminal, Calculator, FileCode, SearchCheck } from "lucide-react";
import { DatabaseSchema } from "../types";

export interface WorksheetTab {
  id: string;
  name: string;
  sql: string;
}

const STORAGE_WORKSHEETS_KEY = "torsz_worksheets_tabs_v1";

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
  onOpenOptimizationSuite,
  schema,
  loading,
}) => {
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [tabs, setTabs] = useState<WorksheetTab[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_WORKSHEETS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [{ id: "tab_1", name: "Worksheet 1", sql }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || "tab_1");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabRenameValue, setTabRenameValue] = useState("");

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const completionDisposableRef = useRef<Monaco.IDisposable | null>(null);

  // Sync active worksheet sql to parent
  useEffect(() => {
    const active = tabs.find((t) => t.id === activeTabId);
    if (active && active.sql !== sql) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, sql } : t))
      );
    }
  }, [sql, activeTabId]);

  // Save tabs to storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WORKSHEETS_KEY, JSON.stringify(tabs));
    } catch {}
  }, [tabs]);

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId);
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      onChangeSql(target.sql);
    }
  };

  const createTab = () => {
    const newId = `tab_${Date.now()}`;
    const newName = `Worksheet ${tabs.length + 1}`;
    const newTab: WorksheetTab = { id: newId, name: newName, sql: "-- Write your query here\nSELECT * FROM " };
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newId);
    onChangeSql(newTab.sql);
  };

  const closeTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      const fallback = nextTabs[nextTabs.length - 1];
      setActiveTabId(fallback.id);
      onChangeSql(fallback.sql);
    }
  };

  const startRenameTab = (tab: WorksheetTab) => {
    setEditingTabId(tab.id);
    setTabRenameValue(tab.name);
  };

  const commitRenameTab = () => {
    if (editingTabId && tabRenameValue.trim()) {
      setTabs((prev) =>
        prev.map((t) => (t.id === editingTabId ? { ...t, name: tabRenameValue.trim() } : t))
      );
    }
    setEditingTabId(null);
  };

  // Register Dynamic Monaco Schema Autocomplete
  useEffect(() => {
    if (!monacoRef.current) return;
    const monaco = monacoRef.current;

    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    completionDisposableRef.current = monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: Monaco.languages.CompletionItem[] = [];

        // 1. Table Suggestions
        if (schema && schema.tables) {
          for (const table of schema.tables) {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `"${table.name}"`,
              detail: `Table (${table.columns.length} columns)`,
              documentation: `Table in active database: ${table.name}`,
              range,
            });

            // 2. Column Suggestions
            for (const col of table.columns) {
              suggestions.push({
                label: `${table.name}.${col.name}`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: col.name,
                detail: `${col.data_type} (from ${table.name})`,
                documentation: `Column "${col.name}" of table "${table.name}"`,
                range,
              });
            }
          }
        }

        // 3. SQL Keywords
        const keywords = [
          "SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "INNER JOIN", "GROUP BY", "ORDER BY",
          "HAVING", "LIMIT", "INSERT INTO", "UPDATE", "DELETE FROM", "CREATE TABLE", "DROP TABLE",
          "ALTER TABLE", "DISTINCT", "AS", "COUNT", "SUM", "AVG", "MIN", "MAX", "CASE", "WHEN",
          "THEN", "ELSE", "END", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "IS NULL", "IS NOT NULL"
        ];

        for (const kw of keywords) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          });
        }

        return { suggestions };
      },
    });

    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
    };
  }, [schema]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Custom dark product syntax theme
    monaco.editor.defineTheme("torsz-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "cc785c", fontStyle: "bold" },
        { token: "string", foreground: "5db8a6" },
        { token: "number", foreground: "e8a55a" },
        { token: "comment", foreground: "6c6a64", fontStyle: "italic" },
        { token: "operator", foreground: "cc785c" },
        { token: "identifier", foreground: "faf9f5" },
        { token: "type", foreground: "5db872" },
      ],
      colors: {
        "editor.background": "#181715",
        "editor.foreground": "#faf9f5",
        "editor.lineHighlightBackground": "#252320",
        "editorCursor.foreground": "#cc785c",
        "editorWhitespace.foreground": "#3d3d3a",
        "editorIndentGuide.background": "#252320",
        "editorIndentGuide.activeBackground": "#6c6a64",
        "editorLineNumber.foreground": "#6c6a64",
        "editorLineNumber.activeForeground": "#a09d96",
      },
    });

    monaco.editor.setTheme("torsz-dark");

    // Shortcut Cmd+Enter / Ctrl+Enter to execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute();
    });
  };

  const insertTemplate = (templateSql: string) => {
    onChangeSql(templateSql + "\n");
    setShowTemplates(false);
  };

  return (
    <div className="flex flex-col h-full bg-surface-dark border border-surface-dark-elevated rounded-2xl overflow-hidden shadow-sm">
      {/* Worksheet Tabs Bar */}
      <div className="h-9 bg-[#141312] border-b border-surface-dark-elevated px-2 flex items-center justify-between select-none overflow-x-auto">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = tab.id === editingTabId;

            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                onDoubleClick={() => startRenameTab(tab)}
                className={`group flex items-center gap-1.5 px-3 py-1 text-xs rounded-t-lg transition-colors cursor-pointer border-t-2 ${
                  isActive
                    ? "bg-surface-dark text-on-dark border-primary font-semibold shadow-xs"
                    : "text-muted-soft hover:text-on-dark hover:bg-surface-dark-soft border-transparent"
                }`}
              >
                <Terminal className={`w-3 h-3 ${isActive ? "text-primary" : "text-muted-soft"}`} />

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
                    className="bg-surface-dark-elevated text-on-dark text-xs px-1 rounded outline-none border border-primary w-24"
                  />
                ) : (
                  <span className="truncate max-w-[120px]">{tab.name}</span>
                )}

                {tabs.length > 1 && (
                  <button
                    onClick={(e) => closeTab(e, tab.id)}
                    className="text-muted-soft hover:text-error p-0.5 rounded transition-colors ml-1"
                    title="Close worksheet"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={createTab}
            className="p-1 text-muted-soft hover:text-on-dark hover:bg-surface-dark rounded-md transition-colors ml-1"
            title="Create new query worksheet"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-[10px] text-muted-soft hidden sm:inline pr-2">
          Double-click tab to rename
        </span>
      </div>

      {/* Editor Action Bar */}
      <div className="bg-surface-dark-soft border-b border-surface-dark-elevated px-4 py-2 flex flex-wrap items-center justify-between gap-2 select-none">
        {/* Inline AI Prompt Bar */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Sparkles className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-primary" />
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && aiPrompt.trim() && onGenerateFromPrompt) {
                  e.preventDefault();
                  setGenerating(true);
                  try {
                    await onGenerateFromPrompt(aiPrompt);
                    setAiPrompt("");
                  } finally {
                    setGenerating(false);
                  }
                }
              }}
              placeholder="Ask AI in plain English (e.g. 'top 10 products', 'linear programming model')..."
              className="w-full bg-surface-dark border border-surface-dark-elevated text-xs text-on-dark placeholder:text-muted-soft rounded-xl pl-8 pr-3 py-1.5 outline-none focus:border-primary transition-colors font-sans"
            />
          </div>
          <button
            onClick={async () => {
              if (!aiPrompt.trim() || !onGenerateFromPrompt) return;
              setGenerating(true);
              try {
                await onGenerateFromPrompt(aiPrompt);
                setAiPrompt("");
              } finally {
                setGenerating(false);
              }
            }}
            disabled={generating || !aiPrompt.trim()}
            className="flex items-center gap-1 text-[11px] font-semibold bg-surface-dark-elevated hover:bg-surface-dark text-primary px-3 py-1.5 rounded-xl border border-surface-dark-elevated disabled:opacity-50 transition-colors shrink-0"
          >
            <Sparkles className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Converting..." : "Convert ✨"}</span>
          </button>
        </div>

        {/* Right Actions Cluster */}
        <div className="flex items-center gap-2 relative">
          {/* Templates Dropdown Button */}
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center gap-1 text-[11px] text-on-dark-soft hover:text-on-dark bg-surface-dark hover:bg-surface-dark-elevated px-2.5 py-1.5 rounded-xl border border-surface-dark-elevated transition-colors"
            title="Load SQL & Optimization Templates"
          >
            <FileCode className="w-3.5 h-3.5 text-accent-teal" />
            <span>Templates</span>
          </button>

          {/* Templates Menu Popover */}
          {showTemplates && (
            <div className="absolute right-24 top-9 z-30 w-72 bg-surface-dark border border-surface-dark-elevated rounded-xl shadow-xl p-2 space-y-1 text-xs animate-in fade-in duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-soft">
                TORA Optimization Models
              </div>
              <button
                onClick={() =>
                  insertTemplate(`-- Linear Programming Formulation (Maximize Profit)
CREATE TABLE IF NOT EXISTS lp_variables (
  variable_name VARCHAR(10) PRIMARY KEY,
  optimal_units DOUBLE PRECISION,
  unit_profit DOUBLE PRECISION
);

INSERT OR REPLACE INTO lp_variables VALUES
  ('x1 (Product A)', 3.0, 5.0),
  ('x2 (Product B)', 1.5, 4.0);

SELECT 
  variable_name,
  optimal_units,
  unit_profit,
  (optimal_units * unit_profit) AS total_revenue,
  (SELECT SUM(optimal_units * unit_profit) FROM lp_variables) AS optimal_Z
FROM lp_variables;`)
                }
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-dark-soft text-on-dark transition-colors flex items-center justify-between"
              >
                <span>📈 Linear Programming (LP)</span>
              </button>

              <button
                onClick={() =>
                  insertTemplate(`-- Transportation Shipping Problem Matrix
CREATE TABLE IF NOT EXISTS transportation_costs (
  source_plant VARCHAR(50),
  dest_market VARCHAR(50),
  unit_cost DOUBLE PRECISION,
  allocated_qty INTEGER,
  PRIMARY KEY (source_plant, dest_market)
);

INSERT OR REPLACE INTO transportation_costs VALUES
  ('Plant 1', 'Market 1', 10.0, 0),
  ('Plant 1', 'Market 2', 2.0, 15),
  ('Plant 2', 'Market 3', 9.0, 15),
  ('Plant 3', 'Market 1', 4.0, 5);

SELECT 
  source_plant, 
  dest_market, 
  allocated_qty, 
  unit_cost, 
  (allocated_qty * unit_cost) AS lane_cost 
FROM transportation_costs 
WHERE allocated_qty > 0;`)
                }
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-dark-soft text-on-dark transition-colors flex items-center justify-between"
              >
                <span>🚚 Transportation Cost Matrix</span>
              </button>

              <button
                onClick={() =>
                  insertTemplate(`-- Project Critical Path Activities & Float Schedule
CREATE TABLE IF NOT EXISTS project_cpm (
  activity_id VARCHAR(5) PRIMARY KEY,
  name VARCHAR(50),
  duration_weeks INTEGER,
  early_start INTEGER,
  late_start INTEGER,
  slack_weeks INTEGER,
  is_critical BOOLEAN
);

INSERT OR REPLACE INTO project_cpm VALUES
  ('A', 'Site Prep', 2, 0, 0, 0, 1),
  ('B', 'Foundation', 4, 2, 2, 0, 1),
  ('C', 'Framing', 10, 6, 6, 0, 1),
  ('D', 'Roofing', 6, 16, 16, 0, 1),
  ('E', 'Electrical', 4, 16, 18, 2, 0),
  ('G', 'Finish', 7, 22, 22, 0, 1);

SELECT * FROM project_cpm ORDER BY early_start ASC;`)
                }
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-dark-soft text-on-dark transition-colors flex items-center justify-between"
              >
                <span>📅 Project CPM Schedule</span>
              </button>

              <div className="border-t border-surface-dark-elevated my-1" />

              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-soft">
                Database Analytics
              </div>
              <button
                onClick={() =>
                  insertTemplate(`-- Top 5 Products by Profitability & Category
SELECT 
  p.name AS product_name,
  c.name AS category_name,
  p.price,
  p.stock,
  (p.price * p.stock) AS total_inventory_value
FROM products p
JOIN categories c ON p.category_id = c.id
ORDER BY total_inventory_value DESC
LIMIT 5;`)
                }
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface-dark-soft text-on-dark transition-colors"
              >
                <span>📊 Product Inventory Value</span>
              </button>
            </div>
          )}

          {/* Quick Jump to TORA Suite */}
          {onOpenOptimizationSuite && (
            <button
              onClick={() => onOpenOptimizationSuite()}
              className="flex items-center gap-1 text-[11px] text-accent-teal hover:text-on-dark bg-accent-teal/10 hover:bg-accent-teal/20 px-2.5 py-1.5 rounded-xl border border-accent-teal/30 transition-colors"
              title="Open TORA Operations Research Suite"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>TORA Solvers</span>
            </button>
          )}

          {/* Explain Plan Button */}
          {onExplainPlan && (
            <button
              onClick={onExplainPlan}
              disabled={loading || !sql.trim()}
              className="flex items-center gap-1 text-[11px] text-on-dark-soft hover:text-on-dark bg-surface-dark hover:bg-surface-dark-elevated px-2.5 py-1.5 rounded-xl border border-surface-dark-elevated disabled:opacity-50 transition-colors"
              title="Explain SQLite Query Execution Plan (EXPLAIN QUERY PLAN)"
            >
              <SearchCheck className="w-3.5 h-3.5 text-accent-amber" />
              <span>Explain Plan</span>
            </button>
          )}

          <button
            onClick={() => onChangeSql("")}
            className="flex items-center gap-1 text-[11px] text-on-dark-soft hover:text-on-dark px-2.5 py-1.5 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </button>

          <button
            onClick={onExecute}
            disabled={loading || !sql.trim()}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors shadow-2xs"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Running..." : "Run (⌘↵)"}</span>
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
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
            lineNumbers: "on",
            roundedSelection: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            lineDecorationsWidth: 4,
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: "all",
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
          }}
        />
      </div>
    </div>
  );
};
