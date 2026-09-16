import {
  LpProblem,
  CpmActivity,
  InventoryProblem,
  QueuingProblem,
  ZeroSumGameProblem,
} from "./or/types";

// ============================================================================
// 1. ADVANCED UNIVERSAL LINEAR PROGRAMMING (LP) & GOAL PROGRAMMING EXTRACTOR
// ============================================================================
export function extractLinearProgramming(text: string): LpProblem | null {
  if (!text || text.trim().length === 0) return null;

  // --------------------------------------------------------------------------
  // Tier 1: Check for Tabular LP (e.g. Markdown resource-product matrices)
  // --------------------------------------------------------------------------
  const tabularLp = extractTabularLp(text);
  if (tabularLp) return tabularLp;

  // --------------------------------------------------------------------------
  // Tier 2: Check for Narrative NLP Word Problems (e.g. Flair Furniture, Reddy Mikks, Wyndor Glass)
  // --------------------------------------------------------------------------
  const narrativeLp = extractNarrativeLp(text);
  if (narrativeLp) return narrativeLp;

  // --------------------------------------------------------------------------
  // Tier 3: Standard Algebraic & Mathematical LP Parser
  // --------------------------------------------------------------------------
  return extractAlgebraicLp(text);
}

function extractTabularLp(text: string): LpProblem | null {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.includes("|") && !l.includes("---"));
  if (lines.length < 3) return null;

  const header = lines[0].split("|").map((c) => c.trim()).filter(Boolean);
  if (header.length < 3) return null;

  const lastHeader = header[header.length - 1].toLowerCase();
  const isLastColCapacity = /capacity|availab|limit|max|rhs|hours|units|budget/i.test(lastHeader);
  if (!isLastColCapacity) return null;

  const productNames = header.slice(1, header.length - 1);
  if (productNames.length < 1) return null;

  let objective: "max" | "min" = "max";
  let objectiveCoefficients: number[] = Array(productNames.length).fill(0);
  let foundObj = false;

  const constraints: { coefficients: number[]; operator: "<=" | ">=" | "="; rhs: number }[] = [];

  for (let r = 1; r < lines.length; r++) {
    const rawTokens = lines[r].split("|").map((c) => c.trim());
    // remove leading and trailing empty entries from table borders
    if (rawTokens[0] === "") rawTokens.shift();
    if (rawTokens[rawTokens.length - 1] === "") rawTokens.pop();

    if (rawTokens.length < productNames.length + 1) continue;

    const rowName = rawTokens[0].toLowerCase();
    const isProfitOrCostRow = /profit|contribution|revenue|price|selling|cost|margin/i.test(rowName);

    if (isProfitOrCostRow) {
      if (/cost|min/i.test(rowName)) objective = "min";
      for (let p = 0; p < productNames.length; p++) {
        const val = parseFloat((rawTokens[p + 1] || "").replace(/[^0-9.-]/g, ""));
        if (!isNaN(val)) objectiveCoefficients[p] = val;
      }
      foundObj = true;
    } else {
      const coeffs: number[] = [];
      for (let p = 0; p < productNames.length; p++) {
        const val = parseFloat((rawTokens[p + 1] || "").replace(/[^0-9.-]/g, ""));
        coeffs.push(isNaN(val) ? 0 : val);
      }
      const rhsVal = parseFloat((rawTokens[rawTokens.length - 1] || "").replace(/[^0-9.-]/g, ""));
      if (!isNaN(rhsVal) && coeffs.some((c) => c !== 0)) {
        let op: "<=" | ">=" | "=" = "<=";
        if (/min|at least|greater/i.test(rowName)) op = ">=";
        else if (/equal|exact/i.test(rowName)) op = "=";
        constraints.push({ coefficients: coeffs, operator: op, rhs: rhsVal });
      }
    }
  }

  if (constraints.length > 0) {
    if (!foundObj || objectiveCoefficients.every((c) => c === 0)) {
      objectiveCoefficients = Array(productNames.length).fill(1);
    }
    return {
      objective,
      objectiveCoefficients,
      constraints,
      variableNames: productNames,
    };
  }

  return null;
}

