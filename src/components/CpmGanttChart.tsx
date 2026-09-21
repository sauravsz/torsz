import React, { useState } from "react";
import { Clock } from "lucide-react";
import { CpmSolution } from "../services/or/types";

interface CpmGanttChartProps {
  activities: CpmSolution["activities"];
  projectDuration: number;
  criticalPath: string[];
}

export const CpmGanttChart: React.FC<CpmGanttChartProps> = ({
  activities,
  projectDuration,
  criticalPath: _criticalPath,
}) => {
  const [hoveredActId, setHoveredActId] = useState<string | null>(null);

  if (!activities || activities.length === 0 || projectDuration <= 0) {
    return null;
  }

  const sortedActivities = [...activities].sort((a, b) => {
    if (a.earlyStart !== b.earlyStart) return a.earlyStart - b.earlyStart;
    return a.id.localeCompare(b.id);
  });

  const maxTime = Math.max(projectDuration, ...sortedActivities.map((a) => a.lateFinish || a.earlyFinish));
  const timeUnits = Math.ceil(maxTime);

  // SVG Dimension calculations
  const rowHeight = 36;
  const labelWidth = 140;
  const chartWidth = 580;
  const totalWidth = labelWidth + chartWidth + 40;
  const headerHeight = 32;
  const totalHeight = headerHeight + sortedActivities.length * rowHeight + 40;

  const timeToX = (t: number) => {
    return labelWidth + (t / timeUnits) * chartWidth;
  };

  // Generate grid ticks
  const tickStep = timeUnits <= 15 ? 1 : timeUnits <= 30 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= timeUnits; t += tickStep) {
    ticks.push(t);
  }
  if (!ticks.includes(timeUnits)) {
    ticks.push(timeUnits);
  }

  const hoveredActivity = sortedActivities.find((a) => a.id === hoveredActId);

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4 animate-keyframe-fade-up text-ink select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Gantt Chart & Schedule Timeline ({timeUnits} Time Units)
          </h4>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary border border-primary/40" />
            <span className="font-medium text-ink">Critical (Zero Slack)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted-soft/40 border border-hairline" />
            <span className="text-muted">Non-Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 border border-dashed border-accent-amber" />
            <span className="text-muted">Float / Slack</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="overflow-x-auto bg-canvas rounded-xl border border-hairline p-3">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full h-auto min-w-[640px]"
          style={{ maxHeight: "420px" }}
        >
          {/* Vertical Grid Lines and Timeline Header */}
          {ticks.map((t) => {
            const x = timeToX(t);
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={headerHeight}
                  x2={x}
                  y2={totalHeight - 20}
                  stroke="currentColor"
                  className="text-hairline/60"
                  strokeDasharray={t % (tickStep * 2) === 0 ? undefined : "2,3"}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={headerHeight - 10}
                  textAnchor="middle"
                  className="fill-muted text-[10px] font-mono font-bold"
                >
                  t={t}
                </text>
                <text
                  x={x}
                  y={totalHeight - 6}
                  textAnchor="middle"
                  className="fill-muted text-[9px] font-mono"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Project Completion Milestone Flag */}
          <line
            x1={timeToX(projectDuration)}
            y1={headerHeight - 4}
            x2={timeToX(projectDuration)}
            y2={totalHeight - 20}
            stroke="#cc785c"
            strokeWidth="2"
            strokeDasharray="4,2"
          />

          {/* Activity Rows */}
          {sortedActivities.map((act, idx) => {
            const y = headerHeight + idx * rowHeight + 6;
            const barHeight = 22;
            const startX = timeToX(act.earlyStart);
            const endX = timeToX(act.earlyFinish);
            const barWidth = Math.max(endX - startX, 4);
            const lateFinishX = timeToX(act.lateFinish ?? act.earlyFinish);
            const slackWidth = Math.max(lateFinishX - endX, 0);
            const isCritical = act.isCritical;
            const isHovered = hoveredActId === act.id;

            return (
              <g
                key={act.id}
                onMouseEnter={() => setHoveredActId(act.id)}
                onMouseLeave={() => setHoveredActId(null)}
                className="cursor-pointer transition-opacity"
                opacity={hoveredActId === null || isHovered ? 1 : 0.45}
              >
                {/* Row Hover Background */}
                <rect
                  x={0}
                  y={y - 4}
                  width={totalWidth}
                  height={rowHeight}
                  fill={isHovered ? "currentColor" : "transparent"}
                  className="text-surface-soft/40"
                  rx="4"
                />

                {/* Left Axis Activity Label */}
                <text
                  x={12}
                  y={y + 14}
                  className={`text-[11px] font-mono ${
                    isCritical ? "fill-primary font-bold" : "fill-ink font-medium"
                  }`}
                >
                  <tspan className="font-bold">{act.id}</tspan>
                  <tspan className="fill-muted font-sans text-[10px]">
                    {" "}
                    ({act.duration}w)
                  </tspan>
                </text>

                {/* Slack / Float extension bar */}
                {slackWidth > 0 && (
                  <g>
                    <rect
                      x={endX}
                      y={y + 5}
                      width={slackWidth}
                      height={barHeight - 10}
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="1.5"
                      strokeDasharray="3,2"
                      rx="3"
                    />
                    <text
                      x={endX + slackWidth / 2}
                      y={y + 14}
                      textAnchor="middle"
                      className="fill-accent-amber text-[9px] font-mono font-bold"
                    >
                      +{act.slack}
                    </text>
                  </g>
                )}

                {/* Main Duration Bar */}
                <rect
                  x={startX}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  fill={isCritical ? "#cc785c" : "#dfd4c4"}
                  stroke={isCritical ? "#a9583e" : "#8e8b82"}
                  strokeWidth={isHovered ? "2" : "1"}
                  className="transition-all"
                />

                {/* Bar Text Label */}
                {barWidth > 28 && (
                  <text
                    x={startX + barWidth / 2}
                    y={y + 15}
                    textAnchor="middle"
                    className={`text-[10px] font-mono font-bold ${
                      isCritical ? "fill-white" : "fill-ink"
                    }`}
                  >
                    {act.earlyStart}→{act.earlyFinish}
                  </text>
                )}

                {/* Critical Star Badge */}
                {isCritical && (
                  <text
                    x={startX + 6}
                    y={y + 14}
                    className="fill-white text-[10px]"
                  >
                    ★
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected / Hovered Detail Pill */}
      {hoveredActivity && (
        <div className="p-3 bg-canvas border border-primary/30 rounded-xl flex flex-wrap items-center justify-between text-xs animate-keyframe-fade-up">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              Activity {hoveredActivity.id}
            </span>
            <span className="font-medium text-ink">Duration: {hoveredActivity.duration} units</span>
          </div>

          <div className="flex items-center gap-4 text-muted text-[11px] font-mono">
            <span>Early: [{hoveredActivity.earlyStart}, {hoveredActivity.earlyFinish}]</span>
            <span>Late: [{hoveredActivity.lateStart}, {hoveredActivity.lateFinish}]</span>
            <span className={hoveredActivity.isCritical ? "text-primary font-bold" : "text-ink"}>
              Slack: {hoveredActivity.slack} units {hoveredActivity.isCritical ? "(CRITICAL)" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
