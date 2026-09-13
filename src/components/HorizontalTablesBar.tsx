import React from "react";
import { Table, Eye } from "lucide-react";
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
      <div className="h-8 bg-surface-soft/60 border-b border-hairline px-3 flex items-center gap-2 text-[11px] text-muted select-none shrink-0">
        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading schema...</span>
      </div>
    );
  }

  const tables = schema?.tables.filter((t) => t.table_type === "table") || [];
  const views = schema?.tables.filter((t) => t.table_type === "view") || [];

  return (
    <div className="h-8 bg-surface-soft/60 border-b border-hairline px-2.5 flex items-center gap-1 overflow-x-auto select-none shrink-0 no-scrollbar">
      {tables.length === 0 ? (
        <span className="text-[11px] text-muted-soft italic px-1.5">No tables</span>
      ) : (
        tables.map((table) => {
          const isSelected = selectedTable === table.name;
          return (
            <button
              key={table.name}
              onClick={() => onSelectTable(table.name)}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                isSelected
                  ? "bg-canvas text-ink border border-hairline shadow-2xs font-semibold"
                  : "text-muted hover:text-ink hover:bg-surface-card"
              }`}
              title={`View ${table.name} (${table.columns.length} cols)`}
            >
              <Table className={`w-3 h-3 ${isSelected ? "text-primary" : "text-muted"}`} />
              <span>{table.name}</span>
            </button>
          );
        })
      )}

      {views.length > 0 && (
        <>
          <div className="w-px h-3.5 bg-hairline mx-1 shrink-0" />
          {views.map((view) => (
            <button
              key={view.name}
              onClick={() => onSelectTable(view.name)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-muted hover:text-ink hover:bg-surface-card transition-colors shrink-0"
              title={`View ${view.name}`}
            >
              <Eye className="w-3 h-3 text-accent-teal" />
              <span>{view.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
};
