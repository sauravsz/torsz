import React from "react";
import { SimplexTableauIteration } from "../services/or/types";

interface SimplexTableauViewerProps {
  tableaus: SimplexTableauIteration[];
}

export const SimplexTableauViewer: React.FC<SimplexTableauViewerProps> = ({ tableaus }) => {
  const [selectedIter, setSelectedIter] = React.useState(tableaus.length - 1);

  React.useEffect(() => {
    setSelectedIter(tableaus.length - 1);
  }, [tableaus]);

  const current = tableaus[selectedIter] || tableaus[0];
  if (!current) return null;

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4 animate-keyframe-fade-up text-ink">
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Simplex Iteration:
          </span>
          <div className="flex items-center gap-1 bg-canvas p-1 rounded-lg border border-hairline">
            {tableaus.map((t, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIter(idx)}
                className={`px-3 py-1 text-xs font-mono font-semibold rounded-md transition-all duration-200 ease-apple-snappy active:scale-[0.97] ${
                  selectedIter === idx
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-muted hover:text-ink hover:bg-surface-soft"
                }`}
              >
                Iteration {t.iteration}
              </button>
            ))}
          </div>
        </div>

        {current.enteringVar && current.leavingVar && (
          <div className="text-xs font-mono flex items-center gap-2 text-muted">
            <span>
              Entering: <span className="text-accent-teal font-bold">{current.enteringVar}</span>
            </span>
            <span>•</span>
            <span>
              Leaving: <span className="text-error font-bold">{current.leavingVar}</span>
            </span>
          </div>
        )}
      </div>

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
                        className={`p-2.5 text-center border-r border-hairline ${
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
              {current.zRow.map((val, colIdx) => (
                <td
                  key={colIdx}
                  className={`p-2.5 text-center border-r border-hairline ${
                    current.pivotColIdx === colIdx ? "bg-primary/20 text-primary font-bold" : "text-ink"
                  }`}
                >
                  {Math.round(val * 1000) / 1000}
                </td>
              ))}
              <td className="p-2.5 text-center text-muted">-</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
