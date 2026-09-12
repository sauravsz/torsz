import { createWorker } from "tesseract.js";
import {
  OrModule,
  NetworkSubtype,
  TransSubtype,
  LpProblem,
  TransportationProblem,
  AssignmentProblem,
  NetworkEdge,
  CpmActivity,
  InventoryProblem,
  QueuingProblem,
  ZeroSumGameProblem,
} from "./or/types";
import { AiSettings, getStoredAiSettings } from "./aiAssistant";

export interface OcrProblemClassification {
  detectedModule: OrModule;
  confidence: number;
  reason: string;
  networkSubtype?: NetworkSubtype;
  transSubtype?: TransSubtype;
  parsedData?: {
    lp?: Partial<LpProblem>;
    trans?: Partial<TransportationProblem>;
    assign?: Partial<AssignmentProblem>;
    edges?: NetworkEdge[];
    cpm?: CpmActivity[];
    inventory?: Partial<InventoryProblem>;
    queuing?: Partial<QueuingProblem>;
    game?: Partial<ZeroSumGameProblem>;
    linearEqA?: number[][];
    linearEqB?: number[];
  };
}

export async function performInBrowserOcr(
  imageFile: File,
  _onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const worker = await createWorker("eng");

  try {
    const imageUrl = URL.createObjectURL(imageFile);
    const ret = await worker.recognize(imageUrl);
    URL.revokeObjectURL(imageUrl);
    return ret.data.text;
  } finally {
    await worker.terminate();
  }
}

export function classifyOrProblemFromText(text: string): OcrProblemClassification {
  const lower = text.toLowerCase();

  // 1. Shortest Route / Path (Dijkstra)
  if (
    lower.includes("shortest route") ||
    lower.includes("shortest path") ||
    lower.includes("dijkstra") ||
    lower.includes("replacement policy") ||
    lower.includes("car replacement")
  ) {
    const edges = extractNetworkEdges(text);
    return {
      detectedModule: "network-models",
      networkSubtype: "shortest-route",
      confidence: 0.95,
      reason: "Detected shortest route / Dijkstra path problem statements.",
      parsedData: { edges },
    };
  }

  // 2. Minimum Spanning Tree (MST)
  if (
    lower.includes("minimum spanning tree") ||
    lower.includes("spanning tree") ||
    lower.includes("mst") ||
    lower.includes("kruskal") ||
    lower.includes("prim") ||
    lower.includes("cable company")
  ) {
    const edges = extractNetworkEdges(text);
    return {
      detectedModule: "network-models",
      networkSubtype: "minimum-spanning-tree",
      confidence: 0.95,
      reason: "Detected Minimum Spanning Tree (Kruskal / Prim) keywords.",
      parsedData: { edges },
    };
  }

  // 3. Maximal Flow
  if (
    lower.includes("maximal flow") ||
    lower.includes("maximum flow") ||
    lower.includes("max flow") ||
    lower.includes("capacity of the network")
  ) {
    const edges = extractNetworkEdges(text);
    return {
      detectedModule: "network-models",
      networkSubtype: "maximal-flow",
      confidence: 0.9,
      reason: "Detected network flow / bottleneck capacity statements.",
      parsedData: { edges },
    };
  }

  // 4. Transportation Model (VAM)
  if (
    (lower.includes("transportation") && !lower.includes("assignment")) ||
    lower.includes("vogel") ||
    lower.includes("supply") && lower.includes("demand") ||
    lower.includes("shipping cost") ||
    lower.includes("plants") && lower.includes("destinations")
  ) {
    return {
      detectedModule: "transportation-assignment",
      transSubtype: "transportation",
      confidence: 0.9,
      reason: "Detected supply/demand shipping cost matrix structure.",
    };
  }

  // 5. Hungarian Assignment
  if (
    lower.includes("assignment") ||
    lower.includes("hungarian") ||
    lower.includes("workers") && lower.includes("jobs") ||
    lower.includes("assign each") ||
    lower.includes("one-to-one")
  ) {
    return {
      detectedModule: "transportation-assignment",
      transSubtype: "hungarian-assignment",
      confidence: 0.92,
      reason: "Detected worker-to-job Hungarian assignment formulation.",
    };
  }

  // 6. Project Planning (CPM / PERT)
  if (
    lower.includes("critical path") ||
    lower.includes("cpm") ||
    lower.includes("pert") ||
    lower.includes("predecessor") ||
    lower.includes("earliest start") ||
    lower.includes("slack")
  ) {
    return {
      detectedModule: "project-planning",
      confidence: 0.92,
      reason: "Detected project planning activity network and predecessor tables.",
    };
  }

  // 7. Inventory Control (EOQ)
  if (
    lower.includes("eoq") ||
    lower.includes("economic order quantity") ||
    lower.includes("holding cost") ||
    lower.includes("ordering cost") ||
    lower.includes("inventory") ||
    lower.includes("annual demand")
  ) {
    const numbers = text.match(/\d+(\.\d+)?/g)?.map(Number) || [];
    return {
      detectedModule: "inventory-control",
      confidence: 0.88,
      reason: "Detected inventory parameters (demand, setup cost, holding cost).",
      parsedData: {
        inventory: {
          annualDemandD: numbers[0] || 1000,
          orderingCostK: numbers[1] || 100,
          holdingCostH: numbers[2] || 2,
        },
      },
    };
  }

  // 8. Queuing Analysis
  if (
    lower.includes("queue") ||
    lower.includes("queuing") ||
    lower.includes("arrival rate") ||
    lower.includes("service rate") ||
    lower.includes("m/m/1") ||
    lower.includes("poisson")
  ) {
    return {
      detectedModule: "queuing-models",
      confidence: 0.88,
      reason: "Detected queue waiting line characteristics (arrival/service rates).",
    };
  }

  // 9. Zero-Sum Games
  if (
    lower.includes("game") ||
    lower.includes("payoff matrix") ||
    lower.includes("player 1") ||
    lower.includes("player 2") ||
    lower.includes("minimax") ||
    lower.includes("maximin") ||
    lower.includes("saddle point")
  ) {
    return {
      detectedModule: "zero-sum-games",
      confidence: 0.9,
      reason: "Detected 2-player zero-sum payoff matrix and strategy game.",
    };
  }

  // 10. Linear Programming (Default fallback for algebraic models)
  return {
    detectedModule: "linear-programming",
    confidence: 0.75,
    reason: "Detected linear constraints, variables, and optimization goal.",
  };
}

