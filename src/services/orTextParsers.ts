import {
  LpProblem,
  CpmActivity,
  InventoryProblem,
  QueuingProblem,
  ZeroSumGameProblem,
} from "./or/types";

// ============================================================================
// 1. LINEAR PROGRAMMING (LP) EXTRACTOR
// ============================================================================
export function extractLinearProgramming(text: string): LpProblem | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let objective: "max" | "min" = "max";
  let objectiveCoefficients: number[] = [3, 5];
  const constraints: { coefficients: number[]; operator: "<=" | ">=" | "="; rhs: number }[] = [];

  // Check objective
  const objLine = lines.find((l) => /maximiz|minimiz|objective|\bmax\b|\bmin\b/i.test(l));
  if (objLine) {
    if (/min/i.test(objLine)) objective = "min";
    // Extract coeffs: e.g. "Maximize Z = 3x1 + 5x2" or "3 x1 + 5 x2"
    const matches = Array.from(objLine.matchAll(/([+-]?\s*\d*\.?\d*)\s*(?:x_?\{?(\d+)\}?|x(\d+)|y|x)/gi));
    const coeffs: number[] = [];
    for (const m of matches) {
      let numStr = m[1].replace(/\s+/g, "");
      if (numStr === "" || numStr === "+") numStr = "1";
      if (numStr === "-") numStr = "-1";
      const val = parseFloat(numStr);
      if (!isNaN(val)) coeffs.push(val);
    }
    if (coeffs.length >= 2) {
      objectiveCoefficients = coeffs;
    }
  }

  // Check constraints: lines containing <=, >=, =, or "subject to"
  for (const line of lines) {
    if (/subject to|s\.t\.|constraints/i.test(line) && !/[<>=]/.test(line)) continue;
    if (line === objLine) continue;

    const opMatch = line.match(/(<=|>=|=|<|>|≤|≥)/);
    if (opMatch) {
      const rawOp = opMatch[1];
      const operator: "<=" | ">=" | "=" = rawOp.includes("<") || rawOp === "≤" ? "<=" : rawOp.includes(">") || rawOp === "≥" ? ">=" : "=";
      const parts = line.split(opMatch[0]);
      const left = parts[0];
      const right = parts[1];
      const rhs = parseFloat(right.replace(/[^0-9.-]/g, ""));

      // Extract left coefficients
      const matches = Array.from(left.matchAll(/([+-]?\s*\d*\.?\d*)\s*(?:x_?\{?(\d+)\}?|x(\d+)|y|x)/gi));
      const coeffs: number[] = [];
      for (const m of matches) {
        let numStr = m[1].replace(/\s+/g, "");
        if (numStr === "" || numStr === "+") numStr = "1";
        if (numStr === "-") numStr = "-1";
        const val = parseFloat(numStr);
        if (!isNaN(val)) coeffs.push(val);
      }

      if (coeffs.length > 0 && !isNaN(rhs)) {
        // Pad to match objective dimension
        while (coeffs.length < objectiveCoefficients.length) coeffs.push(0);
        constraints.push({ coefficients: coeffs.slice(0, objectiveCoefficients.length), operator, rhs });
      }
    }
  }

  if (constraints.length > 0) {
    return { objective, objectiveCoefficients, constraints };
  }
  return null;
}

// ============================================================================
// 2. PROJECT PLANNING (CPM / PERT) EXTRACTOR
// ============================================================================
export function extractCpmActivities(text: string): CpmActivity[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const activities: CpmActivity[] = [];

  // Look for Markdown table: | Activity | Predecessor | Duration |
  const pipeLines = lines.filter((l) => l.includes("|") && !l.includes("---"));
  if (pipeLines.length >= 2) {
    const dataRows = pipeLines.slice(1);
    for (const row of dataRows) {
      const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        const id = cols[0];
        const preds = cols.length >= 3 && cols[1] !== "-" && cols[1] !== "None" && cols[1] !== "" ? cols[1].split(/[,;\s]+/).filter(Boolean) : [];
        const dur = parseFloat(cols[cols.length - 1].replace(/[^0-9.]/g, ""));
        if (id && !isNaN(dur)) {
          activities.push({ id, name: id, predecessors: preds, duration: dur });
        }
      }
    }
    if (activities.length >= 2) return activities;
  }

  // Look for line-based: "A: None, 5" or "Activity A (Duration: 5, Predecessors: None)"
  for (const line of lines) {
    const match = line.match(/(?:Activity\s+)?([A-Za-z0-9_-]+)[:\s]+(?:predecessors?[:\s]*([A-Za-z0-9,\s_-]+|none|-))?.*?(?:duration[:\s]*(\d+\.?\d*)|(\d+\.?\d*)\s*(?:days|weeks|hours|units)?)/i);
    if (match) {
      const id = match[1].trim();
      const rawPreds = match[2] ? match[2].trim() : "";
      const preds = rawPreds && !/none|-/i.test(rawPreds) ? rawPreds.split(/[,;\s]+/).filter(Boolean) : [];
      const dur = parseFloat(match[3] || match[4] || "0");
      if (id && !isNaN(dur) && dur > 0) {
        activities.push({ id, name: id, predecessors: preds, duration: dur });
      }
    }
  }

  return activities.length >= 2 ? activities : null;
}

