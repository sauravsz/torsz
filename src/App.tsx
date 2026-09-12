import { useState, useEffect, useCallback } from "react";
import { TopNav } from "./components/TopNav";
import { Sidebar } from "./components/Sidebar";
import { SqlEditor } from "./components/SqlEditor";
import { ResultsTable, PendingCellUpdate } from "./components/ResultsTable";
import { ErDiagram } from "./components/ErDiagram";
import { AiAssistant } from "./components/AiAssistant";
import { OrSuiteView } from "./components/OrSuiteView";
import { HistoryModal } from "./components/HistoryModal";
import { ConnectionModal } from "./components/ConnectionModal";
import { ToastProvider, useToast } from "./components/Toast";
import { ConnectionConfig, DatabaseSchema, QueryResult, TableSchema, ColumnSchema } from "./types";
import {
  connectDatabase,
  executeQuery,
  getDatabaseSchema,
  testConnection,
  createSampleDatabase,
  setDatabaseName,
  cleanWorkspaceForImport,
  exportDatabaseBinary,
} from "./services/db";
import { importSpreadsheetToDb } from "./services/spreadsheet";
import { convertTextToSql } from "./services/aiAssistant";
import { addHistoryItem } from "./services/history";

const LOCAL_STORAGE_SAVED_CONNS = "torsz_saved_connections";

