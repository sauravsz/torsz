import {
  LpProblem,
  CpmActivity,
  InventoryProblem,
  QueuingProblem,
  ZeroSumGameProblem,
} from "./or/types";

// ============================================================================
// 1. ADVANCED LINEAR PROGRAMMING (LP) & GOAL PROGRAMMING EXTRACTOR
// ============================================================================
export function extractLinearProgramming(text: string): LpProblem | null {
  // Normalize Greek symbols, superscripts, subscripts, and deviation variables
  const normalizedText = text
    .replace(/e_?\{?(\d+)\}?\s*\^\s*\+/gi, "e$1_pos")
    .replace(/e_?\{?(\d+)\}?\s*\^\s*\-/gi, "e$1_neg")
    .replace(/e(\d+)\s*\+/gi, "e$1_pos")
    .replace(/e(\d+)\s*\-/gi, "e$1_neg")
    .replace(/e_?(\d+)_pos/gi, "e$1_pos")
    .replace(/e_?(\d+)_neg/gi, "e$1_neg")
    .replace(/w_?\{?(\d+)\}?/gi, "w$1")
    .replace(/x_?\{?(\d+)\}?/gi, "x$1")
    .replace(/y_?\{?(\d+)\}?/gi, "y$1")
    .replace(/z_?\{?(\d+)\}?/gi, "z$1");

  const lines = normalizedText.split("\n").map((l) => l.trim()).filter(Boolean);

  let objective: "max" | "min" = "max";
  const objLine = lines.find((l) => /maximiz|minimiz|objective|obj\s*f|\bmax\b|\bmin\b/i.test(l));
  if (objLine && /min/i.test(objLine)) {
    objective = "min";
  }

  // 1. Discover all distinct decision variable names across all lines
  // Tokenize variable names: e.g. w1, w2, w3, e4_pos, e4_neg, x1, x2, etc.
  const varRegex = /\b([a-zA-Z][a-zA-Z0-9_]*)\b/g;
  const reservedKeywords = new Set([
    "max", "min", "maximize", "minimize", "objective", "subject", "to", "st", "constraints",
    "and", "for", "all", "where", "with", "sum", "each", "total", "fn", "z", "obj"
  ]);

  const varSet = new Set<string>();

  for (const line of lines) {
    if (/subject to|s\.t\.|constraints/i.test(line) && !/[<>=]/.test(line)) continue;
    let match;
    while ((match = varRegex.exec(line)) !== null) {
      const v = match[1];
      if (!reservedKeywords.has(v.toLowerCase()) && !/^\d+$/.test(v)) {
        varSet.add(v);
      }
    }
  }

  // If summation notation like sum_{t=4}^6 (e_t^+ + e_t^-) was used, ensure e4..e6 exist
  if (/sum.*e.*[4-6]/i.test(text) || lines.some(l => /e[4-6]/i.test(l))) {
    for (let t = 4; t <= 6; t++) {
      varSet.add(`e${t}_pos`);
      varSet.add(`e${t}_neg`);
    }
  }

  const varNames = Array.from(varSet).sort((a, b) => {
    // Custom sort: w1..w3 first, then e-vars, then alphabetical
    const isW_A = a.startsWith("w");
    const isW_B = b.startsWith("w");
    if (isW_A && !isW_B) return -1;
    if (!isW_A && isW_B) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  if (varNames.length === 0) {
    varNames.push("x1", "x2");
  }

  // Helper to extract linear expression terms for discovered variables
  const parseExpression = (expr: string): Map<string, number> => {
    const coeffMap = new Map<string, number>();
    for (const v of varNames) coeffMap.set(v, 0);

    // Matches term like "+ 331 w3", "- 241.5 w2", "e4_pos", "- e4_neg"
    // Handle both "331 w3" and "w3 331" formats
    const termRegex = /([+-]?\s*\d*\.?\d*)\s*([a-zA-Z][a-zA-Z0-9_]*)|([a-zA-Z][a-zA-Z0-9_]*)\s*([+-]?\s*\d+\.?\d*)/g;
    let match;
    while ((match = termRegex.exec(expr)) !== null) {
      if (match[2]) {
        // format: 331 w3 or + w3 or - w3
        let numStr = (match[1] || "").replace(/\s+/g, "");
        const varName = match[2];
        if (varNames.includes(varName)) {
          if (numStr === "" || numStr === "+") numStr = "1";
          if (numStr === "-") numStr = "-1";
          const val = parseFloat(numStr);
          if (!isNaN(val)) {
            coeffMap.set(varName, (coeffMap.get(varName) || 0) + val);
          }
        }
      } else if (match[3]) {
        // format: w3 331
        const varName = match[3];
        const numStr = (match[4] || "").replace(/\s+/g, "");
        if (varNames.includes(varName)) {
          const val = parseFloat(numStr);
          if (!isNaN(val)) {
            coeffMap.set(varName, (coeffMap.get(varName) || 0) + val);
          }
        }
      }
    }
    return coeffMap;
  };

  // 2. Parse Objective Function
  let objectiveCoefficients: number[] = Array(varNames.length).fill(0);
  if (objLine) {
    const expr = objLine.replace(/maximiz\w*|minimiz\w*|obj\w*|z\s*=|f\^n/gi, "");
    if (/sum/i.test(expr) && /e/i.test(expr)) {
      // Sum of all deviation variables
      objectiveCoefficients = varNames.map((v) => (v.startsWith("e") ? 1 : 0));
    } else {
      const objMap = parseExpression(expr);
      objectiveCoefficients = varNames.map((v) => objMap.get(v) || 0);
    }
  } else {
    // Default weights
    objectiveCoefficients = varNames.map((v) => (v.startsWith("e") ? 1 : 0));
  }

  // If all objective coefficients are 0, default to 1 on deviation variables or 1 on all
  if (objectiveCoefficients.every((c) => c === 0)) {
    objectiveCoefficients = varNames.map((v) => (v.startsWith("e") ? 1 : 1));
  }

  // 3. Parse Constraints
  const constraints: { coefficients: number[]; operator: "<=" | ">=" | "="; rhs: number }[] = [];

  for (const line of lines) {
    if (line === objLine) continue;
    if (/subject to|s\.t\.|constraints/i.test(line) && !/[<>=≤≥]/.test(line)) continue;
    if (/non-negativity|all\s*>=0|\ball\s*≥\s*0\b/i.test(line)) continue;

    // Handle compound inequality like "w3 >= w2 >= w1 >= 0"
    if (line.includes(">=") || line.includes("≥") || line.includes("<=") || line.includes("≤")) {
      const parts = line.split(/(>=|<=|≥|≤)/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 4) {
        // e.g. ["w3", ">=", "w2", ">=", "w1", ">=", "0"]
        for (let i = 0; i < parts.length - 2; i += 2) {
          const leftVar = parts[i];
          const op = parts[i + 1];
          const rightVar = parts[i + 2];
          if (rightVar === "0" || rightVar === "0.0") continue;

          const coeffs = Array(varNames.length).fill(0);
          const leftIdx = varNames.indexOf(leftVar);
          const rightIdx = varNames.indexOf(rightVar);

          if (leftIdx !== -1 && rightIdx !== -1) {
            if (op === ">=" || op === "≥") {
              // leftVar - rightVar >= 0
              coeffs[leftIdx] = 1;
              coeffs[rightIdx] = -1;
              constraints.push({ coefficients: coeffs, operator: ">=", rhs: 0 });
            } else {
              // leftVar - rightVar <= 0
              coeffs[leftIdx] = 1;
              coeffs[rightIdx] = -1;
              constraints.push({ coefficients: coeffs, operator: "<=", rhs: 0 });
            }
          }
        }
        continue;
      }
    }

    const opMatch = line.match(/(<=|>=|=|<|>|≤|≥)/);
    if (opMatch) {
      const rawOp = opMatch[1];
      const operator: "<=" | ">=" | "=" = rawOp.includes("<") || rawOp === "≤" ? "<=" : rawOp.includes(">") || rawOp === "≥" ? ">=" : "=";
      const parts = line.split(opMatch[0]);
      const leftExpr = parts[0];
      const rightExpr = parts[1];

      const leftMap = parseExpression(leftExpr);
      const rightMap = parseExpression(rightExpr);

      // Collect constants from both sides
      const rightConstMatch = rightExpr.match(/([+-]?\s*\d+\.?\d*)\s*$/);
      let rhs = rightConstMatch ? parseFloat(rightConstMatch[1].replace(/\s+/g, "")) : 0;
      if (isNaN(rhs)) rhs = 0;

      // Handle expressions like "e4_pos - e4_neg = 331w3 + 241w2 + 270w1 - 299"
      // Bring all variables to LHS: LHS_coeffs - RHS_coeffs
      const coeffs = varNames.map((v) => {
        return (leftMap.get(v) || 0) - (rightMap.get(v) || 0);
      });

      // If constant was on the left side, subtract it from RHS
      const leftConstMatch = leftExpr.match(/([+-]?\s*\d+\.?\d*)\s*$/);
      if (leftConstMatch && !leftExpr.includes(varNames.find(v => leftExpr.includes(v)) || "___")) {
        rhs -= parseFloat(leftConstMatch[1].replace(/\s+/g, ""));
      }

      // If all coeffs are on RHS and LHS had deviation variables, invert so constant is positive
      if (rhs < 0 && operator === "=") {
        for (let i = 0; i < coeffs.length; i++) coeffs[i] = -coeffs[i];
        rhs = -rhs;
      }

      if (coeffs.some((c) => c !== 0)) {
        constraints.push({ coefficients: coeffs, operator, rhs: Math.abs(rhs) });
      }
    }
  }

  if (constraints.length > 0) {
    return {
      objective,
      objectiveCoefficients,
      constraints,
      variableNames: varNames,
    };
  }

  return null;
}

// ============================================================================
// 2. PROJECT PLANNING (CPM / PERT) EXTRACTOR
// ============================================================================
export function extractCpmActivities(text: string): CpmActivity[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const activities: CpmActivity[] = [];

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
