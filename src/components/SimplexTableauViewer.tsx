import React, { useState } from "react";
import { CheckCircle2, AlertCircle, Sparkles, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import { SimplexTableauIteration } from "../services/or/types";

interface SimplexTableauViewerProps {
  tableaus: SimplexTableauIteration[];
}

export const SimplexTableauViewer: React.FC<SimplexTableauViewerProps> = ({ tableaus }) => {
  const [selectedIter, setSelectedIter] = useState(tableaus.length - 1);
  const [pedagogicalMode, setPedagogicalMode] = useState(false);
  const [practiceFeedback, setPracticeFeedback] = useState<{
    type: "success" | "error";
    message: string;
    row?: number;
    col?: number;
  } | null>(null);

  React.useEffect(() => {
    setSelectedIter(tableaus.length - 1);
    setPracticeFeedback(null);
  }, [tableaus]);

  const current = tableaus[selectedIter] || tableaus[0];
  if (!current) return null;

  const handleCellClick = (rowIdx: number, colIdx: number) => {
    if (!pedagogicalMode) return;

    const isPivotCol = current.pivotColIdx === colIdx;
    const isPivotRow = current.pivotRowIdx === rowIdx;

    if (isPivotCol && isPivotRow) {
      setPracticeFeedback({
        type: "success",
        message: `Correct Pivot Element (${current.headers[colIdx]}, ${current.basicVars[rowIdx]})! Minimum ratio test passed (${current.ratios?.[rowIdx]}).`,
        row: rowIdx,
        col: colIdx,
      });
      if (selectedIter < tableaus.length - 1) {
        setTimeout(() => {
          setSelectedIter((prev) => prev + 1);
          setPracticeFeedback(null);
        }, 1200);
      }
    } else if (!isPivotCol) {
      setPracticeFeedback({
        type: "error",
        message: `Incorrect column: Variable ${current.headers[colIdx]} does not have the most negative (c_j - z_j) reduced cost.`,
        row: rowIdx,
        col: colIdx,
      });
    } else {
      setPracticeFeedback({
        type: "error",
        message: `Incorrect row: Row ${current.basicVars[rowIdx]} violated the minimum non-negative ratio test.`,
        row: rowIdx,
        col: colIdx,
      });
    }
  };

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4 animate-keyframe-fade-up text-ink select-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Simplex Iteration:
          </span>
          <div className="flex items-center gap-1 bg-canvas p-1 rounded-lg border border-hairline">
            <button
              onClick={() => {
                setSelectedIter((prev) => Math.max(0, prev - 1));
                setPracticeFeedback(null);
              }}
              disabled={selectedIter === 0}
              className="p-1 text-muted hover:text-ink disabled:opacity-30 rounded transition-colors"
              title="Previous Iteration"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {tableaus.map((t, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedIter(idx);
                  setPracticeFeedback(null);
                }}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded-md transition-all duration-150 active:scale-[0.97] ${
                  selectedIter === idx
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-muted hover:text-ink hover:bg-surface-soft"
                }`}
              >
                {t.iteration}
              </button>
            ))}
            <button
              onClick={() => {
                setSelectedIter((prev) => Math.min(tableaus.length - 1, prev + 1));
                setPracticeFeedback(null);
              }}
              disabled={selectedIter === tableaus.length - 1}
              className="p-1 text-muted hover:text-ink disabled:opacity-30 rounded transition-colors"
              title="Next Iteration"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPedagogicalMode(!pedagogicalMode);
              setPracticeFeedback(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              pedagogicalMode
                ? "bg-accent-teal/15 border-accent-teal text-accent-teal shadow-xs"
                : "bg-canvas border-hairline text-muted hover:text-ink"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>{pedagogicalMode ? "Practice Mode Active" : "Practice Mode"}</span>
          </button>
        </div>
      </div>

      {/* Pedagogical Practice Mode Alert */}
      {pedagogicalMode && (
        <div className="p-3 bg-accent-teal/10 border border-accent-teal/30 rounded-xl flex items-center justify-between text-xs text-ink animate-keyframe-fade-up">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-teal shrink-0" />
            <span>Click any matrix cell in the tableau to test your entering/leaving pivot selection!</span>
          </div>
          {practiceFeedback && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                practiceFeedback.type === "success"
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-error/20 text-error border border-error/30"
              }`}
            >
              {practiceFeedback.type === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span>{practiceFeedback.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Tableau Matrix Grid */}
      <div className="overflow-x-auto bg-canvas rounded-xl border border-hairline p-1">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft text-muted">
              <th className="p-2.5 border-r border-hairline text-center font-bold text-ink">Basic</th>
              {current.headers.map((h, colIdx) => (
                <th
                  key={h}
                  className={`p-2.5 border-r border-hairline text-center ${
                    current.pivotColIdx === colIdx ? "bg-primary/10 text-primary font-bold" : "text-ink"
                  }`}
                >
                  {h}
                </th>
              ))}
              <th className="p-2.5 text-center text-muted">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {current.rows.map((row, rowIdx) => {
              const isPivotRow = current.pivotRowIdx === rowIdx;
              const ratio = current.ratios?.[rowIdx];

              return (
                <tr
                  key={rowIdx}
                  className={`border-b border-hairline-soft ${
                    isPivotRow ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="p-2.5 font-bold text-center border-r border-hairline text-accent-teal">
                    {current.basicVars[rowIdx]}
                  </td>
                  {row.map((val, colIdx) => {
                    const isPivotCell = isPivotRow && current.pivotColIdx === colIdx;

                    return (
                      <td
                        key={colIdx}
                        onClick={() => handleCellClick(rowIdx, colIdx)}
                        className={`p-2.5 text-center border-r border-hairline ${
                          pedagogicalMode ? "cursor-pointer hover:bg-primary/20 transition-colors" : ""
                        } ${
                          isPivotCell
                            ? "bg-primary text-on-primary font-bold rounded-sm shadow-xs"
                            : current.pivotColIdx === colIdx
                            ? "bg-primary/10 text-primary font-semibold"
                            : isPivotRow
                            ? "text-primary font-semibold"
                            : "text-ink"
                        }`}
                      >
                        {Math.round(val * 1000) / 1000}
                      </td>
                    );
                  })}
                  <td className="p-2.5 text-center text-muted font-mono">
                    {ratio !== null && ratio !== undefined ? Math.round(ratio * 100) / 100 : "-"}
                  </td>
                </tr>
              );
            })}

            {/* Z-Row */}
            <tr className="bg-primary/5 font-bold border-t-2 border-primary/30 text-primary">
              <td className="p-2.5 text-center border-r border-hairline text-primary">
                Z (z_j - c_j)
              </td>
              {current.zRow.map((val, colIdx) => {
                const isRhsCell = colIdx === current.zRow.length - 1;
                const displayVal = isRhsCell ? Math.abs(val) : val;

                return (
                  <td
                    key={colIdx}
                    className={`p-2.5 text-center border-r border-hairline ${
                      current.pivotColIdx === colIdx
                        ? "bg-primary/20 text-primary font-bold"
                        : isRhsCell
                        ? "font-bold text-primary"
                        : "text-ink"
                    }`}
                  >
                    {Math.round(displayVal * 1000) / 1000}
                  </td>
                );
              })}
              <td className="p-2.5 text-center text-muted">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