function MainWorkspace() {
  const { showToast } = useToast();
  const [activeConnection, setActiveConnection] = useState<ConnectionConfig | null>(null);
  const [savedConnections, setSavedConnections] = useState<ConnectionConfig[]>([]);
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [sql, setSql] = useState<string>(
    "-- Welcome to torsz SQL IDE\n-- Run any SQL query with ⌘ + Enter\nSELECT \n  p.id, \n  p.name AS product_name,\n  c.name AS category,\n  p.price,\n  p.stock\nFROM products p\nJOIN categories c ON p.category_id = c.id\nORDER BY p.price DESC;\n"
  );
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [activeView, setActiveView] = useState<"editor" | "diagram" | "ai" | "or">("editor");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Keyboard shortcut ⌘+B / Ctrl+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load saved connections from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_SAVED_CONNS);
      if (stored) {
        setSavedConnections(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load saved connections:", e);
    }
  }, []);

  const refreshSchema = useCallback(async (connId: string) => {
    setLoadingSchema(true);
    try {
      const dbSchema = await getDatabaseSchema(connId);
      setSchema(dbSchema);
    } catch (err) {
      console.error("Failed to fetch database schema:", err);
    } finally {
      setLoadingSchema(false);
    }
  }, []);

  const handleConnect = async (config: ConnectionConfig) => {
    try {
      await connectDatabase(config);
      setActiveConnection(config);

      // Save connection
      setSavedConnections((prev) => {
        const filtered = prev.filter((c) => c.id !== config.id);
        const next = [config, ...filtered];
        localStorage.setItem(LOCAL_STORAGE_SAVED_CONNS, JSON.stringify(next));
        return next;
      });

      await refreshSchema(config.id);
      showToast(`Connected to ${config.name}`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error", "Connection Failed");
      throw err;
    }
  };

  const handleTestConnection = async (config: ConnectionConfig): Promise<boolean> => {
    return await testConnection(config);
  };

  const handleLoadSampleDb = async () => {
    setLoadingSchema(true);
    try {
      const config = await createSampleDatabase();
      setActiveConnection(config);
      await refreshSchema(config.id);

      // Auto-run welcome query
      handleExecuteQuery(config.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error", "Sample Database Error");
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleImportSpreadsheet = async (file: File) => {
    setLoadingSchema(true);
    try {
      // Clean out initial sample store tables when user imports their own dataset
      if (!activeConnection || activeConnection.id === "sample-sqlite-web" || activeConnection.name.includes("Sample Store")) {
        cleanWorkspaceForImport();
      }

      setDatabaseName(file.name);
      const updatedConfig: ConnectionConfig = {
        id: `conn_${Date.now()}`,
        name: file.name,
        driver: "sqlite",
        database: file.name,
        filepath: file.name,
      };
      setActiveConnection(updatedConfig);

      const res = await importSpreadsheetToDb(updatedConfig.id, file);
      await refreshSchema(updatedConfig.id);
      const tableSql = `SELECT * FROM "${res.tableName}" LIMIT 100;\n`;
      setSql(tableSql);
      setActiveView("editor");
      await handleExecuteQuery(updatedConfig.id, tableSql);
      showToast(`Imported ${res.rowCount.toLocaleString()} rows into table "${res.tableName}"`, "success", "Spreadsheet Ingested");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error", "Import Error");
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleExportDatabase = async () => {
    try {
      const { bytes, filename } = await exportDatabaseBinary();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/x-sqlite3" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported active database as "${filename}"`, "success", "Database Downloaded");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error", "Export Error");
    }
  };

  // Load database on start
  useEffect(() => {
    handleLoadSampleDb();
  }, []);

  const handleExecuteQuery = async (overrideConnId?: string, overrideSql?: string) => {
    const connId = overrideConnId || activeConnection?.id;
    if (!connId) {
      showToast("Please connect to a database before executing queries.", "info");
      return;
    }

    const queryToRun = overrideSql || sql;
    if (!queryToRun.trim()) return;

    setLoadingQuery(true);
    try {
      const res = await executeQuery(connId, queryToRun.trim());
      setQueryResult(res);

      // Record to history
      addHistoryItem({
        sql: queryToRun.trim(),
        executionTimeMs: res.execution_time_ms,
        rowCount: res.rows ? res.rows.length : (res.affected_rows ?? null),
        status: res.error ? "error" : "success",
        errorMessage: res.error || undefined,
      });

      // Refresh schema in case of DDL modifications
      if (
        queryToRun.toUpperCase().includes("CREATE") ||
        queryToRun.toUpperCase().includes("DROP") ||
        queryToRun.toUpperCase().includes("ALTER")
      ) {
        refreshSchema(connId);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setQueryResult({
        columns: [],
        rows: [],
        execution_time_ms: 0,
        error: errMsg,
      });
      addHistoryItem({
        sql: queryToRun.trim(),
        executionTimeMs: 0,
        rowCount: null,
        status: "error",
        errorMessage: errMsg,
      });
    } finally {
      setLoadingQuery(false);
    }
  };

  const handleSelectTable = (tableName: string) => {
    const tableSql = `SELECT * FROM "${tableName}" LIMIT 100;\n`;
    setSql(tableSql);
    setActiveView("editor");
    handleExecuteQuery(undefined, tableSql);
  };

  const handleInlineAiConvert = async (aiPrompt: string) => {
    try {
      const gen = await convertTextToSql(aiPrompt, schema);
      setSql(gen.sql + "\n");
      await handleExecuteQuery(undefined, gen.sql);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error", "AI Generator Error");
    }
  };

  const handleApplyAiSql = async (newSql: string, autoRun = true) => {
    setSql(newSql + "\n");
    setActiveView("editor");
    if (autoRun) {
      await handleExecuteQuery(undefined, newSql);
    }
  };

  const handleSaveCellUpdates = async (updates: PendingCellUpdate[]) => {
    if (!activeConnection || updates.length === 0) return;

    const fromMatch = sql.match(/FROM\s+["`']?([a-zA-Z0-9_]+)["`']?/i);
    const targetTable = fromMatch ? fromMatch[1] : schema?.tables[0]?.name;

    if (!targetTable) {
      showToast("Unable to detect target table from query. Please ensure query has 'FROM tableName'.", "info");
      return;
    }

    const tableSchema = schema?.tables.find((t: TableSchema) => t.name.toLowerCase() === targetTable.toLowerCase());
    const pkCol = tableSchema?.columns.find((c: ColumnSchema) => c.is_primary_key)?.name || "id";
    const pkColIdx = queryResult?.columns.findIndex((c) => c.name.toLowerCase() === pkCol.toLowerCase()) ?? -1;

    try {
      for (const update of updates) {
        const pkVal = pkColIdx !== -1 ? update.row[pkColIdx] : update.row[0];
        const isNum = !isNaN(Number(update.newVal)) && update.newVal.trim() !== "";
        const formattedVal = isNum ? update.newVal : `'${update.newVal.replace(/'/g, "''")}'`;
        const formattedPk = typeof pkVal === "number" ? pkVal : `'${String(pkVal).replace(/'/g, "''")}'`;

        const updateSql = `UPDATE "${targetTable}" SET "${update.colName}" = ${formattedVal} WHERE "${pkCol}" = ${formattedPk};`;
        await executeQuery(activeConnection.id, updateSql);
      }

      await handleExecuteQuery();
      showToast(`Committed ${updates.length} edit${updates.length > 1 ? "s" : ""} to "${targetTable}"`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error", "Update Error");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas text-ink font-sans">
      {/* Top Nav Header */}
      <TopNav
        activeConnection={activeConnection}
        savedConnections={savedConnections}
        onSelectConnection={handleConnect}
        onOpenNewConnection={() => setIsModalOpen(true)}
        onLoadSampleDb={handleLoadSampleDb}
        onRefreshSchema={() => activeConnection && refreshSchema(activeConnection.id)}
        activeView={activeView}
        onSelectView={setActiveView}
        onImportSpreadsheet={handleImportSpreadsheet}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onExportDatabase={handleExportDatabase}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        loading={loadingSchema}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left Schema Sidebar */}
        {isSidebarOpen && (
          <Sidebar
            schema={schema}
            onSelectTable={handleSelectTable}
            onToggle={() => setIsSidebarOpen(false)}
            loading={loadingSchema}
          />
        )}

        {/* Center Canvas Area */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-surface-soft/40">
          {activeView === "editor" ? (
            <div className="flex flex-col h-full overflow-hidden p-3 gap-3">
              {/* Top Half: Code Editor */}
              <div className="h-[44%] min-h-[200px] shrink-0">
                <SqlEditor
                  sql={sql}
                  onChangeSql={setSql}
                  onExecute={() => handleExecuteQuery()}
                  onGenerateFromPrompt={handleInlineAiConvert}
                  schema={schema}
                  loading={loadingQuery}
                />
              </div>

              {/* Bottom Half: Result Data Grid */}
              <div className="flex-1 overflow-hidden">
                <ResultsTable
                  result={queryResult}
                  loading={loadingQuery}
                  onSaveCellUpdates={handleSaveCellUpdates}
                />
              </div>
            </div>
          ) : activeView === "diagram" ? (
            <ErDiagram schema={schema} onSelectTable={handleSelectTable} />
          ) : activeView === "ai" ? (
            <AiAssistant
              schema={schema}
              onApplySql={handleApplyAiSql}
              onNavigateToOr={() => setActiveView("or")}
            />
          ) : (
            <OrSuiteView onOpenInSql={(querySql) => {
              setSql(querySql + "\n");
              setActiveView("editor");
              handleExecuteQuery(undefined, querySql);
            }} />
          )}
        </main>
      </div>

      {/* New Connection Modal */}
      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleConnect}
        onTestConnection={handleTestConnection}
      />

      {/* Query History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectQuery={(hSql, autoRun) => {
          setSql(hSql + "\n");
          setActiveView("editor");
          if (autoRun) {
            handleExecuteQuery(undefined, hSql);
          }
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <MainWorkspace />
    </ToastProvider>
  );
}

export default App;
