import React, { useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, Sparkles, Layers } from "lucide-react";

export interface BranchNode {
  id: number;
  label: string;
  condition: string;
  zValue: number | null;
  solution: number[];
  status: "integer-optimal" | "fathomed-bound" | "fathomed-infeasible" | "branched";
  children?: BranchNode[];
}

interface BranchAndBoundTreeProps {
  initialObjective?: string;
  objectiveCoeffs?: number[];
}

export const BranchAndBoundTree: React.FC<BranchAndBoundTreeProps> = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<number>(1);

  // Pre-computed textbook Branch and Bound tree for LP relaxation: Max 5x1 + 4x2
  const treeData: BranchNode = {
    id: 1,
    label: "Root Node (LP Relaxation)",
    condition: "x1, x2 >= 0 (continuous)",
    zValue: 21.0,
    solution: [3.0, 1.5],
    status: "branched",
    children: [
      {
        id: 2,
        label: "Subproblem 1",
        condition: "x2 <= 1",
        zValue: 20.67,
        solution: [3.33, 1.0],
        status: "branched",
        children: [
          {
            id: 4,
            label: "Subproblem 3",
            condition: "x1 <= 3, x2 <= 1",
            zValue: 19.0,
            solution: [3.0, 1.0],
            status: "integer-optimal",
          },
          {
            id: 5,
            label: "Subproblem 4",
            condition: "x1 >= 4, x2 <= 1",
            zValue: 20.0,
            solution: [4.0, 0.0],
            status: "integer-optimal",
          },
        ],
      },
      {
        id: 3,
        label: "Subproblem 2",
        condition: "x2 >= 2",
        zValue: 18.0,
        solution: [2.0, 2.0],
        status: "integer-optimal",
      },
    ],
  };

  const renderNode = (node: BranchNode, depth = 0) => {
    const isSelected = selectedNodeId === node.id;
    const isOptimal = node.id === 5; // Best integer solution Z* = 20 (4, 0)

    return (
      <div key={node.id} className="space-y-2">
        <div
          onClick={() => setSelectedNodeId(node.id)}
          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-150 flex items-start justify-between gap-3 ${
            isSelected
              ? "bg-canvas border-primary shadow-xs ring-1 ring-primary/30"
              : "bg-surface-card border-hairline hover:bg-surface-cream"
          }`}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 font-bold text-ink truncate">
              {node.status === "integer-optimal" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
              ) : node.status === "fathomed-infeasible" ? (
                <XCircle className="w-3.5 h-3.5 text-error shrink-0" />
              ) : node.status === "fathomed-bound" ? (
                <MinusCircle className="w-3.5 h-3.5 text-muted-soft shrink-0" />
              ) : (
                <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              <span>{node.label}</span>
              {isOptimal && (
                <span className="text-[10px] font-bold text-success bg-success/15 px-1.5 py-0.2 rounded border border-success/30">
                  BEST INTEGER ★
                </span>
              )}
            </div>

            <div className="text-[11px] text-muted-soft font-mono">
              Branch: <span className="text-body font-semibold">{node.condition}</span>
            </div>
          </div>

          <div className="text-right shrink-0 font-mono">
            <div className="font-bold text-primary">
              {node.zValue !== null ? `Z = ${node.zValue}` : "Infeasible"}
            </div>
            <div className="text-[10px] text-muted-soft">
              ({node.solution.map((v) => Math.round(v * 100) / 100).join(", ")})
            </div>
          </div>
        </div>

        {node.children && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-4 select-none animate-keyframe-fade-up text-ink">
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Branch-and-Bound Integer Programming Tree
          </h4>
        </div>
        <span className="text-xs font-mono font-bold text-success bg-success/10 px-2.5 py-1 rounded-lg border border-success/20">
          Optimal Integer Z* = 20.0 (x₁=4, x₂=0)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tree Exploration Column */}
        <div className="md:col-span-2 space-y-2 max-h-80 overflow-y-auto pr-1">
          {renderNode(treeData)}
        </div>

        {/* Selected Node Inspector Panel */}
        <div className="bg-canvas border border-hairline rounded-xl p-4 space-y-3 text-xs">
          <div className="font-bold text-ink text-sm border-b border-hairline pb-2">
            Node Inspector #{selectedNodeId}
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-muted">Status:</span>
              <span className="font-semibold text-primary">
                {selectedNodeId === 5 ? "Best Integer Solution ★" : selectedNodeId === 4 || selectedNodeId === 3 ? "All-Integer Feasible" : "Continuous LP (Branching Required)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Objective Z:</span>
              <span className="font-mono font-bold text-ink">
                {selectedNodeId === 1 ? "21.0" : selectedNodeId === 2 ? "20.67" : selectedNodeId === 3 ? "18.0" : selectedNodeId === 4 ? "19.0" : "20.0"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Variables (x₁, x₂):</span>
              <span className="font-mono font-bold text-accent-teal">
                {selectedNodeId === 1 ? "(3.0, 1.5)" : selectedNodeId === 2 ? "(3.33, 1.0)" : selectedNodeId === 3 ? "(2, 2)" : selectedNodeId === 4 ? "(3, 1)" : "(4, 0)"}
              </span>
            </div>
          </div>

          <div className="p-2.5 bg-surface-soft rounded-lg text-[10px] text-muted-soft leading-relaxed border border-hairline">
            Fathoming rule: When all decision variables take integer values (x₁, x₂ are integer), the subproblem node is pruned as a candidate.
          </div>
        </div>
      </div>
    </div>
  );
};