function extractNarrativeLp(text: string): LpProblem | null {
  const lower = text.toLowerCase();

  // 1. Identify Products / Decision Variables
  let productNames: string[] = [];
  const prodMatch = text.match(/(?:products?|items?|goods?|types?|models?|makes?|produces?|manufactures?)\s*(?:such as|including|namely|:)?\s*([A-Za-z0-9\s,_-]+?)(?:\.|\n|;|which|each)/i);
  if (prodMatch && prodMatch[1]) {
    const listStr = prodMatch[1].replace(/^(?:two|three|four|2|3|4)\s*/i, "");
    productNames = listStr.split(/,|and|\/|&/).map((s) => s.trim()).filter((s) => s.length > 1 && !/^(the|a|an|two|three)$/i.test(s));
  }
  if (productNames.length < 2) {
    if (lower.includes("table") && lower.includes("chair")) productNames = ["Tables", "Chairs"];
    else if (lower.includes("door") && lower.includes("window")) productNames = ["Doors", "Windows"];
    else if (lower.includes("exterior") && lower.includes("interior")) productNames = ["Exterior Paint", "Interior Paint"];
    else if (lower.includes("product 1") && lower.includes("product 2")) productNames = ["Product 1", "Product 2"];
    else if (lower.includes("product a") && lower.includes("product b")) productNames = ["Product A", "Product B"];
  }

  const numVars = productNames.length;
  if (numVars < 2) return null;

  // 2. Identify Profit / Cost for each product
  let objective: "max" | "min" = /minimiz|minimize|min\b|cost/i.test(text) ? "min" : "max";
  const objCoeffs: number[] = Array(numVars).fill(0);

  for (let i = 0; i < numVars; i++) {
    const pSing = productNames[i].replace(/s$/i, "");
    const m1 = text.match(new RegExp(`(?:profit|cost|revenue|price|earns?|sells?)[^.\\n]*?${pSing}[^.\\n]*?\\$\\s*([0-9.]+)`, "i"));
    const m2 = text.match(new RegExp(`\\$\\s*([0-9.]+)[^.\\n]*?(?:per|for|each)?\\s*${pSing}`, "i"));
    const m3 = text.match(new RegExp(`${pSing}[^.\\n]*?\\$\\s*([0-9.]+)`, "i"));
    const val = parseFloat(m1?.[1] || m2?.[1] || m3?.[1] || "0");
    if (!isNaN(val) && val > 0) objCoeffs[i] = val;
  }

  // 3. Identify Resources & Capacities
  const resourceNames: string[] = [];
  const resMatches = text.matchAll(/(?:hours?|hrs?|units?|lbs?|kg|tons?)\s+of\s+([A-Za-z0-9_-]+)|([A-Za-z0-9_-]+)\s+(?:hours?|hrs?|units?|lbs?|capacity|available)/gi);
  for (const rm of resMatches) {
    const r = (rm[1] || rm[2]).toLowerCase();
    if (!["the", "and", "total", "a", "an", "is", "each", "per", "available", "capacity", "hours", "units"].includes(r)) {
      if (!resourceNames.includes(r)) resourceNames.push(r);
    }
  }

  const resCaps: Record<string, number> = {};
  const clauses = text.split(/[.;\n]+|, and\s+|, but\s+|, while\s+/).map((s) => s.trim()).filter(Boolean);
  for (const c of clauses) {
    for (const r of resourceNames) {
      if (c.toLowerCase().includes(r)) {
        const capMatch = c.match(/(?:available|capacity|limit|maximum|total)[^0-9]*([0-9.,]+)/i) ||
          c.match(/([0-9.,]+)\s*(?:hours?|hrs?|units?|lbs?|kg|tons?)\s*(?:available|capacity|limit|at most|maximum)/i);
        if (capMatch) {
          const cap = parseFloat(capMatch[1].replace(/,/g, ""));
          if (!isNaN(cap) && cap > 0) resCaps[r] = cap;
        }
      }
    }
  }

  const constraints: { coefficients: number[]; operator: "<=" | ">=" | "="; rhs: number }[] = [];
  for (const [res, cap] of Object.entries(resCaps)) {
    const coeffs = Array(numVars).fill(0);
    for (let i = 0; i < numVars; i++) {
      const pSing = productNames[i].replace(/s$/i, "");
      const cm1 = text.match(new RegExp(`${pSing}[^.\\n,;]*?([0-9.]+)\\s*(?:hours?|hrs?|units?|lbs?|kg|tons?)?\\s*(?:of\\s+)?${res}`, "i"));
      const cm2 = text.match(new RegExp(`([0-9.]+)\\s*(?:hours?|hrs?|units?|lbs?|kg|tons?)?\\s*(?:of\\s+)?${res}[^.\\n,;]*?${pSing}`, "i"));
      const val = parseFloat(cm1?.[1] || cm2?.[1] || "0");
      if (!isNaN(val)) coeffs[i] = val;
    }
    if (coeffs.some((c) => c > 0)) {
      constraints.push({ coefficients: coeffs, operator: "<=", rhs: cap });
    }
  }

  if (constraints.length > 0) {
    return {
      objective,
      objectiveCoefficients: objCoeffs.every((c) => c === 0) ? Array(numVars).fill(1) : objCoeffs,
      constraints,
      variableNames: productNames,
    };
  }

  return null;
}

