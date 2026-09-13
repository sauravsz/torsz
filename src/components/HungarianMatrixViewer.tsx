import React, { useState } from "react";
import { AssignmentSolution } from "../services/or/types";
import { CheckCircle2, ChevronRight, ChevronLeft, Layers } from "lucide-react";

interface HungarianMatrixViewerProps {
  workers: string[];
  jobs: string[];
  costs: number[][];
  solution: AssignmentSolution;
}

export const HungarianMatrixViewer: React.FC<HungarianMatrixViewerProps> = ({
  workers,
  jobs,
  costs,
  solution,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Compute row reductions and column reductions
  const rowMins = costs.map((row) => Math.min(...row));
  const rowReduced = costs.map((row, r) => row.map((val) => val - rowMins[r]));

  const colMins = jobs.map((_, c) => Math.min(...rowReduced.map((row) => row[c])));
  const colReduced = rowReduced.map((row) => row.map((val, c) => val - colMins[c]));

  const steps = [
    {
      title: "Step 1: Original Cost Matrix",
      desc: "Initial worker-to-job assignment cost coefficients.",
      matrix: costs,
      highlights: [],
    },
    {
      title: "Step 2: Row Reduction (Subtract Row Mins)",
      desc: "Subtract the minimum element in each row from all elements in that row.",
      matrix: rowReduced,
      highlights: rowMins.map((min, r) => ({ text: `Row ${r + 1} min: -${min}` })),
    },
    {
      title: "Step 3: Column Reduction (Subtract Column Mins)",
      desc: "Subtract the minimum element in each column from all elements in that column.",
      matrix: colReduced,
      highlights: colMins.map((min, c) => ({ text: `Col ${c + 1} min: -${min}` })),
    },
    {
      title: "Step 4: Optimal One-to-One Zero Matchings",
      desc: "Optimal assignment allocation derived from zero-cost reduced cells.",
      matrix: colReduced,
      isFinal: true,
    },
  ];

  const step = steps[currentStep] || steps[0];

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4 animate-keyframe-fade-up select-none text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Hungarian Reduction Steps:
          </span>
          <div className="flex items-center gap-1 bg-canvas p-1 rounded-lg border border-hairline">
            <button
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="p-1 text-muted hover:text-ink disabled:opacity-30 rounded transition-colors"
              title="Previous Step"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {steps.map((_s, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-150 active:scale-[0.97] ${
                  currentStep === idx
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-muted hover:text-ink hover:bg-surface-soft"
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
              disabled={currentStep === steps.length - 1}
              className="p-1 text-muted hover:text-ink disabled:opacity-30 rounded transition-colors"
              title="Next Step"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-primary">
          Total Optimal Cost: ${solution.totalCost}
        </span>
      </div>

      <div className="p-2.5 bg-canvas rounded-xl border border-hairline flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-ink">{step.title}: </span>
          <span className="text-muted">{step.desc}</span>
        </div>
      </div>

      {/* Animated Hungarian Matrix Grid */}
      <div className="overflow-x-auto bg-canvas rounded-xl border border-hairline p-1">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft text-muted">
              <th className="p-2.5 border-r border-hairline text-ink font-bold">Worker \ Job</th>
              {jobs.map((j) => (
                <th key={j} className="p-2.5 border-r border-hairline text-center text-ink font-semibold">
                  {j}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workers.map((w, r) => (
              <tr key={w} className="border-b border-hairline-soft">
                <td className="p-2.5 font-bold border-r border-hairline text-ink">{w}</td>
                {jobs.map((j, c) => {
                  const val = step.matrix[r]?.[c] ?? 0;
                  const isAssigned =
                    step.isFinal &&
                    solution.assignments.some(
                      (a) => a.worker === w && a.job === j
                    );
                  const isZero = val === 0;

                  return (
                    <td
                      key={c}
                      className={`p-2.5 text-center border-r border-hairline relative transition-all duration-300 ${
                        isAssigned
                          ? "bg-primary/20 text-primary font-bold shadow-inner"
                          : isZero
                          ? "bg-accent-teal/10 text-accent-teal font-bold"
                          : "text-ink"
                      }`}
                    >
                      {val}
                      {isAssigned && (
                        <span className="absolute right-1.5 top-1 text-[10px] text-primary">★</span>
                      )}
                      {/* Animated Line Strikethrough for zero cells in reduced steps */}
                      {(currentStep === 1 || currentStep === 2) && isZero && (
                        <div className="absolute inset-x-1 top-1/2 h-0.5 bg-accent-teal/60 rounded-full animate-swiftui-pop pointer-events-none" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Final Pairings Summary */}
      {step.isFinal && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 animate-keyframe-fade-up">
          {solution.assignments.map((a, i) => (
            <div
              key={i}
              className="bg-surface-card p-3 rounded-xl border border-hairline flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span>{a.worker} → {a.job}</span>
              </div>
              <span className="font-mono text-primary font-bold">${a.cost}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
