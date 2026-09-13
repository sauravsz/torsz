import React, { useState, useEffect, useRef, useMemo } from "react";
import { Download, AlertCircle, CheckCircle2, Clock, Hash, Search, Save, RotateCcw, Check, X, Edit2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

const ROW_HEIGHT = 38;
const BUFFER_ROWS = 10;

export const ResultsTable: React.FC<ResultsTableProps> = ({
  result,
  loading,
  onSaveCellUpdates,
}) => {
  const [filterText, setFilterText] = useState("");
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingUpdates, setPendingUpdates] = useState<PendingCellUpdate[]>([]);
  const [saving, setSaving] = useState(false);
  const [sortCriteria, setSortCriteria] = useState<{ colIdx: number; dir: "asc" | "desc" }[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizingColRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  // Clear pending updates when result changes
  useEffect(() => {
    setPendingUpdates([]);
    setEditingCell(null);
    setSortCriteria([]);
  }, [result]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Update container height
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Sort and Filter Rows
  const processedRows = useMemo(() => {
    if (!result || result.rows.length === 0) return [];

    let rowsWithIndex = result.rows.map((row, idx) => ({ row, originalIdx: idx }));

    // Filter
    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      rowsWithIndex = rowsWithIndex.filter(({ row, originalIdx }) => {
        return row.some((val, colIdx) => {
          const pending = pendingUpdates.find(
            (u) => u.rowIdx === originalIdx && u.colIdx === colIdx
          );
          const effective = pending ? pending.newVal : val;
          return String(effective).toLowerCase().includes(lower);
        });
      });
    }

    // Multi-Column Sorting
    if (sortCriteria.length > 0) {
      rowsWithIndex.sort((a, b) => {
        for (const criterion of sortCriteria) {
          const valA = a.row[criterion.colIdx];
          const valB = b.row[criterion.colIdx];
          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;
          if (typeof valA === "number" && typeof valB === "number") {
            return criterion.dir === "asc" ? valA - valB : valB - valA;
          }
          const strA = String(valA).toLowerCase();
          const strB = String(valB).toLowerCase();
          const cmp = strA.localeCompare(strB);
          if (cmp !== 0) {
            return criterion.dir === "asc" ? cmp : -cmp;
          }
        }
        return 0;
      });
    }

    return rowsWithIndex;
  }, [result, filterText, sortCriteria, pendingUpdates]);

  const toggleSort = (colIdx: number, e?: React.MouseEvent) => {
    const isShift = e?.shiftKey;
    setSortCriteria((prev) => {
      const existingIdx = prev.findIndex((s) => s.colIdx === colIdx);
      if (!isShift) {
        if (existingIdx !== -1) {
          return prev[existingIdx].dir === "asc"
            ? [{ colIdx, dir: "desc" }]
            : [];
        }
        return [{ colIdx, dir: "asc" }];
      }

      if (existingIdx !== -1) {
        if (prev[existingIdx].dir === "asc") {
          const next = [...prev];
          next[existingIdx] = { colIdx, dir: "desc" };
          return next;
        } else {
          return prev.filter((s) => s.colIdx !== colIdx);
        }
      }
      return [...prev, { colIdx, dir: "asc" }];
    });
  };

  // Column Resizing Handlers
  const handleMouseDownResize = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = columnWidths[colIdx] || 160;
    resizingColRef.current = { colIdx, startX: e.clientX, startW };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const diff = moveEvent.clientX - resizingColRef.current.startX;
      const newWidth = Math.max(80, resizingColRef.current.startW + diff);
      setColumnWidths((prev) => ({
        ...prev,
        [resizingColRef.current!.colIdx]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (loading) {
    return (
      <div className="flex-1 bg-canvas border border-hairline rounded-2xl flex flex-col items-center justify-center p-8 text-center text-muted select-none shadow-2xs">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-ink">Executing SQL query...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 bg-canvas border border-hairline rounded-2xl flex flex-col items-center justify-center p-8 text-center text-muted select-none shadow-2xs">
        <p className="font-editorial-serif text-xl text-ink mb-1">No Results Yet</p>
        <p className="text-xs text-muted-soft">
          Execute a query above to view the tabular results and metadata. Double-click any cell to edit.
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
  const bottomPadding = (totalRows - endIndex) * ROW_HEIGHT;

  return (
    <div className="flex-1 bg-canvas border border-hairline rounded-2xl flex flex-col h-full overflow-hidden select-text shadow-2xs">
      {/* Table Metadata Bar */}
      <div className="h-10 bg-surface-soft border-b border-hairline px-4 flex items-center justify-between text-xs text-muted select-none shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-ink font-medium">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span>Success</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-muted" />
            <span>{result.execution_time_ms} ms</span>
          </div>

          <div className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5 text-muted" />
            <span>
              {result.affected_rows !== null && result.affected_rows !== undefined
                ? `${result.affected_rows} rows affected`
                : `${processedRows.length} rows`}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-soft bg-canvas px-2.5 py-0.5 rounded-full border border-hairline">
            <Edit2 className="w-3 h-3 text-primary" />
            <span>Double-click cell to edit • Click header to sort</span>
          </div>
        </div>

        {/* Staged Changes Actions or Quick Search */}
        <div className="flex items-center gap-2">
          {pendingUpdates.length > 0 && (
            <div className="flex items-center gap-2 bg-surface-cream px-3 py-1 rounded-xl border border-hairline">
              <span className="text-xs font-semibold text-primary">
                {pendingUpdates.length} staged change{pendingUpdates.length > 1 ? "s" : ""}
              </span>
              <button
                onClick={() => setPendingUpdates([])}
                className="text-[11px] text-muted hover:text-ink flex items-center gap-1 transition-colors px-1"
                title="Discard staged changes"
              >
                <RotateCcw className="w-3 h-3" />
                Discard
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-3 py-1 rounded-lg transition-colors shadow-2xs"
              >
                <Save className="w-3 h-3" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {result.columns.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Quick Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-muted" />
                <input
                  type="text"
                  placeholder="Filter table..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="bg-canvas border border-hairline rounded-xl pl-8 pr-3 py-1 text-xs text-ink placeholder:text-muted-soft focus:border-primary outline-none"
                />
              </div>

              <button
                onClick={exportCsv}
                className="flex items-center gap-1 text-xs font-medium text-ink bg-surface-card hover:bg-surface-cream px-3 py-1 rounded-xl border border-hairline transition-colors shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                Export CSV
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
                      className="px-4 py-2.5 text-sm font-semibold text-ink border-r border-hairline whitespace-nowrap relative group cursor-pointer hover:bg-surface-cream transition-colors"
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
                                <span className="text-[9px] bg-primary/20 rounded-full px-1 py-0.2">
                                  {sortRank}
                                </span>
                              )}
                            </span>
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-muted-soft opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>

                        <span className="text-[11px] font-mono font-normal text-muted-soft uppercase bg-canvas px-1.5 py-0.5 rounded border border-hairline shrink-0">
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
                          className={`px-4 py-2 text-[13.5px] border-r border-hairline whitespace-nowrap font-mono transition-colors relative cursor-pointer truncate ${
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
                                className="w-full bg-canvas text-ink border-2 border-primary rounded-md px-2 py-0.5 text-xs font-mono outline-none shadow-xs"
                              />
                              <button
                                onClick={() => commitEdit(globalRowIdx, colIdx, cell, row)}
                                className="text-success hover:bg-surface-cream p-1 rounded"
                                title="Confirm edit (Enter)"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-muted hover:bg-surface-cream p-1 rounded"
                                title="Cancel (Esc)"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className={`flex items-center gap-2 ${isNumber ? "justify-end" : "justify-between"}`}>
                              <span className="truncate">
                                {displayVal === null ? (
                                  <span className="text-[11px] text-muted-soft italic bg-surface-soft px-1.5 py-0.2 rounded border border-hairline">
                                    NULL
                                  </span>
                                ) : typeof displayVal === "boolean" ? (
                                  <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                                      displayVal
                                        ? "bg-success/15 text-success border-success/30"
                                        : "bg-surface-cream text-muted border-hairline"
                                    }`}
                                  >
                                    {displayVal ? "TRUE" : "FALSE"}
                                  </span>
                                ) : typeof displayVal === "number" ? (
                                  <span className="text-accent-teal font-semibold">{displayVal}</span>
                                ) : (
                                  <span>{String(displayVal)}</span>
                                )}
                              </span>
                              {pending && (
                                <span className="text-[10px] bg-primary text-on-primary px-1.5 py-0.2 rounded uppercase tracking-wider font-sans shrink-0">
                                  edited
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {bottomPadding > 0 && (
                <tr>
                  <td colSpan={result.columns.length + 1} style={{ height: `${bottomPadding}px` }} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
