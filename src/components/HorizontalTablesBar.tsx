import React from "react";
import { Table, Database, Eye } from "lucide-react";
import { DatabaseSchema } from "../types";

interface HorizontalTablesBarProps {
  schema: DatabaseSchema | null;
  selectedTable?: string | null;
  onSelectTable: (tableName: string) => void;
  loading: boolean;
}

export const HorizontalTablesBar: React.FC<HorizontalTablesBarProps> = ({
  schema,
  selectedTable,
  onSelectTable,
  loading,
}) => {
  if (loading) {
    return (
      <div className="h-10 bg-surface-soft border-b border-hairline px-3 flex items-center gap-2 text-xs text-muted select-none shrink-0">
        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading schema tables...</span>
      </div>
    );
  }

  const tables = schema?.tables.filter((t) => t.table_type === "table") || [];
  const views = schema?.tables.filter((t) => t.table_type === "view") || [];

  return (
    <div className="h-10 bg-surface-soft border-b border-hairline px-3 flex items-center gap-1.5 overflow-x-auto select-none shrink-0">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-muted uppercase tracking-wider pr-2 border-r border-hairline shrink-0">
        <Database className="w-3.5 h-3.5 text-primary" />
        <span>Tables ({tables.length}):</span>
      </div>

      {tables.length === 0 ? (
        <span className="text-xs text-muted-soft italic px-2">No database tables loaded</span>
      ) : (
        tables.map((table) => {
          const isSelected = selectedTable === table.name;
          return (
            <button
              key={table.name}
              onClick={() => onSelectTable(table.name)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 shrink-0 ${
                isSelected
                  ? "bg-canvas text-ink border border-hairline shadow-xs font-semibold"
                  : "text-body hover:text-ink hover:bg-surface-card"
              }`}
              title={`View records from ${table.name} (${table.columns.length} columns)`}
            >
              <Table className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted"}`} />
              <span>{table.name}</span>
              <span className="text-[10px] font-mono text-muted-soft bg-surface-card px-1 rounded">
                {table.columns.length}
              </span>
            </button>
          );
        })
      )}

      {views.length > 0 && (
        <>
          <div className="w-px h-4 bg-hairline mx-1 shrink-0" />
          {views.map((view) => (
            <button
              key={view.name}
              onClick={() => onSelectTable(view.name)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted hover:text-ink hover:bg-surface-card transition-colors shrink-0"
              title={`View ${view.name}`}
            >
              <Eye className="w-3.5 h-3.5 text-accent-teal" />
              <span>{view.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
};