function extractAlgebraicLp(text: string): LpProblem | null {
  const normalizedText = text
    .replace(/\s*(?:subject to|s\.t\.|constraints:?)\s*/gi, "\n")
    .replace(/\s+and\s+(?=[a-z0-9_+-]+.*?[<>=])/gi, "\n")
    .replace(/\\le|\\leq/gi, "<=")
    .replace(/\\ge|\\geq/gi, ">=")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/e_?\{?(\d+)\}?\s*\^\s*\+/gi, "e$1_pos")
    .replace(/e_?\{?(\d+)\}?\s*\^\s*\-/gi, "e$1_neg")
    .replace(/d_?\{?(\d+)\}?\s*\^\s*\+/gi, "e$1_pos")
    .replace(/d_?\{?(\d+)\}?\s*\^\s*\-/gi, "e$1_neg")
    .replace(/e(\d+)\s*\+/gi, "e$1_pos")
    .replace(/e(\d+)\s*\-/gi, "e$1_neg")
    .replace(/d(\d+)\s*\+/gi, "e$1_pos")
    .replace(/d(\d+)\s*\-/gi, "e$1_neg")
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

  const varRegex = /\b([a-zA-Z][a-zA-Z0-9_]*)\b/g;
  const reservedKeywords = new Set([
    "max", "min", "maximize", "minimize", "objective", "subject", "to", "st", "constraints",
    "and", "for", "all", "where", "with", "sum", "each", "total", "fn", "z", "obj", "let"
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

  if (/sum.*e.*[4-6]/i.test(text) || lines.some((l) => /e[4-6]/i.test(l))) {
    for (let t = 4; t <= 6; t++) {
      varSet.add(`e${t}_pos`);
      varSet.add(`e${t}_neg`);
    }
  }

  const varNames = Array.from(varSet).sort((a, b) => {
    const isW_A = a.startsWith("w");
    const isW_B = b.startsWith("w");
    if (isW_A && !isW_B) return -1;
    if (!isW_A && isW_B) return 1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  if (varNames.length === 0) {
    varNames.push("x1", "x2");
  }

  const parseExpression = (expr: string): Map<string, number> => {
    const coeffMap = new Map<string, number>();
    for (const v of varNames) coeffMap.set(v, 0);

    const termRegex = /([+-]?\s*\d*\.?\d*)\s*([a-zA-Z][a-zA-Z0-9_]*)|([a-zA-Z][a-zA-Z0-9_]*)\s*([+-]?\s*\d+\.?\d*)/g;
    let match;
    while ((match = termRegex.exec(expr)) !== null) {
      if (match[2]) {
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

  let objectiveCoefficients: number[] = Array(varNames.length).fill(0);
  if (objLine) {
    const expr = objLine.replace(/maximiz\w*|minimiz\w*|obj\w*|z\s*=|f\^n/gi, "");
    if (/sum/i.test(expr) && /e/i.test(expr)) {
      objectiveCoefficients = varNames.map((v) => (v.startsWith("e") ? 1 : 0));
    } else {
      const objMap = parseExpression(expr);
      objectiveCoefficients = varNames.map((v) => objMap.get(v) || 0);
    }
  } else {
    objectiveCoefficients = varNames.map((v) => (v.startsWith("e") ? 1 : 1));
  }

  if (objectiveCoefficients.every((c) => c === 0)) {
    objectiveCoefficients = varNames.map((v) => (v.startsWith("e") ? 1 : 1));
  }

  const constraints: { coefficients: number[]; operator: "<=" | ">=" | "="; rhs: number }[] = [];

  for (const line of lines) {
    if (line === objLine) continue;
    if (/subject to|s\.t\.|constraints/i.test(line) && !/[<>=]/.test(line)) continue;
    if (/non-negativity|all\s*>=0|\ball\s*≥\s*0\b/i.test(line)) continue;
    if (line.includes(",") && (line.includes(">= 0") || line.includes(">=0"))) continue;

    if (line.includes(">=") || line.includes("<=")) {
      const parts = line.split(/(>=|<=)/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 4) {
        for (let i = 0; i < parts.length - 2; i += 2) {
          const leftVar = parts[i];
          const op = parts[i + 1];
          const rightVar = parts[i + 2];
          if (rightVar === "0" || rightVar === "0.0") continue;

          const coeffs = Array(varNames.length).fill(0);
          const leftIdx = varNames.indexOf(leftVar);
          const rightIdx = varNames.indexOf(rightVar);

          if (leftIdx !== -1 && rightIdx !== -1) {
            if (op === ">=") {
              coeffs[leftIdx] = 1;
              coeffs[rightIdx] = -1;
              constraints.push({ coefficients: coeffs, operator: ">=", rhs: 0 });
            } else {
              coeffs[leftIdx] = 1;
              coeffs[rightIdx] = -1;
              constraints.push({ coefficients: coeffs, operator: "<=", rhs: 0 });
            }
          }
        }
        continue;
      }
    }

    const opMatch = line.match(/(<=|>=|=|<|>)/);
    if (opMatch) {
      const rawOp = opMatch[1];
      const operator: "<=" | ">=" | "=" = rawOp.includes("<") ? "<=" : rawOp.includes(">") ? ">=" : "=";
      const parts = line.split(opMatch[0]);
      const leftExpr = parts[0];
      const rightExpr = parts[1];

      const leftMap = parseExpression(leftExpr);
      const rightMap = parseExpression(rightExpr);

      const rightConstMatch = rightExpr.match(/([+-]?\s*\d+\.?\d*)\s*$/);
      let rhs = rightConstMatch ? parseFloat(rightConstMatch[1].replace(/\s+/g, "")) : 0;
      if (isNaN(rhs)) rhs = 0;

      const coeffs = varNames.map((v) => {
        return (leftMap.get(v) || 0) - (rightMap.get(v) || 0);
      });

      const leftConstMatch = leftExpr.match(/([+-]?\s*\d+\.?\d*)\s*$/);
      if (leftConstMatch && !leftExpr.includes(varNames.find((v) => leftExpr.includes(v)) || "___")) {
        rhs -= parseFloat(leftConstMatch[1].replace(/\s+/g, ""));
      }

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
// 2. PROJECT PLANNING (CPM / PERT / CRASHING) EXTRACTOR
// ============================================================================
export function extractCpmActivities(text: string): CpmActivity[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const activities: CpmActivity[] = [];

  const pipeLines = lines.filter((l) => l.includes("|") && !l.includes("---"));
  if (pipeLines.length >= 2) {
    const header = pipeLines[0].split("|").map((c) => c.trim().toLowerCase()).filter(Boolean);
    const hasPert3Time = header.some((h) => h.includes("optimistic") || h === "a") &&
      header.some((h) => h.includes("pessimistic") || h === "b");
    const hasCrashing = header.some((h) => h.includes("crash"));

    const dataRows = pipeLines.slice(1);
    for (const row of dataRows) {
      const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        const id = cols[0];
        const rawPreds = cols[1];
        const preds = rawPreds && !/none|-|\bnull\b/i.test(rawPreds)
          ? rawPreds.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
          : [];

        if (hasPert3Time && cols.length >= 5) {
          const a = parseFloat(cols[2].replace(/[^0-9.]/g, ""));
          const m = parseFloat(cols[3].replace(/[^0-9.]/g, ""));
          const b = parseFloat(cols[4].replace(/[^0-9.]/g, ""));
          const te = (a + 4 * m + b) / 6;
          if (id && !isNaN(te)) {
            activities.push({
              id,
              name: id,
              predecessors: preds,
              duration: Math.round(te * 100) / 100,
              optimisticA: a,
              mostLikelyM: m,
              pessimisticB: b,
            });
          }
        } else if (hasCrashing && cols.length >= 5) {
          const normalT = parseFloat(cols[2].replace(/[^0-9.]/g, ""));
          const crashT = parseFloat(cols[3].replace(/[^0-9.]/g, ""));
          const normalC = parseFloat(cols[4].replace(/[^0-9.]/g, ""));
          const crashC = cols.length >= 6 ? parseFloat(cols[5].replace(/[^0-9.]/g, "")) : undefined;
          if (id && !isNaN(normalT)) {
            activities.push({
              id,
              name: id,
              predecessors: preds,
              duration: normalT,
              normalTime: normalT,
              crashTime: crashT,
              normalCost: normalC,
              crashCost: crashC,
            });
          }
        } else {
          const dur = parseFloat(cols[cols.length - 1].replace(/[^0-9.]/g, ""));
          if (id && !isNaN(dur)) {
            activities.push({ id, name: id, predecessors: preds, duration: dur });
          }
        }
      }
    }
    if (activities.length >= 2) return activities;
  }

  for (const line of lines) {
    const match = line.match(/(?:Activity\s+|Task\s+)?([A-Za-z0-9_-]+)[:\s]+(?:predecessors?[:\s]*([A-Za-z0-9,\s_-]+|none|-))?.*?(?:duration[:\s]*(\d+\.?\d*)|(\d+\.?\d*)\s*(?:days|weeks|months|hours|units)?)/i);
    if (match) {
      const id = match[1].trim();
      const rawPreds = match[2] ? match[2].trim() : "";
      const preds = rawPreds && !/none|-/i.test(rawPreds) ? rawPreds.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean) : [];
      const dur = parseFloat(match[3] || match[4] || "0");
      if (id && !isNaN(dur) && dur > 0) {
        activities.push({ id, name: id, predecessors: preds, duration: dur });
      }
    }
  }

  return activities.length >= 2 ? activities : null;
}

// ============================================================================
// 3. INVENTORY CONTROL EXTRACTOR
// ============================================================================
export function extractInventoryProblem(text: string): InventoryProblem | null {
  const demandMatch = text.match(/(?:annual\s+demand|demand\s*\(D\)|D\s*=|\bdemand\b)(?:\s+is|\s*:|\s*=|\s+of)?\s*\$?([0-9.,]+)/i);
  const orderCostMatch = text.match(/(?:ordering\s+cost|order\s+cost|setup\s+cost|cost\s+per\s+order|S\s*=|K\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*\$?([0-9.,]+)/i);
  const holdCostMatch = text.match(/(?:holding\s+cost|carrying\s+cost|cost\s+per\s+unit\s+per\s+year|H\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*\$?([0-9.,]+)/i);
  const unitPriceMatch = text.match(/(?:unit\s+price|purchase\s+price|cost\s+per\s+unit|item\s+cost|unit\s+cost|C\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*\$?([0-9.,]+)/i);
  const shortageCostMatch = text.match(/(?:shortage\s+cost|backorder\s+cost|penalty\s+cost|P\s*=|p\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*\$?([0-9.,]+)/i);
  const prodRateMatch = text.match(/(?:production\s+rate|daily\s+production|rate\s+of\s+production|P\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*([0-9.,]+)/i);

  const annualDemandD = demandMatch ? parseFloat(demandMatch[1].replace(/,/g, "")) : undefined;
  const orderingCostK = orderCostMatch ? parseFloat(orderCostMatch[1].replace(/,/g, "")) : undefined;
  const holdingCostH = holdCostMatch ? parseFloat(holdCostMatch[1].replace(/,/g, "")) : undefined;
  const unitPriceC = unitPriceMatch ? parseFloat(unitPriceMatch[1].replace(/,/g, "")) : 10;
  const shortageCostP = shortageCostMatch ? parseFloat(shortageCostMatch[1].replace(/,/g, "")) : undefined;
  const productionRateP = prodRateMatch ? parseFloat(prodRateMatch[1].replace(/,/g, "")) : undefined;

  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.includes("|") && !l.includes("---"));
  if (lines.length >= 3 && annualDemandD !== undefined && orderingCostK !== undefined) {
    const tiers: { tierIndex: number; minQty: number; maxQty?: number; unitPrice: number }[] = [];
    const dataRows = lines.slice(1);
    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i].split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 2) {
        const qtyStr = cols[0];
        const priceStr = cols[cols.length - 1].replace(/[^0-9.]/g, "");
        const price = parseFloat(priceStr);
        const qtyMatch = qtyStr.match(/(\d+)\s*(?:to|-)?\s*(\d+)?/i);
        if (qtyMatch && !isNaN(price)) {
          const minQ = parseInt(qtyMatch[1], 10);
          const maxQ = qtyMatch[2] ? parseInt(qtyMatch[2], 10) : undefined;
          tiers.push({ tierIndex: i + 1, minQty: minQ, maxQty: maxQ, unitPrice: price });
        }
      }
    }
    if (tiers.length >= 2) {
      return {
        model: "quantity-discounts",
        annualDemandD,
        orderingCostK,
        holdingCostH: holdingCostH ?? 2,
        unitPriceC: tiers[0].unitPrice,
        priceBreaks: tiers,
      };
    }
  }

  if (annualDemandD !== undefined && orderingCostK !== undefined) {
    let model: InventoryProblem["model"] = "classic-eoq";
    if (productionRateP) model = "epq-production";
    else if (shortageCostP) model = "eoq-with-backorders";

    return {
      model,
      annualDemandD,
      orderingCostK,
      holdingCostH: holdingCostH ?? 2,
      unitPriceC,
      shortageCostP,
      productionRateP,
    };
  }

  return null;
}

// ============================================================================
// 4. QUEUING ANALYSIS EXTRACTOR
// ============================================================================
export function extractQueuingProblem(text: string): QueuingProblem | null {
  const lambdaMatch = text.match(/(?:arrival\s+rate|arrivals\s+per|arrive\s+at\s+a\s+rate\s+of|rate\s+of\s+arrivals?|lambda|λ|\b\lambda\b)(?:\s+is|\s*:|\s*=|\s+of)?\s*([0-9.]+)/i);
  const muMatch = text.match(/(?:service\s+rate|services\s+per|rate\s+of\s+service|mu|μ|\b\mu\b)(?:\s+is|\s*:|\s*=|\s+of)?\s*([0-9.]+)/i);
  const serversMatch = text.match(/(?:servers|channels|windows|c\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*([0-9]+)/i);
  const capacityMatch = text.match(/(?:system\s+capacity|buffer\s+size|room\s+for|capacity\s+of|K\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*([0-9]+)/i);
  const serverCostMatch = text.match(/(?:server\s+cost|cost\s+per\s+server|Cs\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*\$?([0-9.]+)/i);
  const waitCostMatch = text.match(/(?:waiting\s+cost|cost\s+of\s+waiting|Cw\s*=)(?:\s+is|\s*:|\s*=|\s+of)?\s*\$?([0-9.]+)/i);

  let lambda = lambdaMatch ? parseFloat(lambdaMatch[1]) : undefined;
  let mu = muMatch ? parseFloat(muMatch[1]) : undefined;

  if (!lambda) {
    const arrTimeMatch = text.match(/(?:arrive\s+every|arrival\s+time\s+of|interarrival\s+time\s+of)\s*([0-9.]+)\s*(?:minutes|mins)/i);
    if (arrTimeMatch) {
      const mins = parseFloat(arrTimeMatch[1]);
      if (mins > 0) lambda = 60 / mins;
    }
  }

  if (!mu) {
    const servTimeMatch = text.match(/(?:service\s+time[^0-9]*|takes\s+an\s+average\s+of[^0-9]*|served\s+in[^0-9]*)\s*([0-9.]+)\s*(?:minutes|mins)/i);
    if (servTimeMatch) {
      const mins = parseFloat(servTimeMatch[1]);
      if (mins > 0) mu = 60 / mins;
    }
  }

  const c = serversMatch ? parseInt(serversMatch[1], 10) : 1;
  const K = capacityMatch ? parseInt(capacityMatch[1], 10) : undefined;
  const serverCostPerHourCs = serverCostMatch ? parseFloat(serverCostMatch[1]) : undefined;
  const waitingCostPerHourCw = waitCostMatch ? parseFloat(waitCostMatch[1]) : undefined;

  if (lambda !== undefined && mu !== undefined) {
    return {
      model: c > 1 ? "M/M/c" : "M/M/1",
      arrivalRateLambda: lambda,
      serviceRateMu: mu,
      serversCountC: c,
      systemCapacityK: K,
      serverCostPerHourCs,
      waitingCostPerHourCw,
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
        const nums = cols.slice(1).map((n) => parseFloat(n.replace(/[^0-9.-]/g, ""))).filter((n) => !isNaN(n));
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
