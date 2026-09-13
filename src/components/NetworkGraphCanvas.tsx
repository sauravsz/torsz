import React, { useState, useEffect, useRef } from "react";
import { NetworkEdge } from "../services/or/types";

interface NetworkGraphCanvasProps {
  edges: NetworkEdge[];
  selectedEdges?: { from: string; to: string; weight: number }[];
  startNode?: string;
  endNode?: string;
  type?: "shortest-route" | "minimum-spanning-tree" | "maximal-flow";
}

interface GraphNode {
  id: string;
  x: number;
  y: number;
}

export const NetworkGraphCanvas: React.FC<NetworkGraphCanvasProps> = ({
  edges,
  selectedEdges = [],
  startNode,
  endNode,
  type: _type = "shortest-route",
}) => {
  const width = 680;
  const height = 360;
  const padding = 50;

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute circular layout for nodes on initial load or when edge vertex set changes
  useEffect(() => {
    const nodeSet = new Set<string>();
    for (const e of edges) {
      nodeSet.add(String(e.from));
      nodeSet.add(String(e.to));
    }
    const nodeIds = Array.from(nodeSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ""), 10);
      const numB = parseInt(b.replace(/\D/g, ""), 10);
      return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.localeCompare(b);
    });

    const total = nodeIds.length;
    if (total === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = (width - 2 * padding) / 2.2;
    const radiusY = (height - 2 * padding) / 2.2;

    const computed: GraphNode[] = nodeIds.map((id, idx) => {
      const angle = (2 * Math.PI * idx) / total - Math.PI / 2;
      return {
        id,
        x: centerX + radiusX * Math.cos(angle),
        y: centerY + radiusY * Math.sin(angle),
      };
    });

    setNodes(computed);
  }, [edges]);

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingNodeId(nodeId);
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;

    const rect = (e.target as SVGElement).closest("svg")?.getBoundingClientRect();
    if (!rect) return;

    dragOffsetRef.current = {
      x: e.clientX - rect.left - target.x,
      y: e.clientY - rect.top - target.y,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const mouseX = moveEvent.clientX - rect.left - dragOffsetRef.current.x;
      const mouseY = moveEvent.clientY - rect.top - dragOffsetRef.current.y;

      const clampedX = Math.max(30, Math.min(width - 30, mouseX));
      const clampedY = Math.max(30, Math.min(height - 30, mouseY));

      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, x: clampedX, y: clampedY } : n))
      );
    };

    const onMouseUp = () => {
      setDraggingNodeId(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const selectedSet = new Set(
    selectedEdges.map((e) => `${e.from}->${e.to}`).concat(selectedEdges.map((e) => `${e.to}->${e.from}`))
  );

  const nodePosMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-4 shadow-sm space-y-2 select-none">
      <div className="flex items-center justify-between border-b border-hairline pb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink uppercase tracking-wider">
            Interactive Network Graph Canvas
          </span>
          <span className="text-[11px] text-muted-soft">
            ({nodes.length} nodes, {edges.length} arcs)
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-teal inline-block" />
            <span>Optimal Arcs</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
            <span>Start/End Nodes</span>
          </span>
        </div>
      </div>

      <div className="relative bg-canvas border border-hairline rounded-xl p-1 overflow-hidden">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={`overflow-visible ${draggingNodeId !== null ? "cursor-grabbing" : ""}`}
        >
          {/* Defs for arrow markers */}
          <defs>
            <marker
              id="arrow-optimal"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#5db8a6" />
            </marker>
            <marker
              id="arrow-regular"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--color-hairline)" />
            </marker>
          </defs>

          {/* Arcs / Edges */}
          {edges.map((e, idx) => {
            const u = nodePosMap.get(String(e.from));
            const v = nodePosMap.get(String(e.to));
            if (!u || !v) return null;

            const isSelected =
              selectedSet.has(`${e.from}->${e.to}`) || selectedSet.has(`${e.to}->${e.from}`);
            const midX = (u.x + v.x) / 2;
            const midY = (u.y + v.y) / 2;

            return (
              <g key={idx}>
                <line
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke={isSelected ? "#5db8a6" : "var(--color-hairline)"}
                  strokeWidth={isSelected ? 3.5 : 1.5}
                  strokeDasharray={isSelected ? undefined : "3,2"}
                  className="transition-colors duration-200"
                />

                {/* Weight Pill */}
                <rect
                  x={midX - 14}
                  y={midY - 8}
                  width="28"
                  height="16"
                  rx="4"
                  fill="var(--color-surface-card)"
                  stroke={isSelected ? "#5db8a6" : "var(--color-hairline)"}
                  strokeWidth="1"
                />
                <text
                  x={midX}
                  y={midY + 3.5}
                  fill={isSelected ? "#5db8a6" : "var(--color-muted)"}
                  fontSize="9"
                  fontWeight={isSelected ? "bold" : "normal"}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {e.cost}
                </text>
              </g>
            );
          })}

          {/* Nodes / Vertices */}
          {nodes.map((node) => {
            const isStart = startNode && String(startNode) === node.id;
            const isEnd = endNode && String(endNode) === node.id;

            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                className="cursor-grab active:cursor-grabbing group"
              >
                {(isStart || isEnd) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="18"
                    fill="none"
                    stroke="#cc785c"
                    strokeWidth="1.5"
                    className="animate-ping opacity-50"
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isStart || isEnd ? 14 : 12}
                  fill={isStart || isEnd ? "#cc785c" : "var(--color-surface-card)"}
                  stroke={isStart || isEnd ? "#faf9f5" : "#5db8a6"}
                  strokeWidth="2"
                  className="transition-transform group-hover:scale-110 shadow-md"
                />
                <text
                  x={node.x}
                  y={node.y + 4}
                  fill={isStart || isEnd ? "#ffffff" : "var(--color-ink)"}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-2 right-2 text-[10px] text-muted-soft italic bg-surface-card/80 px-2 py-0.5 rounded border border-hairline pointer-events-none">
          Drag nodes to rearrange graph layout
        </div>
      </div>
    </div>
  );
};