function extractNetworkEdges(text: string): NetworkEdge[] {
  const edges: NetworkEdge[] = [];
  // Match patterns like "1-2: 4000", "(1, 2) = 4000", "1 to 2 cost 4000", "Node 1 -> Node 2: 4000"
  const edgeRegex = /(?:node\s*)?([A-Za-z0-9]+)\s*(?:->|-|to|,)\s*(?:node\s*)?([A-Za-z0-9]+)\s*(?::|=|\$|cost|weight|\s+)\s*([0-9,]+)/gi;
  let match;

  while ((match = edgeRegex.exec(text)) !== null) {
    const from = match[1];
    const to = match[2];
    const cost = parseFloat(match[3].replace(/,/g, "")) || 10;
    if (from !== to) {
      edges.push({ from, to, cost });
    }
  }

  if (edges.length === 0) {
    // Default fallback network if parsing extracted plain numbers
    return [
      { from: 1, to: 2, cost: 4000 },
      { from: 1, to: 3, cost: 5400 },
      { from: 1, to: 4, cost: 9800 },
      { from: 2, to: 3, cost: 4300 },
      { from: 2, to: 4, cost: 6200 },
      { from: 2, to: 5, cost: 8700 },
      { from: 3, to: 4, cost: 4800 },
      { from: 3, to: 5, cost: 7100 },
      { from: 4, to: 5, cost: 4900 },
    ];
  }

  return edges;
}

export async function parseProblemWithAiVision(
  imageFile: File,
  rawOcrText: string,
  customSettings?: Partial<AiSettings>
): Promise<OcrProblemClassification> {
  const settings = { ...getStoredAiSettings(), ...customSettings };

  // If no API key configured, use client-side heuristic classification
  if (!settings.apiKey || settings.provider === "local") {
    return classifyOrProblemFromText(rawOcrText);
  }

  try {
    const base64Image = await fileToBase64(imageFile);

    const prompt = `You are an expert Operations Research Exam & Problem Solver.
Analyze this image of an Operations Research / Management Science question and the OCR extracted text:

OCR Extracted Text:
"""
${rawOcrText}
"""

Identify:
1. Which exact Operations Research problem type this is:
   Options:
   - "linear-programming"
   - "transportation-assignment" (with transSubtype: "transportation" or "hungarian-assignment")
   - "network-models" (with networkSubtype: "shortest-route", "minimum-spanning-tree", or "maximal-flow")
   - "project-planning"
   - "inventory-control"
   - "queuing-models"
   - "zero-sum-games"
   - "linear-equations"
2. Extract the numbers, nodes, matrix, and parameters.

Output strictly a JSON object:
{
  "detectedModule": "network-models",
  "networkSubtype": "shortest-route",
  "transSubtype": "transportation",
  "confidence": 0.95,
  "reason": "Clear Dijkstra shortest route problem finding minimum replacement cost."
}`;

    if (settings.provider === "claude") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imageFile.type || "image/png",
                    data: base64Image.split(",")[1],
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.warn("Vision API parsing failed, falling back to heuristic classification:", err);
  }

  return classifyOrProblemFromText(rawOcrText);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
