import React, { useState } from "react";
import { GraphicalLpSolution } from "../services/or/types";

interface GraphicalLpCanvasProps {
  solution: GraphicalLpSolution;
  onUpdateConstraintRhs?: (constraintIndex: number, newRhs: number) => void;
}

export const GraphicalLpCanvas: React.FC<GraphicalLpCanvasProps> = ({
  solution,
  onUpdateConstraintRhs,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; z: number; isOpt: boolean } | null>(null);
  const [draggingLineIdx, setDraggingLineIdx] = useState<number | null>(null);

  const width = 500;
  const height = 380;
  const padding = 50;

  const maxX = Math.max(solution.maxX, 8);
  const maxY = Math.max(solution.maxY, 8);

  const scaleX = (x: number) => padding + (x / maxX) * (width - 2 * padding);
  const scaleY = (y: number) => height - padding - (y / maxY) * (height - 2 * padding);
  const unscaleX = (px: number) => ((px - padding) / (width - 2 * padding)) * maxX;
  const unscaleY = (py: number) => ((height - padding - py) / (height - 2 * padding)) * maxY;

  // SVG Polygon path for feasible region
  const polygonPoints = solution.feasiblePolygon
    .map(([x, y]) => `${scaleX(x)},${scaleY(y)}`)
    .join(" ");

  const handleHandleMouseDown = (lineIdx: number, e: React.MouseEvent) => {
    if (!onUpdateConstraintRhs) return;
    e.preventDefault();
    setDraggingLineIdx(lineIdx);

    const line = solution.lines[lineIdx];
    if (!line) return;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = moveEvent.clientX - rect.left;
      const mouseY = moveEvent.clientY - rect.top;

      const modelX = Math.max(0, unscaleX(mouseX));
      const modelY = Math.max(0, unscaleY(mouseY));

      const newRhs = Math.round((line.c1 * modelX + line.c2 * modelY) * 10) / 10;
      if (newRhs >= 1 && newRhs <= 100) {
        onUpdateConstraintRhs(lineIdx, newRhs);
      }
    };

    const onMouseUp = () => {
      setDraggingLineIdx(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-6 items-center animate-swiftui-slide-up text-ink select-none">
      <div className="relative bg-canvas border border-hairline rounded-xl p-2 shadow-inner">
        <svg
          width={width}
          height={height}
          className={`overflow-visible ${draggingLineIdx !== null ? "cursor-grabbing" : ""}`}
        >
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
                  stroke="var(--color-hairline-soft)"
                  strokeDasharray="2,2"
                />
                <line
                  x1={scaleX(0)}
                  y1={scaleY(yVal)}
                  x2={scaleX(maxX)}
                  y2={scaleY(yVal)}
                  stroke="var(--color-hairline-soft)"
                  strokeDasharray="2,2"
                />
                <text
                  x={scaleX(xVal)}
                  y={height - padding + 18}
                  fill="var(--color-muted)"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {Math.round(xVal * 10) / 10}
                </text>
                <text
                  x={padding - 10}
                  y={scaleY(yVal) + 3}
                  fill="var(--color-muted)"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
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
            stroke="var(--color-ink)"
            strokeWidth="1.5"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={padding}
            y2={padding - 10}
            stroke="var(--color-ink)"
            strokeWidth="1.5"
          />
          <text
            x={width - padding + 15}
            y={height - padding + 4}
            fill="var(--color-ink)"
            fontSize="11"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            x₁
          </text>
          <text
            x={padding}
            y={padding - 15}
            fill="var(--color-ink)"
            fontSize="11"
            fontWeight="bold"
            fontFamily="sans-serif"
            textAnchor="middle"
          >
            x₂
          </text>

          {/* Feasible Region Shading */}
          {polygonPoints && (
            <polygon
              points={polygonPoints}
              fill="rgba(93, 184, 166, 0.25)"
              stroke="#5db8a6"
              strokeWidth="2"
              className="transition-all duration-300 ease-apple-spring"
            />
          )}

          {/* Constraint Lines & Interactive Drag Handles */}
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

            const midX = (p1[0] + p2[0]) / 2;
            const midY = (p1[1] + p2[1]) / 2;

            return (
              <g key={idx}>
                <line
                  x1={scaleX(p1[0])}
                  y1={scaleY(p1[1])}
                  x2={scaleX(p2[0])}
                  y2={scaleY(p2[1])}
                  stroke={col}
                  strokeWidth="2.5"
                  className="transition-all duration-300 ease-apple-ease"
                />

                {/* Draggable Constraint Line Handle */}
                {onUpdateConstraintRhs && midX >= 0 && midY >= 0 && (
                  <circle
                    cx={scaleX(midX)}
                    cy={scaleY(midY)}
                    r={draggingLineIdx === idx ? 7 : 5}
                    fill={col}
                    stroke="var(--color-canvas)"
                    strokeWidth="2"
                    onMouseDown={(e) => handleHandleMouseDown(idx, e)}
                    className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform shadow-md"
                  >
                    <title>Drag to adjust constraint RHS limit</title>
                  </circle>
                )}
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
                stroke="var(--color-canvas)"
                strokeWidth="1.5"
                onMouseEnter={() =>
                  setHoveredPoint({
                    x: pt.x1,
                    y: pt.x2,
                    z: pt.zValue,
                    isOpt: pt.isOptimal,
                  })
                }
                onMouseLeave={() => setHoveredPoint(null)}
                className="cursor-pointer hover:scale-125 transition-transform"
              />
            </g>
          ))}

          {/* Optimal Target Vertex with SwiftUI Pulse Ring */}
          <circle
            cx={scaleX(solution.optimalPoint[0])}
            cy={scaleY(solution.optimalPoint[1])}
            r="14"
            fill="none"
            stroke="#cc785c"
            strokeWidth="2"
            className="animate-swiftui-ring"
          />
          <circle
            cx={scaleX(solution.optimalPoint[0])}
            cy={scaleY(solution.optimalPoint[1])}
            r="6.5"
            fill="#cc785c"
            stroke="var(--color-canvas)"
            strokeWidth="2"
            className="animate-pulse"
          />
        </svg>

        {/* Hover Coordinate Card */}
        {hoveredPoint && (
          <div className="absolute top-4 right-4 bg-surface-card border border-hairline p-2 rounded-lg text-[11px] font-mono shadow-md pointer-events-none">
            <div className="font-bold text-ink">
              ({hoveredPoint.x}, {hoveredPoint.y})
            </div>
            <div className="text-primary font-semibold">Z = {hoveredPoint.z}</div>
            {hoveredPoint.isOpt && (
              <div className="text-success font-bold">★ Optimal Vertex</div>
            )}
          </div>
        )}
      </div>

      {/* Legend & Vertex Table */}
      <div className="space-y-3 w-full md:w-60 text-xs">
        <div className="border-b border-hairline pb-2 flex items-center justify-between">
          <span className="font-semibold text-ink uppercase tracking-wider">
            Feasible Vertices
          </span>
          <span className="font-mono text-primary font-bold">
            Max Z = {solution.optimalZ}
          </span>
        </div>

        <div className="max-h-52 overflow-y-auto pr-1">
          <table className="w-full text-left font-mono border-collapse">
            <thead>
              <tr className="text-muted border-b border-hairline">
                <th className="p-1">Point (x₁, x₂)</th>
                <th className="p-1 text-right">Z Value</th>
                <th className="p-1 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {solution.cornerPoints.map((pt, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-hairline-soft ${
                    pt.isOptimal
                      ? "bg-primary/15 font-bold text-primary"
                      : pt.isFeasible
                      ? "text-ink"
                      : "text-muted-soft line-through"
                  }`}
                >
                  <td className="p-1">
                    ({pt.x1}, {pt.x2})
                  </td>
                  <td className="p-1 text-right">{pt.zValue}</td>
                  <td className="p-1 text-center text-[10px]">
                    {pt.isOptimal ? "OPTIMAL ★" : pt.isFeasible ? "Feasible" : "Infeasible"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {onUpdateConstraintRhs && (
          <div className="text-[11px] text-muted-soft italic">
            Tip: Drag constraint handle dots on the canvas to dynamically adjust limits.
          </div>
        )}
      </div>
    </div>
  );
};
