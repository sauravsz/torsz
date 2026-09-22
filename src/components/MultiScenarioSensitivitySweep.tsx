import React, { useState } from "react";
import { BarChart2 } from "lucide-react";
import { LpProblem } from "../services/or/types";
import { solveLinearProgramming } from "../services/or/solvers";

interface MultiScenarioSensitivitySweepProps {
  baseProblem: LpProblem;
}

export const MultiScenarioSensitivitySweep: React.FC<MultiScenarioSensitivitySweepProps> = ({
  baseProblem,
}) => {
  const [sweepParam, setSweepParam] = useState<"c1" | "c2" | "b1" | "b2">("c1");

  const steps = [-50, -30, -20, -10, 0, 10, 20, 30, 50, 75, 100];

  const sweepResults = steps.map((pct) => {
    const factor = 1 + pct / 100;
    const modified: LpProblem = {
      ...baseProblem,
      objectiveCoefficients: [...baseProblem.objectiveCoefficients],
      constraints: baseProblem.constraints.map((c) => ({ ...c, coefficients: [...c.coefficients] })),
    };

    if (sweepParam === "c1") {
      modified.objectiveCoefficients[0] = Math.round(baseProblem.objectiveCoefficients[0] * factor * 10) / 10;
    } else if (sweepParam === "c2") {
      modified.objectiveCoefficients[1] = Math.round(baseProblem.objectiveCoefficients[1] * factor * 10) / 10;
    } else if (sweepParam === "b1" && modified.constraints[0]) {
      modified.constraints[0].rhs = Math.round(baseProblem.constraints[0].rhs * factor * 10) / 10;
    } else if (sweepParam === "b2" && modified.constraints[1]) {
      modified.constraints[1].rhs = Math.round(baseProblem.constraints[1].rhs * factor * 10) / 10;
    }

    try {
      const sol = solveLinearProgramming(modified);
      return {
        pct,
        paramVal:
          sweepParam === "c1"
            ? modified.objectiveCoefficients[0]
            : sweepParam === "c2"
            ? modified.objectiveCoefficients[1]
            : sweepParam === "b1"
            ? modified.constraints[0]?.rhs
            : modified.constraints[1]?.rhs,
        zValue: sol.objectiveValue,
        x1: sol.variableValues.find((v: { name: string; value: number }) => v.name === "x1")?.value || 0,
        x2: sol.variableValues.find((v: { name: string; value: number }) => v.name === "x2")?.value || 0,
      };
    } catch {
      return {
        pct,
        paramVal: 0,
        zValue: 0,
        x1: 0,
        x2: 0,
      };
    }
  });

  const maxZ = Math.max(...sweepResults.map((r) => r.zValue), 30);
  const minZ = Math.min(...sweepResults.map((r) => r.zValue), 0);

  const svgWidth = 480;
  const svgHeight = 160;
  const padding = 35;

  const points = sweepResults
    .map((r, i) => {
      const x = padding + (i / (sweepResults.length - 1)) * (svgWidth - 2 * padding);
      const y = svgHeight - padding - ((r.zValue - minZ) / (maxZ - minZ || 1)) * (svgHeight - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4 select-none animate-keyframe-fade-up text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-primary shrink-0" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Multi-Scenario Parameter Sensitivity Sweep
          </h4>
        </div>

        <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-hairline text-xs">
          <span className="text-[11px] text-muted px-2 font-medium">Vary Parameter:</span>
          {[
            { id: "c1", label: "Profit c₁ (Product A)" },
            { id: "c2", label: "Profit c₂ (Product B)" },
            { id: "b1", label: "Limit b₁ (Material 1)" },
            { id: "b2", label: "Limit b₂ (Labor)" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSweepParam(opt.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                sweepParam === opt.id
                  ? "bg-primary text-on-primary shadow-xs"
                  : "text-muted hover:text-ink hover:bg-surface-soft"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Sensitivity Curve */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="md:col-span-2 bg-canvas border border-hairline rounded-xl p-3 shadow-inner overflow-hidden">
          <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {/* Axis Lines */}
            <line
              x1={padding}
              y1={svgHeight - padding}
              x2={svgWidth - padding + 10}
              y2={svgHeight - padding}
              stroke="var(--color-hairline)"
              strokeWidth="1.5"
            />
            <line
              x1={padding}
              y1={svgHeight - padding}
              x2={padding}
              y2={padding - 10}
              stroke="var(--color-hairline)"
              strokeWidth="1.5"
            />

            {/* Curve Line */}
            {points && (
              <polyline
                fill="none"
                stroke="#cc785c"
                strokeWidth="2.5"
                points={points}
                className="transition-all duration-300"
              />
            )}

            {/* Curve Point Dots */}
            {sweepResults.map((r, i) => {
              const x = padding + (i / (sweepResults.length - 1)) * (svgWidth - 2 * padding);
              const y = svgHeight - padding - ((r.zValue - minZ) / (maxZ - minZ || 1)) * (svgHeight - 2 * padding);
              const isBase = r.pct === 0;

              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isBase ? 5 : 3.5}
                    fill={isBase ? "#cc785c" : "var(--color-canvas)"}
                    stroke={isBase ? "#ffffff" : "#cc785c"}
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={svgHeight - padding + 14}
                    fill="var(--color-muted)"
                    fontSize="8"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    {r.pct > 0 ? `+${r.pct}%` : `${r.pct}%`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Sweep Table Details */}
        <div className="max-h-40 overflow-y-auto space-y-1 text-xs pr-1">
          <div className="font-semibold text-muted text-[11px] uppercase tracking-wider mb-1">
            Scenario Outcomes:
          </div>
          {sweepResults.slice(0, 7).map((r, i) => (
            <div
              key={i}
              className={`flex items-center justify-between p-1.5 rounded-lg font-mono text-[11px] ${
                r.pct === 0 ? "bg-primary/10 text-primary font-bold" : "text-body"
              }`}
            >
              <span>{r.pct > 0 ? `+${r.pct}%` : `${r.pct}%`} (${r.paramVal})</span>
              <span className="font-bold">Z* = ${r.zValue}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
