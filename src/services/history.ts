export interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  executionTimeMs: number;
  rowCount: number | null;
  status: "success" | "error";
  errorMessage?: string;
}

const STORAGE_KEY = "torsz_query_history_v1";

export function getQueryHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to load query history:", err);
    return [];
  }
}

export function addHistoryItem(
  item: Omit<QueryHistoryItem, "id" | "timestamp">
): QueryHistoryItem {
  const newItem: QueryHistoryItem = {
    ...item,
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  try {
    const existing = getQueryHistory();
    // Keep max 100 recent queries
    const updated = [newItem, ...existing.filter((h) => h.sql !== item.sql)].slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save query history:", err);
  }

  return newItem;
}

export function deleteHistoryItem(id: string): QueryHistoryItem[] {
  try {
    const existing = getQueryHistory();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearQueryHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear query history:", err);
  }
}
