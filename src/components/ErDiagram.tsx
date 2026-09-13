import React, { useState } from "react";
import { DatabaseSchema } from "../types";
import { Key, Link2, ZoomIn, ZoomOut, RotateCcw, Layers, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface ErDiagramProps {
  schema: DatabaseSchema | null;
  onSelectTable: (tableName: string) => void;
}

export const ErDiagram: React.FC<ErDiagramProps> = ({ schema, onSelectTable }) => {
  const [zoom, setZoom] = useState(1);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);

  if (!schema || schema.tables.length === 0) {
    return (
      <div className="flex-1 bg-canvas flex flex-col items-center justify-center p-8 text-center text-muted select-none">
        <Layers className="w-12 h-12 text-muted-soft mx-auto mb-3 opacity-50" />
        <p className="font-editorial-serif text-xl text-ink mb-1">No Schema Loaded</p>
        <p className="text-xs text-muted-soft">
          Connect to a database or create tables to visualize the Entity-Relationship graph.
        </p>
      </div>
    );
  }

  // Compute incoming and outgoing relationships
  const relationsMap: Record<
    string,
    { outgoing: { col: string; toTable: string; toCol: string }[]; incoming: { fromTable: string; fromCol: string; toCol: string }[] }
  > = {};

  for (const table of schema.tables) {
    if (!relationsMap[table.name]) {
      relationsMap[table.name] = { outgoing: [], incoming: [] };
    }
    for (const fk of table.foreign_keys) {
      relationsMap[table.name].outgoing.push({
        col: fk.from_column,
        toTable: fk.to_table,
        toCol: fk.to_column,
      });

      if (!relationsMap[fk.to_table]) {
        relationsMap[fk.to_table] = { outgoing: [], incoming: [] };
      }
      relationsMap[fk.to_table].incoming.push({
        fromTable: table.name,
        fromCol: fk.from_column,
        toCol: fk.to_column,
      });
    }
  }

  const totalRelations = schema.tables.reduce((acc, t) => acc + t.foreign_keys.length, 0);

  return (
    <div className="flex-1 bg-canvas flex flex-col h-full overflow-hidden relative select-none">
      {/* Visualizer Header Bar */}
      <div className="absolute top-4 left-6 z-20 flex items-center gap-3 bg-surface-card border border-hairline px-3.5 py-1.5 rounded-lg shadow-sm">
        <div className="flex items-center gap-1.5 text-xs text-ink font-semibold">
          <Layers className="w-4 h-4 text-primary" />
          <span>{schema.tables.length} Tables</span>
        </div>
        <span className="text-muted-soft">•</span>
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
          <Link2 className="w-3.5 h-3.5" />
          <span>{totalRelations} Foreign Key Relationships</span>
        </div>
      </div>

      {/* Visualizer Zoom Controls */}
      <div className="absolute top-4 right-6 z-20 flex items-center gap-1 bg-surface-card border border-hairline p-1 rounded-lg shadow-sm">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.15, 1.5))}
          title="Zoom In"
          className="p-1.5 text-muted hover:text-ink hover:bg-surface-cream rounded transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.6))}
          title="Zoom Out"
          className="p-1.5 text-muted hover:text-ink hover:bg-surface-cream rounded transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          title="Reset Zoom"
          className="p-1.5 text-muted hover:text-ink hover:bg-surface-cream rounded transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Entity Cards Canvas */}
      <div className="flex-1 overflow-auto p-12 pt-20">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 transition-transform duration-200"
        >
          {schema.tables.map((table) => {
            const rels = relationsMap[table.name] || { outgoing: [], incoming: [] };
            const isHovered = hoveredTable === table.name;
            const isRelated =
              hoveredTable !== null &&
              (rels.outgoing.some((r) => r.toTable === hoveredTable) ||
                rels.incoming.some((r) => r.fromTable === hoveredTable));

            return (
              <div
                key={table.name}
                onMouseEnter={() => setHoveredTable(table.name)}
                onMouseLeave={() => setHoveredTable(null)}
                className={`bg-surface-card border rounded-2xl shadow-sm transition-all duration-200 overflow-hidden flex flex-col ${
                  isHovered
                    ? "border-primary ring-4 ring-primary/25 shadow-xl scale-[1.03] z-20 opacity-100"
                    : isRelated
                    ? "border-accent-teal ring-2 ring-accent-teal/40 shadow-md scale-[1.01] z-10 opacity-100"
                    : hoveredTable !== null
                    ? "border-hairline opacity-30 blur-[0.2px] scale-[0.98]"
                    : "border-hairline hover:border-primary/60"
                }`}
              >
                {/* Card Header */}
                <div
                  className={`px-4 py-3 border-b flex items-center justify-between transition-colors ${
                    isHovered
                      ? "bg-primary text-on-primary border-primary"
                      : isRelated
                      ? "bg-accent-teal/15 text-ink border-accent-teal/40"
                      : "bg-surface-cream text-ink border-hairline"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-editorial-serif text-lg font-semibold truncate">
                      {table.name}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                      isHovered
                        ? "bg-primary-active border-primary-active text-white"
                        : "bg-canvas text-muted border-hairline"
                    }`}
                  >
                    {table.table_type}
                  </span>
                </div>

                {/* Columns List */}
                <div className="p-3 space-y-1.5 divide-y divide-hairline-soft bg-canvas flex-1">
                  {table.columns.map((col) => {
                    const isFk = rels.outgoing.some((r) => r.col === col.name);
                    return (
                      <div
                        key={col.name}
                        className="flex items-center justify-between text-xs py-1 px-1.5 hover:bg-surface-soft rounded transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {col.is_primary_key && (
                            <span title="Primary Key"><Key className="w-3.5 h-3.5 text-accent-amber shrink-0" /></span>
                          )}
                          {isFk && (
                            <span title="Foreign Key"><Link2 className="w-3.5 h-3.5 text-primary shrink-0" /></span>
                          )}
                          <span
                            className={`truncate ${
                              col.is_primary_key ? "font-semibold text-ink" : "text-body"
                            }`}
                          >
                            {col.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-mono text-muted-soft bg-surface-soft px-1.5 py-0.2 rounded border border-hairline">
                            {col.data_type}
                          </span>
                          {col.is_nullable && (
                            <span className="text-[10px] text-muted-soft italic">null</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Relationship Links Section */}
                {(rels.outgoing.length > 0 || rels.incoming.length > 0) && (
                  <div className="bg-surface-soft px-3.5 py-2.5 border-t border-hairline text-xs space-y-1.5">
                    {/* Outgoing References */}
                    {rels.outgoing.map((fk, idx) => (
                      <div
                        key={`out-${idx}`}
                        className="flex items-center gap-1.5 text-primary font-medium truncate"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {fk.col} → <span className="font-bold underline">{fk.toTable}</span>({fk.toCol})
                        </span>
                      </div>
                    ))}

                    {/* Incoming References */}
                    {rels.incoming.map((fk, idx) => (
                      <div
                        key={`in-${idx}`}
                        className="flex items-center gap-1.5 text-accent-teal font-medium truncate"
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          from <span className="font-bold underline">{fk.fromTable}</span>({fk.fromCol})
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Footer */}
                <div className="p-2.5 bg-surface-card border-t border-hairline flex items-center justify-between">
                  <span className="text-[11px] text-muted">
                    {table.columns.length} columns
                  </span>
                  <button
                    onClick={() => onSelectTable(table.name)}
                    className="text-xs font-semibold text-primary hover:text-primary-active transition-colors flex items-center gap-1"
                  >
                    <span>Query Table</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
