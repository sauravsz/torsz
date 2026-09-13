import { getWebSqlite } from "../db";
import {
  TransportationProblem,
  NetworkEdge,
  CpmActivity,
} from "./types";

export interface AvailableImportTable {
  name: string;
  rowCount: number;
  columns: string[];
  suggestedType: "network" | "transportation" | "assignment" | "lp" | "cpm" | "generic";
}

export async function detectImportableTables(): Promise<AvailableImportTable[]> {
  const db = await getWebSqlite();
  const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  if (tablesRes.length === 0 || tablesRes[0].values.length === 0) return [];

  const tables: AvailableImportTable[] = [];
  for (const row of tablesRes[0].values) {
    const tableName = String(row[0]);
    try {
      const infoRes = db.exec(`PRAGMA table_info("${tableName}");`);
      const countRes = db.exec(`SELECT COUNT(*) FROM "${tableName}";`);
      const rowCount = countRes[0]?.values[0]?.[0] ? Number(countRes[0].values[0][0]) : 0;
      const columns = infoRes[0]?.values.map((colRow) => String(colRow[1])) || [];

      let suggestedType: AvailableImportTable["suggestedType"] = "generic";
      const colLower = columns.map((c) => c.toLowerCase());

      if (
        (colLower.some((c) => c.includes("from") || c.includes("source") || c.includes("u")) &&
          colLower.some((c) => c.includes("to") || c.includes("dest") || c.includes("v"))) ||
        tableName.includes("network") ||
        tableName.includes("topology") ||
        tableName.includes("route")
      ) {
        suggestedType = "network";
      } else if (
        tableName.includes("transport") ||
        tableName.includes("shipping") ||
        (colLower.includes("source") && colLower.includes("destination"))
      ) {
        suggestedType = "transportation";
      } else if (
        tableName.includes("assign") ||
        (colLower.includes("worker") && colLower.includes("job"))
      ) {
        suggestedType = "assignment";
      } else if (
        tableName.includes("cpm") ||
        tableName.includes("project") ||
        tableName.includes("task") ||
        (colLower.includes("duration") && colLower.some((c) => c.includes("pred")))
      ) {
        suggestedType = "cpm";
      } else if (
        tableName.includes("lp") ||
        tableName.includes("product") ||
        (colLower.includes("profit") || colLower.includes("price"))
      ) {
        suggestedType = "lp";
      }

      tables.push({
        name: tableName,
        rowCount,
        columns,
        suggestedType,
      });
    } catch {}
  }

  return tables;
}

export async function importNetworkEdgesFromDb(tableName: string): Promise<NetworkEdge[]> {
  const db = await getWebSqlite();
  const res = db.exec(`SELECT * FROM "${tableName}" LIMIT 500;`);
  if (res.length === 0 || res[0].values.length === 0) return [];

  const cols = res[0].columns.map((c) => c.toLowerCase());
  const fromIdx = cols.findIndex((c) => c.includes("from") || c.includes("source") || c === "u" || c === "node1" || c.includes("start"));
  const toIdx = cols.findIndex((c) => c.includes("to") || c.includes("dest") || c === "v" || c === "node2" || c.includes("end"));
  const costIdx = cols.findIndex((c) => c.includes("cost") || c.includes("weight") || c.includes("distance") || c.includes("length") || c.includes("price") || c.includes("val"));

  const uIndex = fromIdx !== -1 ? fromIdx : 0;
  const vIndex = toIdx !== -1 ? toIdx : 1;
  const wIndex = costIdx !== -1 ? costIdx : 2;

  const edges: NetworkEdge[] = [];
  for (const row of res[0].values) {
    const from = String(row[uIndex] || "");
    const to = String(row[vIndex] || "");
    const cost = row[wIndex] !== undefined ? parseFloat(String(row[wIndex])) || 10 : 10;
    if (from && to && from !== to) {
      edges.push({ from, to, cost });
    }
  }

  return edges;
}

export async function importTransportationFromDb(tableName: string): Promise<TransportationProblem | null> {
  const db = await getWebSqlite();
  const res = db.exec(`SELECT * FROM "${tableName}" LIMIT 500;`);
  if (res.length === 0 || res[0].values.length === 0) return null;

  const cols = res[0].columns.map((c) => c.toLowerCase());
  const srcIdx = cols.findIndex((c) => c.includes("source") || c.includes("plant") || c.includes("from") || c.includes("origin"));
  const dstIdx = cols.findIndex((c) => c.includes("dest") || c.includes("market") || c.includes("to"));
  const costIdx = cols.findIndex((c) => c.includes("cost") || c.includes("rate") || c.includes("price"));

  if (srcIdx === -1 || dstIdx === -1 || costIdx === -1) {
    return null;
  }

  const sourceSet = new Set<string>();
  const destSet = new Set<string>();
  const costMap: Record<string, Record<string, number>> = {};

  for (const row of res[0].values) {
    const s = String(row[srcIdx]);
    const d = String(row[dstIdx]);
    const c = parseFloat(String(row[costIdx])) || 10;
    sourceSet.add(s);
    destSet.add(d);
    if (!costMap[s]) costMap[s] = {};
    costMap[s][d] = c;
  }

  const sources = Array.from(sourceSet);
  const destinations = Array.from(destSet);
  const costs: number[][] = [];

  for (const s of sources) {
    const row: number[] = [];
    for (const d of destinations) {
      row.push(costMap[s]?.[d] ?? 15);
    }
    costs.push(row);
  }

  const supply = Array(sources.length).fill(15);
  const demand = Array(destinations.length).fill(Math.round((sources.length * 15) / destinations.length));

  return {
    sources,
    destinations,
    supply,
    demand,
    costs,
  };
}

export async function importCpmFromDb(tableName: string): Promise<CpmActivity[]> {
  const db = await getWebSqlite();
  const res = db.exec(`SELECT * FROM "${tableName}" LIMIT 200;`);
  if (res.length === 0 || res[0].values.length === 0) return [];

  const cols = res[0].columns.map((c) => c.toLowerCase());
  const idIdx = cols.findIndex((c) => c === "id" || c.includes("activity") || c.includes("code") || c.includes("task_id"));
  const nameIdx = cols.findIndex((c) => c.includes("name") || c.includes("desc") || c.includes("title"));
  const durIdx = cols.findIndex((c) => c.includes("duration") || c.includes("time") || c.includes("days") || c.includes("weeks"));
  const predIdx = cols.findIndex((c) => c.includes("pred") || c.includes("depends") || c.includes("prior"));

  const activities: CpmActivity[] = [];
  for (let i = 0; i < res[0].values.length; i++) {
    const row = res[0].values[i];
    const id = idIdx !== -1 ? String(row[idIdx]) : String.fromCharCode(65 + i);
    const name = nameIdx !== -1 ? String(row[nameIdx]) : `Activity ${id}`;
    const duration = durIdx !== -1 ? parseFloat(String(row[durIdx])) || 2 : 3;
    const predRaw = predIdx !== -1 && row[predIdx] ? String(row[predIdx]) : "";
    const predecessors = predRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    activities.push({
      id,
      name,
      duration,
      predecessors,
    });
  }

  return activities;
}
