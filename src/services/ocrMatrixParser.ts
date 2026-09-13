import { TransportationProblem, AssignmentProblem } from "./or/types";

/**
 * Robustly extracts a structured transportation cost matrix, supplies, and demands
 * from plain text, bullet points, key-value assignments, and Markdown tables.
 */
export function extractTransportationProblem(text: string): TransportationProblem | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("---") && !l.startsWith("==="));

  // -------------------------------------------------------------
  // Pattern 1: Section-based Supply, Demand, and Shipping Costs
  // (e.g. Meridian Manufacturing question format)
  // -------------------------------------------------------------
  const supplyMap = new Map<string, number>();
  const demandMap = new Map<string, number>();
  const costMap = new Map<string, Map<string, number>>();

  let currentSection: "supply" | "demand" | "cost" | "none" = "none";

  for (const line of lines) {
    if (/plant supply|supply\s*(?:\(units|available|capacity)?/i.test(line) && !line.includes("=")) {
      currentSection = "supply";
      continue;
    }
    if (/warehouse demand|demand\s*(?:\(units|required)?/i.test(line) && !line.includes("=")) {
      currentSection = "demand";
      continue;
    }
    if (/shipping cost|cost per unit|unit cost|cost matrix/i.test(line) && !line.includes("=")) {
      currentSection = "cost";
      continue;
    }
    if (/total\s+(?:supply|demand)/i.test(line)) {
      continue;
    }

    // Check for "Plant X: Warehouse 1 = 34, Warehouse 2 = 38..." in Cost section or inline
    if (currentSection === "cost" || (line.includes(":") && line.includes("="))) {
      const plantMatch = line.match(/(Plant\s+[A-Za-z0-9]+|[A-Za-z0-9\s_-]+)[:]\s*(.*)/i);
      if (plantMatch) {
        const plantName = plantMatch[1].trim();
        const rest = plantMatch[2];
        const pairRegex = /([A-Za-z0-9\s_-]+)\s*=\s*([0-9.]+)/g;
        let match;
        const rowCosts = new Map<string, number>();
        while ((match = pairRegex.exec(rest)) !== null) {
          const destName = match[1].trim();
          const costVal = parseFloat(match[2]);
          if (!isNaN(costVal)) {
            rowCosts.set(destName, costVal);
          }
        }
        if (rowCosts.size > 0) {
          costMap.set(plantName, rowCosts);
          continue;
        }
      }
    }

    // Check for "Plant A: 143" or "Warehouse 1: 75"
    const kvMatch = line.match(/^([A-Za-z0-9\s_-]+)[:=]\s*([0-9.]+)(?:\s*units)?$/i);
    if (kvMatch) {
      const name = kvMatch[1].trim();
      const val = parseFloat(kvMatch[2]);
      if (!isNaN(val)) {
        if (currentSection === "supply" || /^plant\b/i.test(name)) {
          supplyMap.set(name, val);
        } else if (currentSection === "demand" || /^warehouse\b|^market\b|^city\b|^dest\b/i.test(name)) {
          demandMap.set(name, val);
        }
      }
    }
  }

  if (costMap.size > 0) {
    const sources = Array.from(costMap.keys());
    // Get all destination names across rows
    const destSet = new Set<string>();
    for (const row of costMap.values()) {
      for (const d of row.keys()) {
        destSet.add(d);
      }
    }
    const destinations = Array.from(destSet);

    const costs: number[][] = sources.map((s) => {
      const row = costMap.get(s);
      return destinations.map((d) => (row ? row.get(d) ?? 10 : 10));
    });

    const supply: number[] = sources.map((s) => supplyMap.get(s) ?? 100);
    const demand: number[] = destinations.map((d) => demandMap.get(d) ?? 100);

    return {
      sources,
      destinations,
      costs,
      supply,
      demand,
    };
  }

  // -------------------------------------------------------------
  // Pattern 2: Markdown Pipe Tables
  // -------------------------------------------------------------
  const pipeLines = lines.filter((l) => l.includes("|") && !l.includes("---"));
  if (pipeLines.length >= 3) {
    const rawRows = pipeLines.map((row) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    );

    const headerRow = rawRows[0];
    const dataRows = rawRows.slice(1);

    const sources: string[] = [];
    const costs: number[][] = [];
    let supply: number[] = [];
    let demand: number[] = [];
    let destinations: string[] = [];

    const lastRow = dataRows[dataRows.length - 1];
    const isLastRowDemand = /demand/i.test(lastRow[0]);
    const activeDataRows = isLastRowDemand ? dataRows.slice(0, -1) : dataRows;

    if (isLastRowDemand) {
      demand = lastRow
        .slice(1)
        .map((v) => parseFloat(v.replace(/[^0-9.-]/g, "")))
        .filter((v) => !isNaN(v));
    }

    const hasSupplyCol = /supply/i.test(headerRow[headerRow.length - 1]);
    const destHeaders = headerRow.slice(1, hasSupplyCol ? -1 : undefined);
    destinations = destHeaders.filter((h) => h.length > 0);

    for (const r of activeDataRows) {
      if (r.length < 2) continue;
      const srcName = r[0];
      const numbersInRow = r
        .slice(1)
        .map((v) => parseFloat(v.replace(/[^0-9.-]/g, "")))
        .filter((v) => !isNaN(v));

      if (numbersInRow.length > 0) {
        sources.push(srcName);
        if (hasSupplyCol && numbersInRow.length > destinations.length) {
          supply.push(numbersInRow[numbersInRow.length - 1]);
          costs.push(numbersInRow.slice(0, destinations.length));
        } else {
          supply.push(numbersInRow[numbersInRow.length - 1] || 10);
          costs.push(numbersInRow.slice(0, -1));
        }
      }
    }

    if (sources.length > 0 && costs.length > 0 && costs[0].length > 0) {
      if (destinations.length !== costs[0].length) {
        destinations = Array.from({ length: costs[0].length }, (_, i) => `Market ${i + 1}`);
      }
      if (demand.length !== destinations.length) {
        demand = Array(destinations.length).fill(10);
      }
      if (supply.length !== sources.length) {
        supply = Array(sources.length).fill(10);
      }

      return { sources, destinations, costs, supply, demand };
    }
  }

  // -------------------------------------------------------------
  // Pattern 3: Key-Value matrix rows: e.g., "Plant 1: 10, 2, 20, 11 | Supply: 15"
  // -------------------------------------------------------------
  const matrixLines = lines.filter(
    (l) =>
      (l.includes("|") && /\d/.test(l)) ||
      (l.includes(":") && /\d/.test(l)) ||
      (/\b(plant|factory|source|s\d|warehouse|wh\d|f\d|p\d)\b/i.test(l) && /\d/.test(l))
  );

  const rowPattern = /([A-Za-z0-9\s_-]+)[:]\s*([0-9.,\s]+)(?:\|\s*Supply[:\s]*([0-9.]+))?/i;
  const parsedSources: string[] = [];
  const parsedCosts: number[][] = [];
  const parsedSupply: number[] = [];

  for (const line of matrixLines) {
    if (/demand/i.test(line)) continue;
    const match = line.match(rowPattern);
    if (match) {
      const name = match[1].trim();
      const rawNums = match[2]
        .split(/[,\s]+/)
        .map((n) => parseFloat(n))
        .filter((n) => !isNaN(n));
      const explicitSupply = match[3] ? parseFloat(match[3]) : null;

      if (rawNums.length >= 2) {
        parsedSources.push(name);
        if (explicitSupply !== null) {
          parsedSupply.push(explicitSupply);
          parsedCosts.push(rawNums);
        } else {
          parsedSupply.push(rawNums[rawNums.length - 1]);
          parsedCosts.push(rawNums.slice(0, -1));
        }
      }
    }
  }

  const demandLine = lines.find((l) => /demand/i.test(l));
  let parsedDemand: number[] = [];
  if (demandLine) {
    parsedDemand = demandLine
      .replace(/demand[:\s]*/i, "")
      .split(/[,\s|]+/)
      .map((n) => parseFloat(n.replace(/[^0-9.-]/g, "")))
      .filter((n) => !isNaN(n));
  }

  if (parsedSources.length > 0 && parsedCosts.length > 0) {
    const numCols = parsedCosts[0].length;
    const destinations = Array.from({ length: numCols }, (_, i) => `Market ${i + 1}`);
    if (parsedDemand.length !== numCols) {
      parsedDemand = Array(numCols).fill(15);
    }
    return {
      sources: parsedSources,
      destinations,
      costs: parsedCosts,
      supply: parsedSupply.length === parsedSources.length ? parsedSupply : Array(parsedSources.length).fill(20),
      demand: parsedDemand,
    };
  }

  return null;
}

/**
 * Extracts Hungarian Assignment matrix from text or Markdown table.
 */
export function extractAssignmentProblem(text: string): AssignmentProblem | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("---") && !l.startsWith("==="));

  const pipeLines = lines.filter((l) => l.includes("|"));
  if (pipeLines.length >= 2) {
    const rawRows = pipeLines.map((row) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    );

    const header = rawRows[0];
    const data = rawRows.slice(1);
    const jobs = header.slice(1).filter((j) => j.length > 0);
    const workers: string[] = [];
    const costs: number[][] = [];

    for (const r of data) {
      if (r.length < 2) continue;
      workers.push(r[0]);
      const nums = r
        .slice(1)
        .map((n) => parseFloat(n.replace(/[^0-9.-]/g, "")))
        .filter((n) => !isNaN(n));
      costs.push(nums);
    }

    if (workers.length > 0 && costs.length > 0 && costs[0].length > 0) {
      return {
        workers,
        jobs: jobs.length === costs[0].length ? jobs : Array.from({ length: costs[0].length }, (_, i) => `Job ${i + 1}`),
        costs,
      };
    }
  }

  return null;
}
