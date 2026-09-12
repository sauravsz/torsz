import React, { useState } from "react";
import { Table, Eye, ChevronRight, ChevronDown, Key, Search, Database, Layers, PanelLeftClose } from "lucide-react";
import { DatabaseSchema } from "../types";

interface SidebarProps {
  schema: DatabaseSchema | null;
  onSelectTable: (tableName: string) => void;
  onToggle?: () => void;
  loading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ schema, onSelectTable, onToggle, loading }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };
  const tables = schema?.tables.filter((t) => t.table_type === "table") || [];
  const views = schema?.tables.filter((t) => t.table_type === "view") || [];

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredViews = views.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-64 bg-surface-card border-r border-hairline flex flex-col h-[calc(100vh-3.5rem)] select-none text-body">
      {/* Header */}
      <div className="p-3 border-b border-hairline bg-surface-soft">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 truncate">
            <Database className="w-4 h-4 text-primary shrink-0" />
            <span className="font-editorial-serif text-lg font-medium text-ink truncate">
              {schema?.database_name || "Database Schema"}
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
        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
          <input
            type="text"
            placeholder="Search schema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-canvas border border-hairline rounded-md pl-8 pr-3 py-1 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none"
          />
        </div>
      </div>

      {/* Schema Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted">
            <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
            <p>Introspecting schema...</p>
          </div>
        ) : !schema ? (
          <div className="p-6 text-center text-xs text-muted">
            <Layers className="w-8 h-8 text-muted-soft mx-auto mb-2 opacity-60" />
            <p className="font-medium text-ink mb-1">No Active Connection</p>
            <p className="text-[11px] text-muted-soft">
              Connect to a database or load the sample SQLite store.
            </p>
          </div>
        ) : (
          <>
            {/* Tables Group */}
            <div>
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <span>Tables ({filteredTables.length})</span>
              </div>
              <div className="space-y-0.5 mt-1">
                {filteredTables.map((table) => (
                  <div key={table.name} className="group">
                    <div
                      onClick={() => toggleTable(table.name)}
                      className="flex items-center justify-between px-2.5 py-2 rounded-md hover:bg-surface-cream text-sm text-ink cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {expandedTables[table.name] ? (
                          <ChevronDown className="w-4 h-4 text-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted" />
                        )}
                        <Table className="w-4 h-4 text-primary opacity-90" />
                        <span className="font-semibold truncate">{table.name}</span>
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
                      <div className="pl-6 pr-2 py-1 space-y-1 border-l-2 border-hairline ml-4 my-1">
                        {table.columns.map((col) => (
                          <div
                            key={col.name}
                            className="flex items-center justify-between text-xs text-body py-1"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {col.is_primary_key && (
                                <Key className="w-3.5 h-3.5 text-accent-amber shrink-0" />
                              )}
                              <span className="truncate">{col.name}</span>
                            </div>
                            <span className="text-[11px] font-mono text-muted-soft bg-canvas px-1.5 py-0.5 rounded border border-hairline shrink-0">
                              {col.data_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Views Group if any */}
            {filteredViews.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span>Views ({filteredViews.length})</span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {filteredViews.map((view) => (
                    <div
                      key={view.name}
                      onClick={() => onSelectTable(view.name)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-cream text-xs text-ink cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-accent-teal opacity-80" />
                      <span className="font-medium truncate">{view.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
