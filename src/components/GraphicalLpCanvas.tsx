import React from "react";
import { GraphicalLpSolution } from "../services/or/types";

interface GraphicalLpCanvasProps {
  solution: GraphicalLpSolution;
}

export const GraphicalLpCanvas: React.FC<GraphicalLpCanvasProps> = ({ solution }) => {
  const width = 500;
  const height = 380;
  const padding = 50;

  const maxX = Math.max(solution.maxX, 8);
  const maxY = Math.max(solution.maxY, 8);

  const scaleX = (x: number) => padding + (x / maxX) * (width - 2 * padding);
  const scaleY = (y: number) => height - padding - (y / maxY) * (height - 2 * padding);

  // SVG Polygon path for feasible region
  const polygonPoints = solution.feasiblePolygon
    .map(([x, y]) => `${scaleX(x)},${scaleY(y)}`)
    .join(" ");

  return (
    <div className="bg-surface-dark border border-surface-dark-elevated rounded-2xl p-5 shadow-md flex flex-col md:flex-row gap-6 items-center animate-keyframe-fade-up">
      <div className="relative bg-[#141312] border border-surface-dark-elevated rounded-xl p-2 shadow-inner">
        <svg width={width} height={height} className="overflow-visible">
          {/* Grid lines */}
          {Array.from({ length: 9 }).map((_, i) => {
            const xVal = (maxX / 8) * i;
            const yVal = (maxY / 8) * i;
            return (
              <g key={i}>
                <line
                  x1={scaleX(xVal)}
                  y1={scaleY(0)}
                  x2={scaleX(xVal)}
                  y2={scaleY(maxY)}
                  stroke="#252320"
                  strokeDasharray="2,2"
                />
                <line
                  x1={scaleX(0)}
                  y1={scaleY(yVal)}
                  x2={scaleX(maxX)}
                  y2={scaleY(yVal)}
                  stroke="#252320"
                  strokeDasharray="2,2"
                />
                <text x={scaleX(xVal)} y={height - padding + 18} fill="#6c6a64" fontSize="10" textAnchor="middle" fontFamily="monospace">
                  {Math.round(xVal * 10) / 10}
                </text>
                <text x={padding - 10} y={scaleY(yVal) + 3} fill="#6c6a64" fontSize="10" textAnchor="end" fontFamily="monospace">
                  {Math.round(yVal * 10) / 10}
                </text>
              </g>
            );
          })}

          {/* X & Y Axes */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding + 10}
            y2={height - padding}
            stroke="#e6dfd8"
            strokeWidth="2"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={padding}
            y2={padding - 10}
            stroke="#e6dfd8"
            strokeWidth="2"
          />
          <text x={width - padding + 15} y={height - padding + 4} fill="#faf9f5" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
            x₁
          </text>
          <text x={padding} y={padding - 15} fill="#faf9f5" fontSize="11" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
            x₂
          </text>

          {/* Feasible Region Shading */}
          {polygonPoints && (
            <polygon
              points={polygonPoints}
              fill="rgba(93, 184, 166, 0.25)"
              stroke="#5db8a6"
              strokeWidth="2"
              className="transition-all duration-500 ease-apple-spring"
            />
          )}
          {/* Constraint Lines */}
          {solution.lines.map((line, idx) => {
            const colors = ["#cc785c", "#e8a55a", "#5db872", "#93c5fd", "#d8b4fe"];
            const col = colors[idx % colors.length];

            let p1: [number, number] = [0, 0];
            let p2: [number, number] = [maxX, 0];

            if (line.c2 !== 0 && line.c1 !== 0) {
              const y0 = line.rhs / line.c2;
              const yMax = (line.rhs - line.c1 * maxX) / line.c2;
              p1 = [0, y0];
              p2 = [maxX, yMax];
            } else if (line.c2 === 0) {
              const xFix = line.rhs / line.c1;
              p1 = [xFix, 0];
              p2 = [xFix, maxY];
            } else if (line.c1 === 0) {
              const yFix = line.rhs / line.c2;
              p1 = [0, yFix];
              p2 = [maxX, yFix];
            }

            return (
              <g key={idx}>
                <line
                  x1={scaleX(p1[0])}
                  y1={scaleY(p1[1])}
                  x2={scaleX(p2[0])}
                  y2={scaleY(p2[1])}
                  stroke={col}
                  strokeWidth="2"
                  className="transition-all duration-700 ease-apple-ease"
                />
              </g>
            );
          })}

          {/* Corner Points */}
          {solution.cornerPoints.map((pt, idx) => (
            <g key={idx}>
              <circle
                cx={scaleX(pt.x1)}
                cy={scaleY(pt.x2)}
                r={pt.isOptimal ? 6 : pt.isFeasible ? 4.5 : 3}
                fill={pt.isOptimal ? "#cc785c" : pt.isFeasible ? "#5db872" : "#6c6a64"}
                stroke="#faf9f5"
                strokeWidth="1.5"
              />
            </g>
          ))}

          {/* Optimal Target Vertex with Keyframer Pulse Ring */}
          <circle
            cx={scaleX(solution.optimalPoint[0])}
            cy={scaleY(solution.optimalPoint[1])}
            r="12"
            fill="none"
            stroke="#cc785c"
            strokeWidth="1.5"
            className="animate-ping opacity-75"
          />
          <circle
            cx={scaleX(solution.optimalPoint[0])}
            cy={scaleY(solution.optimalPoint[1])}
            r="6.5"
            fill="#cc785c"
            stroke="#faf9f5"
            strokeWidth="2"
            className="animate-pulse"
          />
        </svg>
      </div>

      {/* Legend & Vertex Table */}
      <div className="flex-1 space-y-4">
        <div>
          <h4 className="font-editorial-serif text-xl font-semibold text-on-dark mb-1">
            2D Graphical Solution
          </h4>
          <p className="text-xs text-on-dark-soft">
            Feasible region shown in <span className="text-accent-teal font-semibold">Teal</span>. Optimal corner point at{" "}
            <span className="text-primary font-bold">
              ({solution.optimalPoint[0]}, {solution.optimalPoint[1]})
            </span>{" "}
            with <span className="text-primary font-bold">Z* = {solution.optimalZ}</span>.
          </p>
        </div>

        {/* Constraint Legend */}
        <div className="space-y-1.5 bg-surface-dark-soft p-3 rounded-xl border border-surface-dark-elevated text-xs font-mono">
          <span className="text-[10px] uppercase font-semibold text-muted-soft block font-sans mb-1">
            Constraint Lines:
          </span>
          {solution.lines.map((l, i) => {
            const colors = ["#cc785c", "#e8a55a", "#5db872", "#93c5fd", "#d8b4fe"];
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-0.5" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-on-dark">{l.label}</span>
              </div>
            );
          })}
        </div>

        {/* Vertex Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-dark-elevated text-muted-soft">
                <th className="p-1.5">Corner (x₁, x₂)</th>
                <th className="p-1.5">Z Value</th>
                <th className="p-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {solution.cornerPoints
                .filter((p) => p.isFeasible)
                .map((p, i) => (
                  <tr
                    key={i}
                    className={`border-b border-surface-dark-elevated/40 ${
                      p.isOptimal ? "bg-primary/20 text-primary font-bold" : "text-on-dark"
                    }`}
                  >
                    <td className="p-1.5">
                      ({p.x1}, {p.x2})
                    </td>
                    <td className="p-1.5">{p.zValue}</td>
                    <td className="p-1.5">
                      {p.isOptimal ? "OPTIMAL ★" : "Feasible"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
