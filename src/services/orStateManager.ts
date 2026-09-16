import { NetworkEdge } from "./or/types";

const PREFIX = "torsz_solver_state_";

const INVALID_NODE_KEYWORDS = new Set([
  "to",
  "from",
  "prob",
  "probability",
  "dist",
  "distance",
  "distance (-log10 p)",
  "distance (−log₁₀ p)",
  "cost",
  "weight",
  "metric",
  "capacity",
  "time",
  "node",
  "station",
  "source",
  "sink",
  "origin",
  "destination",
]);

export function sanitizeNetworkEdges(edges: NetworkEdge[]): NetworkEdge[] {
  if (!Array.isArray(edges)) return [];
  return edges.filter((e) => {
    if (!e || e.from === undefined || e.to === undefined) return false;
    const fromStr = String(e.from).trim().toLowerCase();
    const toStr = String(e.to).trim().toLowerCase();
    if (fromStr === toStr) return false;
    if (INVALID_NODE_KEYWORDS.has(fromStr) || INVALID_NODE_KEYWORDS.has(toStr)) return false;
    if (fromStr.includes("distance") || toStr.includes("distance")) return false;
    if (fromStr.includes("prob") || toStr.includes("prob")) return false;
    return true;
  });
}

export function loadSavedSolverState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (key === "edges" && Array.isArray(parsed)) {
        const sanitized = sanitizeNetworkEdges(parsed);
        // If stored state had corrupt header nodes (e.g. "To", "Prob"), discard and return fallback
        if (sanitized.length < parsed.length || sanitized.length === 0) {
          localStorage.removeItem(`${PREFIX}${key}`);
          return fallback;
        }
        return sanitized as unknown as T;
      }
      return parsed;
    }
  } catch {}
  return fallback;
}

export function saveSolverState<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    if (key === "edges" && Array.isArray(data)) {
      const sanitized = sanitizeNetworkEdges(data as unknown as NetworkEdge[]);
      localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(sanitized));
      return;
    }
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data));
  } catch {}
}
