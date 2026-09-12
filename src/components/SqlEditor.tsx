import React, { useRef, useState, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { Play, RotateCcw, Sparkles, Plus, X, Terminal } from "lucide-react";
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
  onGenerateFromPrompt?: (prompt: string) => Promise<void>;
  schema?: DatabaseSchema | null;
  loading: boolean;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  sql,
  onChangeSql,
  onExecute,
  onGenerateFromPrompt,
  schema,
  loading,
}) => {
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
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
    if (tabs.length === 1) return; // Keep at least one tab
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

  // Register Dynamic Monaco Schema Autocomplete (IntelliSense)
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

        // 1. Table Suggestions from Active Schema
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
                label: `${col.name} (${table.name})`,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: `"${col.name}"`,
                detail: `${col.data_type} • ${table.name}`,
                range,
              });
            }
          }
        }

        // 3. SQL Keywords
        const keywords = [
          "SELECT", "FROM", "WHERE", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "ON",
          "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "DISTINCT", "AS",
          "INSERT INTO", "VALUES", "UPDATE", "SET", "DELETE FROM", "CREATE TABLE", "DROP TABLE",
          "WITH RECURSIVE", "UNION ALL", "UNION", "AND", "OR", "NOT", "IN", "IS NULL", "IS NOT NULL",
          "LIKE", "BETWEEN", "CASE", "WHEN", "THEN", "ELSE", "END", "CAST", "ROUND", "COUNT", "SUM", "AVG", "MIN", "MAX"
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

    // Register Claude Warm-Dark Navy Theme for Monaco
    monaco.editor.defineTheme("claude-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "cc785c", fontStyle: "bold" },
        { token: "type", foreground: "5db8a6" },
        { token: "number", foreground: "5db8a6" },
        { token: "string", foreground: "e8a55a" },
        { token: "comment", foreground: "8e8b82", fontStyle: "italic" },
        { token: "operator", foreground: "e6dfd8" },
        { token: "identifier", foreground: "faf9f5" },
      ],
      colors: {
        "editor.background": "#181715",
        "editor.foreground": "#faf9f5",
        "editorLineNumber.foreground": "#6c6a64",
        "editorLineNumber.activeForeground": "#cc785c",
        "editorGutter.background": "#1f1e1b",
        "editorCursor.foreground": "#cc785c",
        "editor.selectionBackground": "#3a2820",
        "editor.inactiveSelectionBackground": "#252320",
        "editor.lineHighlightBackground": "#252320",
      },
    });

    monaco.editor.setTheme("claude-dark");

    // Add ⌘+Enter / Ctrl+Enter execution shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onExecute();
    });
  };

  return (
    <div className="flex flex-col h-full bg-surface-dark border border-surface-dark-elevated rounded-2xl overflow-hidden shadow-sm">
      {/* Worksheets Sub-Tabs Bar */}
      <div className="h-9 bg-[#141312] border-b border-surface-dark-elevated px-2 flex items-center justify-between select-none overflow-x-auto">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isEditing = editingTabId === tab.id;

            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                onDoubleClick={() => startRenameTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-t-lg transition-colors cursor-pointer border-t-2 ${
                  isActive
                    ? "bg-surface-dark-soft text-on-dark border-primary font-semibold shadow-xs"
                    : "bg-transparent text-on-dark-soft border-transparent hover:bg-surface-dark hover:text-on-dark"
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
                    className="bg-surface-dark border border-primary text-xs text-on-dark px-1 py-0.2 rounded outline-none w-24"
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
              placeholder="Ask in plain English (e.g. 'top 10 movies by year', 'count orders per customer')..."
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

        {/* Right Execution Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangeSql("")}
            className="flex items-center gap-1 text-[11px] text-on-dark-soft hover:text-on-dark px-2.5 py-1.5 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear
          </button>

          <button
            onClick={onExecute}
            disabled={loading}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-active disabled:bg-primary-disabled text-on-primary text-xs font-semibold px-4 py-1.5 rounded-xl transition-colors shadow-2xs"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Running..." : "Run Query"}
          </button>
        </div>
      </div>

      {/* Code Window */}
      <div className="flex-1 w-full min-h-[160px]">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={sql}
          onChange={(val) => onChangeSql(val || "")}
          onMount={handleEditorDidMount}
          theme="claude-dark"
          options={{
            fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', monospace",
            fontSize: 15.5,
            lineHeight: 24,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            tabSize: 2,
            suggestOnTriggerCharacters: true,
            lineNumbersMinChars: 3,
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