// ============================================================================
// 3. INVENTORY CONTROL (EOQ) EXTRACTOR
// ============================================================================
export function extractInventoryProblem(text: string): InventoryProblem | null {
  const demandMatch = text.match(/(?:annual\s+demand|demand\s*\(D\)|D\s*=)[:\s]*([0-9.,]+)/i);
  const orderCostMatch = text.match(/(?:ordering\s+cost|order\s+cost|setup\s+cost|cost\s+per\s+order|K\s*=)[:\s]*([0-9.,]+)/i);
  const holdCostMatch = text.match(/(?:holding\s+cost|carrying\s+cost|cost\s+per\s+unit\s+per\s+year|H\s*=)[:\s]*([0-9.,]+)/i);
  const unitPriceMatch = text.match(/(?:unit\s+price|purchase\s+price|cost\s+per\s+unit|C\s*=)[:\s]*([0-9.,]+)/i);
  const shortageCostMatch = text.match(/(?:shortage\s+cost|backorder\s+cost|penalty\s+cost|P\s*=)[:\s]*([0-9.,]+)/i);

  const annualDemandD = demandMatch ? parseFloat(demandMatch[1].replace(/,/g, "")) : undefined;
  const orderingCostK = orderCostMatch ? parseFloat(orderCostMatch[1].replace(/,/g, "")) : undefined;
  const holdingCostH = holdCostMatch ? parseFloat(holdCostMatch[1].replace(/,/g, "")) : undefined;
  const unitPriceC = unitPriceMatch ? parseFloat(unitPriceMatch[1].replace(/,/g, "")) : 50;
  const shortageCostP = shortageCostMatch ? parseFloat(shortageCostMatch[1].replace(/,/g, "")) : undefined;

  if (annualDemandD !== undefined && orderingCostK !== undefined) {
    return {
      model: shortageCostP ? "eoq-with-backorders" : "classic-eoq",
      annualDemandD,
      orderingCostK,
      holdingCostH: holdingCostH ?? 2,
      unitPriceC,
      shortageCostP,
    };
  }
  return null;
}

// ============================================================================
// 4. QUEUING ANALYSIS EXTRACTOR
// ============================================================================
export function extractQueuingProblem(text: string): QueuingProblem | null {
  const lambdaMatch = text.match(/(?:arrival\s+rate|arrivals\s+per|lambda|λ|\b\lambda\b)[:\s=]*([0-9.]+)/i);
  const muMatch = text.match(/(?:service\s+rate|services\s+per|mu|μ|\b\mu\b)[:\s=]*([0-9.]+)/i);
  const serversMatch = text.match(/(?:servers|channels|windows|c\s*=)[:\s]*([0-9]+)/i);
  const capacityMatch = text.match(/(?:system\s+capacity|buffer\s+size|K\s*=)[:\s]*([0-9]+)/i);

  const lambda = lambdaMatch ? parseFloat(lambdaMatch[1]) : undefined;
  const mu = muMatch ? parseFloat(muMatch[1]) : undefined;
  const c = serversMatch ? parseInt(serversMatch[1], 10) : 1;
  const K = capacityMatch ? parseInt(capacityMatch[1], 10) : undefined;

  if (lambda !== undefined && mu !== undefined) {
    return {
      model: c > 1 ? "M/M/c" : "M/M/1",
      arrivalRateLambda: lambda,
      serviceRateMu: mu,
      serversCountC: c,
      systemCapacityK: K,
    };
  }
  return null;
}

// ============================================================================
// 5. ZERO-SUM GAMES EXTRACTOR
// ============================================================================
export function extractZeroSumGame(text: string): ZeroSumGameProblem | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const pipeLines = lines.filter((l) => l.includes("|") && !l.includes("---"));

  if (pipeLines.length >= 2) {
    const header = pipeLines[0].split("|").map((c) => c.trim()).filter(Boolean);
    const data = pipeLines.slice(1);
    const p2Strategies = header.slice(1);
    const p1Strategies: string[] = [];
    const payoffMatrix: number[][] = [];

    for (const r of data) {
      const cols = r.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        p1Strategies.push(cols[0]);
        const nums = cols.slice(1).map((n) => parseFloat(n)).filter((n) => !isNaN(n));
        payoffMatrix.push(nums);
      }
    }

    if (p1Strategies.length >= 2 && payoffMatrix.length >= 2) {
      return { player1Strategies: p1Strategies, player2Strategies: p2Strategies, payoffMatrix };
    }
  }

  return null;
}

// ============================================================================
// 6. LINEAR EQUATIONS EXTRACTOR (Ax = b)
// ============================================================================
export function extractLinearEquations(text: string): { matrixA: number[][]; vectorB: number[] } | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const matrixA: number[][] = [];
  const vectorB: number[] = [];

  for (const line of lines) {
    const eqMatch = line.match(/(.*?)=(.*)/);
    if (eqMatch) {
      const left = eqMatch[1];
      const right = eqMatch[2];
      const rhs = parseFloat(right.replace(/[^0-9.-]/g, ""));

      const matches = Array.from(left.matchAll(/([+-]?\s*\d*\.?\d*)\s*(?:x_?\{?(\d+)\}?|x(\d+)|y|z|w|[a-z])/gi));
      const coeffs: number[] = [];
      for (const m of matches) {
        let numStr = m[1].replace(/\s+/g, "");
        if (numStr === "" || numStr === "+") numStr = "1";
        if (numStr === "-") numStr = "-1";
        const val = parseFloat(numStr);
        if (!isNaN(val)) coeffs.push(val);
      }

      if (coeffs.length > 0 && !isNaN(rhs)) {
        matrixA.push(coeffs);
        vectorB.push(rhs);
      }
    }
  }

  if (matrixA.length >= 2 && vectorB.length >= 2) {
    const maxCols = Math.max(...matrixA.map((r) => r.length));
    const paddedA = matrixA.map((r) => {
      while (r.length < maxCols) r.push(0);
      return r;
    });
    return { matrixA: paddedA, vectorB };
  }

  return null;
}
