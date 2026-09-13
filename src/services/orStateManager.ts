
const PREFIX = "torsz_solver_state_";

export function loadSavedSolverState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

export function saveSolverState<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(data));
  } catch {}
}
