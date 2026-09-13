import React, { useState, useEffect, useRef, useMemo } from "react";
import { Download, AlertCircle, CheckCircle2, Search, Save, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { QueryResult } from "../types";

export interface PendingCellUpdate {
  rowIdx: number;
  colIdx: number;
  colName: string;
  originalVal: unknown;
  newVal: string;
  row: unknown[];
}

interface ResultsTableProps {
  result: QueryResult | null;
  loading: boolean;
  onSaveCellUpdates?: (updates: PendingCellUpdate[]) => Promise<void>;
}

interface SortCriterion {
  colIdx: number;
  dir: "asc" | "desc";
}

const ROW_HEIGHT = 38; // Increased from 32px for larger font readability
const BUFFER_ROWS = 10;
const DEFAULT_COLUMN_WIDTH = 180;
const MIN_COLUMN_WIDTH = 80;

export const ResultsTable: React.FC<ResultsTableProps> = ({
  result,
  loading,
  onSaveCellUpdates,
}) => {
  const [filterText, setFilterText] = useState("");
  const [sortCriteria, setSortCriteria] = useState<SortCriterion[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [pendingUpdates, setPendingUpdates] = useState<PendingCellUpdate[]>([]);
  const [saving, setSaving] = useState(false);

  // Virtualization state
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const handleScroll = () => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  };

  // Reset staging and sorting when result changes
  useEffect(() => {
    setPendingUpdates([]);
    setEditingCell(null);
    setFilterText("");
    setSortCriteria([]);
  }, [result]);

  // Sorting Handler
  const toggleSort = (colIdx: number, e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    setSortCriteria((prev) => {
      const existing = prev.find((s) => s.colIdx === colIdx);
      if (!isShift) {
        if (!existing) return [{ colIdx, dir: "asc" }];
        if (existing.dir === "asc") return [{ colIdx, dir: "desc" }];
        return [];
      } else {
        if (!existing) return [...prev, { colIdx, dir: "asc" }];
        if (existing.dir === "asc") {
          return prev.map((s) => (s.colIdx === colIdx ? { ...s, dir: "desc" } : s));
        }
        return prev.filter((s) => s.colIdx !== colIdx);
      }
    });
  };

  // Column Resizing Handler
  const handleMouseDownResize = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colIdx] || DEFAULT_COLUMN_WIDTH;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(
        MIN_COLUMN_WIDTH,
        startWidth + (moveEvent.clientX - startX)
      );
      setColumnWidths((prev) => ({
        ...prev,
        [colIdx]: newWidth,
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Filter & Sort Rows
  const processedRows = useMemo(() => {
    if (!result || !result.rows) return [];
    let rowsWithIndex = result.rows.map((row, originalIdx) => ({ row, originalIdx }));

    // Text Filter
    if (filterText.trim()) {
      const term = filterText.toLowerCase();
      rowsWithIndex = rowsWithIndex.filter(({ row }) =>
        row.some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        )
      );
    }

    // Multi-column Sort
    if (sortCriteria.length > 0) {
      rowsWithIndex.sort((a, b) => {
        for (const crit of sortCriteria) {
          const valA = a.row[crit.colIdx];
          const valB = b.row[crit.colIdx];

          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;

          let comp = 0;
          if (typeof valA === "number" && typeof valB === "number") {
            comp = valA - valB;
          } else {
            comp = String(valA).localeCompare(String(valB), undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }

          return crit.dir === "asc" ? comp : -comp;
        }
        return 0;
      });
    }

    return rowsWithIndex;
  }, [result, filterText, sortCriteria]);

  if (loading) {
    return (
      <div className="flex-1 bg-canvas border border-hairline rounded-2xl flex flex-col items-center justify-center p-8 select-none shadow-2xs">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-ink font-semibold">Executing SQL query...</p>
        <p className="text-xs text-muted-soft mt-1">Processing in WebAssembly SQLite engine</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 bg-canvas border border-hairline rounded-2xl flex flex-col items-center justify-center p-8 select-none shadow-2xs">
        <div className="w-10 h-10 bg-surface-card rounded-2xl flex items-center justify-center text-muted mb-3 border border-hairline">
          <Search className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm font-semibold text-ink">Ready to Query</p>
        <p className="text-xs text-muted-soft mt-1 max-w-sm text-center">
          Execute a query with <kbd className="font-mono bg-surface-card px-1.5 py-0.5 rounded border border-hairline text-ink">⌘ + Enter</kbd> to inspect and edit records.
        </p>
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex-1 bg-canvas border border-hairline rounded-2xl p-6 overflow-y-auto shadow-2xs">
        <div className="bg-[#fdf2f2] border border-[#f5c6c6] text-error p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider mb-1">
              Query Execution Error
            </h4>
            <pre className="font-mono text-xs whitespace-pre-wrap text-[#991b1b] leading-relaxed">
              {result.error}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  const exportCsv = () => {
    if (!result || result.columns.length === 0) return;
    const header = result.columns.map((c) => `"${c.name}"`).join(",");
    const rows = result.rows
      .map((row, rowIdx) =>
        row
          .map((val, colIdx) => {
            const pending = pendingUpdates.find(
              (u) => u.rowIdx === rowIdx && u.colIdx === colIdx
            );
            const effectiveVal = pending ? pending.newVal : val;
            if (effectiveVal === null || effectiveVal === undefined) return '""';
            return `"${String(effectiveVal).replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEditing = (rowIdx: number, colIdx: number, val: unknown) => {
    const pending = pendingUpdates.find(
      (u) => u.rowIdx === rowIdx && u.colIdx === colIdx
    );
    const initial = pending ? pending.newVal : val === null ? "" : String(val);
    setEditingCell({ rowIdx, colIdx });
    setEditValue(initial);
  };

  const commitEdit = (rowIdx: number, colIdx: number, originalVal: unknown, row: unknown[]) => {
    const colName = result.columns[colIdx]?.name || `col_${colIdx}`;
    const origStr = originalVal === null ? "" : String(originalVal);

    if (editValue !== origStr) {
      setPendingUpdates((prev) => {
        const filtered = prev.filter(
          (u) => !(u.rowIdx === rowIdx && u.colIdx === colIdx)
        );
        return [
          ...filtered,
          {
            rowIdx,
            colIdx,
            colName,
            originalVal,
            newVal: editValue,
            row,
          },
        ];
      });
    } else {
      setPendingUpdates((prev) =>
        prev.filter((u) => !(u.rowIdx === rowIdx && u.colIdx === colIdx))
      );
    }
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const handleSaveAll = async () => {
    if (!onSaveCellUpdates || pendingUpdates.length === 0) return;
    setSaving(true);
    try {
      await onSaveCellUpdates(pendingUpdates);
      setPendingUpdates([]);
    } catch (err) {
      console.error("Failed to save cell updates:", err);
    } finally {
      setSaving(false);
    }
  };

  // Virtualization calculations
  const totalRows = processedRows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIndex = Math.min(
    totalRows,
    Math.floor((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_ROWS
  );
  const visibleRows = processedRows.slice(startIndex, endIndex);
  const topPadding = startIndex * ROW_HEIGHT;

  return (
    <div className="flex-1 bg-canvas border border-hairline rounded-2xl flex flex-col h-full overflow-hidden select-text shadow-2xs">
      {/* Compact Table Metadata Bar */}
      <div className="h-9 bg-surface-soft/60 border-b border-hairline px-3 flex items-center justify-between text-xs text-muted select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-ink font-semibold text-xs">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>{processedRows.length} rows</span>
          </div>

          <span className="text-hairline">•</span>
          <span className="text-xs text-muted-soft">{result.execution_time_ms} ms</span>
        </div>
        <div className="flex items-center gap-2">
          {pendingUpdates.length > 0 && (
            <div className="flex items-center gap-2 bg-surface-cream px-3 py-1 rounded-xl border border-hairline">
              <span className="text-xs font-semibold text-primary">
                {pendingUpdates.length} staged change{pendingUpdates.length > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => setPendingUpdates([])}
                className="text-xs text-muted hover:text-ink flex items-center gap-1 transition-colors px-1"
                title="Discard staged changes"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-3 py-1 rounded-lg transition-colors shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {result.columns.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Quick Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
                <input
                  type="text"
                  placeholder="Filter table..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-canvas border border-hairline rounded-xl pl-8 pr-3 py-1 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none"
                />
              </div>

              {/* Export CSV */}
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-1.5 bg-canvas hover:bg-surface-cream text-ink text-xs font-semibold px-3 py-1 rounded-xl border border-hairline transition-colors shadow-2xs"
                title="Export Results to CSV"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Virtualized Grid Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto relative"
      >
        {result.columns.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            <p>Query executed successfully with no returned rows.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse font-sans">
            <thead className="sticky top-0 bg-surface-card border-b border-hairline z-10 select-none shadow-xs">
              <tr>
                <th className="px-3.5 py-2.5 text-xs font-semibold text-muted-soft border-r border-hairline w-14 text-center">
                  #
                </th>
                {result.columns.map((col, colIdx) => {
                  const width = columnWidths[colIdx];
                  const sortItem = sortCriteria.find((s) => s.colIdx === colIdx);
                  const sortRank = sortCriteria.findIndex((s) => s.colIdx === colIdx) + 1;

                  return (
                    <th
                      key={col.name}
                      style={width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : undefined}
                      className="px-4 py-2.5 text-[13px] font-semibold text-ink border-r border-hairline whitespace-nowrap relative group cursor-pointer hover:bg-surface-cream transition-colors"
                      onClick={(e) => toggleSort(colIdx, e)}
                      title="Click to sort (Shift+Click for multi-column sort)"
                    >
                      <div className="flex items-center justify-between gap-3 pr-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <span>{col.name}</span>
                          {sortItem ? (
                            <span className="flex items-center text-primary font-bold text-xs gap-0.5">
                              {sortItem.dir === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5" />
                              )}
                              {sortCriteria.length > 1 && (
                                <span className="text-[10px] bg-primary/20 rounded-full px-1.5 py-0.2">
                                  {sortRank}
                                </span>
                              )}
                            </span>
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-muted-soft opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>

                        <span className="text-[10px] font-mono font-normal text-muted-soft uppercase bg-canvas px-1.5 py-0.5 rounded border border-hairline shrink-0">
                          {col.data_type}
                        </span>
                      </div>

                      {/* Column Resize Handle */}
                      <div
                        onMouseDown={(e) => handleMouseDownResize(e, colIdx)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-primary cursor-col-resize z-20 transition-colors"
                        title="Drag to resize column"
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {topPadding > 0 && (
                <tr>
                  <td colSpan={result.columns.length + 1} style={{ height: `${topPadding}px` }} />
                </tr>
              )}

              {visibleRows.map(({ row, originalIdx }, relativeIdx) => {
                const globalRowIdx = originalIdx;
                const isOdd = (startIndex + relativeIdx) % 2 === 1;

                return (
                  <tr
                    key={globalRowIdx}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={`border-b border-hairline-soft transition-colors hover:bg-surface-cream ${
                      isOdd ? "bg-surface-soft" : "bg-canvas"
                    }`}
                  >
                    <td className="px-3.5 py-2 font-mono text-xs text-muted-soft border-r border-hairline text-center select-none">
                      {globalRowIdx + 1}
                    </td>
                    {row.map((cell, colIdx) => {
                      const width = columnWidths[colIdx];
                      const isEditing =
                        editingCell?.rowIdx === globalRowIdx && editingCell?.colIdx === colIdx;
                      const pending = pendingUpdates.find(
                        (u) => u.rowIdx === globalRowIdx && u.colIdx === colIdx
                      );
                      const displayVal = pending ? pending.newVal : cell;
                      const isNumber = typeof displayVal === "number" || (!isNaN(Number(displayVal)) && displayVal !== "" && displayVal !== null && typeof displayVal !== "boolean");

                      return (
                        <td
                          key={colIdx}
                          style={width ? { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` } : undefined}
                          onDoubleClick={() => startEditing(globalRowIdx, colIdx, cell)}
                          className={`px-4 py-2 text-[14px] border-r border-hairline whitespace-nowrap font-mono transition-colors relative cursor-pointer truncate ${
                            isNumber ? "text-right" : "text-left"
                          } ${
                            pending ? "bg-[#fff7ed] text-primary font-semibold" : "text-body"
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1 min-w-[140px]">
                              <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    commitEdit(globalRowIdx, colIdx, cell, row);
                                  } else if (e.key === "Escape") {
                                    cancelEdit();
                                  }
                                }}
                                onBlur={() => commitEdit(globalRowIdx, colIdx, cell, row)}
                                className="w-full bg-canvas border-2 border-primary rounded px-2 py-1 text-xs text-ink font-mono focus:outline-none shadow-xs"
                              />
                            </div>
                          ) : (
                            <span className="truncate">
                              {displayVal === null || displayVal === undefined ? (
                                <span className="text-muted-soft/60 italic text-xs">NULL</span>
                              ) : (
                                String(displayVal)
                              )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
