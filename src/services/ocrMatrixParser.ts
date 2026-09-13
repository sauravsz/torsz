import { TransportationProblem, AssignmentProblem } from "./or/types";

/**
 * Extracts a structured transportation cost matrix, supplies, and demands from plain text or Markdown tables.
 */
export function extractTransportationProblem(text: string): TransportationProblem | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("---") && !l.startsWith("==="));

  // Find candidate matrix lines (lines with numbers, pipes, or colons)
  const matrixLines = lines.filter(
    (l) =>
      (l.includes("|") && /\d/.test(l)) ||
      (l.includes(":") && /\d/.test(l)) ||
      (/\b(plant|factory|source|s\d|warehouse|wh\d|f\d|p\d)\b/i.test(l) && /\d/.test(l))
  );

  // Parse pipe-separated Markdown table
  const pipeLines = lines.filter((l) => l.includes("|") && !l.includes("---"));
  if (pipeLines.length >= 3) {
    const rawRows = pipeLines.map((row) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    );

    // Look for header with destinations
    const headerRow = rawRows[0];
    const dataRows = rawRows.slice(1);

    const sources: string[] = [];
    const costs: number[][] = [];
    let supply: number[] = [];
    let demand: number[] = [];
    let destinations: string[] = [];
    // Check if last row is Demand
    const lastRow = dataRows[dataRows.length - 1];
    const isLastRowDemand = /demand/i.test(lastRow[0]);

    const activeDataRows = isLastRowDemand ? dataRows.slice(0, -1) : dataRows;

    if (isLastRowDemand) {
      demand = lastRow
        .slice(1)
        .map((v) => parseFloat(v.replace(/[^0-9.-]/g, "")))
        .filter((v) => !isNaN(v));
    }

    // Determine destinations from headerRow (excluding first label and possible 'Supply' column)
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
      // Ensure dimensions match
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

  // Regex patterns for key-value text lines: e.g., "Plant 1: 10, 2, 20, 11 | Supply: 15"
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
          // Last number might be supply
          parsedSupply.push(rawNums[rawNums.length - 1]);
          parsedCosts.push(rawNums.slice(0, -1));
        }
      }
    }
  }

  // Check for Demand line
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
