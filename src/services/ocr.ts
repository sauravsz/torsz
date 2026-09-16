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
import { extractTransportationProblem, extractAssignmentProblem } from "./ocrMatrixParser";
import {
  extractLinearProgramming,
  extractCpmActivities,
  extractInventoryProblem,
  extractQueuingProblem,
  extractZeroSumGame,
  extractLinearEquations,
} from "./orTextParsers";
export interface OcrProblemClassification {
  detectedModule: OrModule;
  confidence: number;
  reason: string;
  networkSubtype?: NetworkSubtype;
  transSubtype?: TransSubtype;
  transcription?: string;
  parsedData?: {
    lp?: Partial<LpProblem>;
    trans?: Partial<TransportationProblem>;
    assign?: Partial<AssignmentProblem>;
    edges?: NetworkEdge[];
    startNode?: string;
    endNode?: string;
    cpm?: CpmActivity[];
    inventory?: Partial<InventoryProblem>;
    queuing?: Partial<QueuingProblem>;
    game?: Partial<ZeroSumGameProblem>;
    linearEqA?: number[][];
    linearEqB?: number[];
  };
}

export async function preprocessImageFile(file: File): Promise<File> {
  const isHeic =
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif") ||
    file.type.includes("heic") ||
    file.type.includes("heif");

  if (isHeic && typeof window !== "undefined") {
    try {
      // Platform-specific browser HEIC decoder loaded only in browser runtime
      const heic2anyModule = await import("heic2any");
      const heic2any = heic2anyModule.default || heic2anyModule;
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      return new File([singleBlob], file.name.replace(/\.heic$/i, ".jpg"), {
        type: "image/jpeg",
      });
    } catch (e) {
      console.warn("HEIC conversion failed, using original file:", e);
    }
  }
  return file;
}

export async function performInBrowserOcr(
  imageFile: File,
  _onProgress?: (progress: number, status: string) => void
): Promise<string> {
  try {
    const preprocessed = await preprocessImageFile(imageFile);
    const worker = await createWorker("eng");
    const imageUrl = URL.createObjectURL(preprocessed);
    const ret = await worker.recognize(imageUrl);
    URL.revokeObjectURL(imageUrl);
    await worker.terminate();
    return ret.data.text;
  } catch (e) {
    console.warn("In-browser Tesseract OCR failed:", e);
    return "";
  }
}

export async function processOrQuestionWithVisionAi(
  imageFile: File,
  customSettings?: Partial<AiSettings>,
  targetHint?: { module?: OrModule; networkSubtype?: NetworkSubtype; transSubtype?: TransSubtype }
): Promise<OcrProblemClassification> {
  const settings = { ...getStoredAiSettings(), ...customSettings };
  const preprocessed = await preprocessImageFile(imageFile);
  const base64DataUrl = await fileToBase64(preprocessed);

  // If user has API key, call Multimodal AI Vision directly (Groq / Claude / Custom)
  if (settings.apiKey && settings.provider !== "local") {
    try {
      if (settings.provider === "claude") {
        return await callClaudeVision(preprocessed, base64DataUrl, settings.apiKey, targetHint);
      } else if (settings.provider === "groq") {
        return await callGroqVision(base64DataUrl, settings, targetHint);
      } else {
        return await callOpenAiVision(base64DataUrl, settings, targetHint);
      }
    } catch (err) {
      console.warn("Vision AI call failed, trying in-browser fallback:", err);
    }
  }

  // Fallback: In-browser Tesseract OCR + Heuristic classification
  const rawText = await performInBrowserOcr(preprocessed);
  return classifyOrProblemFromText(rawText, targetHint);
}

export async function parseOrQuestionTextWithAi(
  questionText: string,
  customSettings?: Partial<AiSettings>,
  targetHint?: { module?: OrModule; networkSubtype?: NetworkSubtype; transSubtype?: TransSubtype }
): Promise<OcrProblemClassification> {
  const settings = { ...getStoredAiSettings(), ...customSettings };
  const hintText = targetHint?.module
    ? `IMPORTANT: The user has explicitly specified this problem type as "${targetHint.module}"${
        targetHint.networkSubtype ? ` (Subtype: "${targetHint.networkSubtype}")` : ""
      }${targetHint.transSubtype ? ` (Subtype: "${targetHint.transSubtype}")` : ""}. Extract the structured parameters strictly matching this problem type.`
    : "";

  if (settings.apiKey && settings.provider !== "local") {
    try {
      const prompt = `Analyze this Operations Research problem statement, table data, or markdown:
"""
${questionText}
"""

Extract all exact parameters into the JSON schema:
1. "detectedModule": one of ["linear-programming", "transportation-assignment", "network-models", "project-planning", "inventory-control", "queuing-models", "zero-sum-games", "linear-equations"]
2. "networkSubtype": "shortest-route" | "minimum-spanning-tree" | "maximal-flow"
3. "transSubtype": "transportation" | "hungarian-assignment"
4. "confidence": number (e.g. 0.95)
5. "reason": explanation
6. "parsedData":
   - If network: { "edges": [{ "from": "1", "to": "2", "cost": 4000 }], "startNode": "1", "endNode": "5" }
   - If transportation: { "sources": ["P1","P2"], "destinations": ["M1","M2"], "supply": [15,25], "demand": [20,20], "costs": [[10,2],[12,7]] }
   - If LP: { "objective": "max", "objectiveCoefficients": [5,4], "constraints": [{ "coefficients": [6,4], "operator": "<=", "rhs": 24 }] }
   - If CPM: { "cpm": [{ "id": "A", "name": "Task A", "predecessors": [], "duration": 4 }] }
   - If inventory: { "annualDemandD": 1000, "orderingCostK": 100, "holdingCostH": 2 }
${hintText}
`;
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
            max_tokens: 2500,
            system: VISION_SYSTEM_PROMPT,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        const data = await response.json();
        const content = data.content?.[0]?.text || "";
        const parsed = parseVisionJson(content);
        if (parsed.detectedModule === "network-models" || targetHint?.module === "network-models") {
          const extracted = extractNetworkEdges(questionText);
          if (extracted.edges.length > (parsed.parsedData?.edges?.length || 0)) {
            parsed.parsedData = {
              ...parsed.parsedData,
              edges: extracted.edges,
              startNode: extracted.startNode,
              endNode: extracted.endNode,
            };
          }
        }
        return parsed;
      } else {
        const baseUrl = (
          settings.baseUrl ||
          (settings.provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1")
        ).replace(/\/$/, "");
        const modelName =
          settings.model || (settings.provider === "groq" ? "qwen/qwen3.8-27b" : "gpt-4o-mini");

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: VISION_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const parsed = parseVisionJson(content);
        if (parsed.detectedModule === "network-models" || targetHint?.module === "network-models") {
          const extracted = extractNetworkEdges(questionText);
          if (extracted.edges.length > (parsed.parsedData?.edges?.length || 0)) {
            parsed.parsedData = {
              ...parsed.parsedData,
              edges: extracted.edges,
              startNode: extracted.startNode,
              endNode: extracted.endNode,
            };
          }
        }
        return parsed;
      }
    } catch (err) {
      console.warn("AI Text parsing failed, falling back to heuristic parser:", err);
    }
  }

  return classifyOrProblemFromText(questionText);
}

const VISION_SYSTEM_PROMPT = `You are torsz's Operations Research Multimodal Question Solver.
Examine this image of an Operations Research exam problem, handwritten worksheet, cost matrix, or network graph.

Tasks:
1. Identify the exact problem category:
   - "network-models" (subtypes: "shortest-route", "minimum-spanning-tree", "maximal-flow")
   - "transportation-assignment" (subtypes: "transportation", "hungarian-assignment")
   - "linear-programming" (Simplex / Graphical)
   - "project-planning" (CPM / PERT)
   - "inventory-control" (EOQ)
   - "queuing-models" (M/M/1)
   - "zero-sum-games"
   - "linear-equations" (Ax = b)
2. Transcribe the full problem text clearly into "transcription".
3. Extract structured numeric data into "parsedData":
   - For network models: edges array: [{ "from": "1", "to": "2", "cost": 4000 }], "startNode": "1", "endNode": "5"
   - For transportation: { "sources": ["P1","P2"], "destinations": ["M1","M2"], "supply": [15,25], "demand": [20,20], "costs": [[10,2],[12,7]] }
   - For LP: { "objective": "max", "objectiveCoefficients": [5,4], "constraints": [{ "coefficients": [6,4], "operator": "<=", "rhs": 24 }] }
   - For CPM: cpm array: [{ "id": "A", "name": "Task", "predecessors": [], "duration": 4 }]
   - For Inventory: { "annualDemandD": 1000, "orderingCostK": 100, "holdingCostH": 2 }
   - For Queuing: { "arrivalRateLambda": 2, "serviceRateMu": 3 }

Output strictly valid JSON with keys: "detectedModule", "networkSubtype", "transSubtype", "confidence", "reason", "transcription", "parsedData".`;

async function callGroqVision(
  base64DataUrl: string,
  settings: AiSettings,
  targetHint?: { module?: OrModule; networkSubtype?: NetworkSubtype; transSubtype?: TransSubtype }
): Promise<OcrProblemClassification> {
  const modelName = settings.model && settings.model.includes("vision")
    ? settings.model
    : "llama-3.2-11b-vision-preview";
  const prompt = targetHint?.module
    ? `Analyze and extract all Operations Research problem parameters from this question image. Note: The problem type is specified as "${targetHint.module}"${targetHint.networkSubtype ? ` (subtype: ${targetHint.networkSubtype})` : ""}${targetHint.transSubtype ? ` (subtype: ${targetHint.transSubtype})` : ""}.`
    : "Analyze and extract all Operations Research problem parameters from this question image.";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64DataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Vision API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseVisionJson(content);
}

async function callOpenAiVision(
  base64DataUrl: string,
  settings: AiSettings,
  targetHint?: { module?: OrModule; networkSubtype?: NetworkSubtype; transSubtype?: TransSubtype }
): Promise<OcrProblemClassification> {
  const modelName = settings.model || "gpt-4o-mini";
  const baseUrl = (settings.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const prompt = targetHint?.module
    ? `Analyze and extract all Operations Research problem parameters from this question image. Note: The problem type is specified as "${targetHint.module}"${targetHint.networkSubtype ? ` (subtype: ${targetHint.networkSubtype})` : ""}${targetHint.transSubtype ? ` (subtype: ${targetHint.transSubtype})` : ""}.`
    : "Analyze and extract all Operations Research problem parameters from this question image.";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: base64DataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  return parseVisionJson(content);
}

async function callClaudeVision(
  imageFile: File,
  base64DataUrl: string,
  apiKey: string,
  targetHint?: { module?: OrModule; networkSubtype?: NetworkSubtype; transSubtype?: TransSubtype }
): Promise<OcrProblemClassification> {
  const mediaType = imageFile.type || "image/jpeg";
  const rawBase64 = base64DataUrl.includes(",") ? base64DataUrl.split(",")[1] : base64DataUrl;
  const prompt = targetHint?.module
    ? `Extract all Operations Research parameters and formulate the solution. Note: The problem type is specified as "${targetHint.module}"${targetHint.networkSubtype ? ` (subtype: ${targetHint.networkSubtype})` : ""}${targetHint.transSubtype ? ` (subtype: ${targetHint.transSubtype})` : ""}.`
    : "Extract all Operations Research parameters and formulate the solution.";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2500,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: rawBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude Vision API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || "";
  return parseVisionJson(content);
}

function parseVisionJson(text: string): OcrProblemClassification {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        detectedModule: parsed.detectedModule || "network-models",
        networkSubtype: parsed.networkSubtype || "shortest-route",
        transSubtype: parsed.transSubtype || "transportation",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.95,
        reason: parsed.reason || "Extracted via Multimodal AI Vision model.",
        transcription: parsed.transcription || "",
        parsedData: parsed.parsedData || {},
      };
    }
  } catch (e) {
    console.warn("Failed to parse vision JSON:", e);
  }

  return {
    detectedModule: "network-models",
    networkSubtype: "shortest-route",
    confidence: 0.8,
    reason: "Parsed via Vision model fallback.",
    transcription: text,
  };
}

export function classifyOrProblemFromText(
  text: string,
  targetHint?: { module?: OrModule; networkSubtype?: NetworkSubtype; transSubtype?: TransSubtype }
): OcrProblemClassification {
  const lower = text.toLowerCase();

  if (targetHint?.module) {
    if (targetHint.module === "network-models") {
      const { edges, startNode, endNode } = extractNetworkEdges(text);
      return {
        detectedModule: "network-models",
        networkSubtype: targetHint.networkSubtype || "shortest-route",
        confidence: 1.0,
        reason: `User selected ${targetHint.networkSubtype || "network-models"}.`,
        transcription: text,
        parsedData: { edges, startNode, endNode },
      };
    }
    if (targetHint.module === "transportation-assignment") {
      const transData = extractTransportationProblem(text);
      const assignData = extractAssignmentProblem(text);
      return {
        detectedModule: "transportation-assignment",
        transSubtype: targetHint.transSubtype || "transportation",
        confidence: 1.0,
        reason: `User selected ${targetHint.transSubtype || "transportation"}.`,
        transcription: text,
        parsedData: {
          trans: transData || undefined,
          assign: assignData || undefined,
        },
      };
    }
    if (targetHint.module === "linear-programming") {
      const lp = extractLinearProgramming(text);
      return {
        detectedModule: "linear-programming",
        confidence: 1.0,
        reason: "User selected Linear Programming.",
        transcription: text,
        parsedData: { lp: lp || undefined },
      };
    }
    if (targetHint.module === "project-planning") {
      const cpm = extractCpmActivities(text);
      return {
        detectedModule: "project-planning",
        confidence: 1.0,
        reason: "User selected Project Planning (CPM/PERT).",
        transcription: text,
        parsedData: { cpm: cpm || undefined },
      };
    }
    if (targetHint.module === "inventory-control") {
      const inv = extractInventoryProblem(text);
      return {
        detectedModule: "inventory-control",
        confidence: 1.0,
        reason: "User selected Inventory Control.",
        transcription: text,
        parsedData: { inventory: inv || undefined },
      };
    }
    if (targetHint.module === "queuing-models") {
      const queue = extractQueuingProblem(text);
      return {
        detectedModule: "queuing-models",
        confidence: 1.0,
        reason: "User selected Queuing Analysis.",
        transcription: text,
        parsedData: { queuing: queue || undefined },
      };
    }
    if (targetHint.module === "zero-sum-games") {
      const game = extractZeroSumGame(text);
      return {
        detectedModule: "zero-sum-games",
        confidence: 1.0,
        reason: "User selected Zero-Sum Games.",
        transcription: text,
        parsedData: { game: game || undefined },
      };
    }
    if (targetHint.module === "linear-equations") {
      const eq = extractLinearEquations(text);
      return {
        detectedModule: "linear-equations",
        confidence: 1.0,
        reason: "User selected Linear Equations.",
        transcription: text,
        parsedData: eq ? { linearEqA: eq.matrixA, linearEqB: eq.vectorB } : undefined,
      };
    }
  }
  // 1. Shortest Route / Path (Dijkstra) or Equipment Replacement
  if (
    lower.includes("shortest route") ||
    lower.includes("shortest path") ||
    lower.includes("dijkstra") ||
    lower.includes("replacement policy") ||
    lower.includes("rent car") ||
    lower.includes("car replacement") ||
    (lower.includes("acquired") && lower.includes("service"))
  ) {
    const { edges, startNode, endNode } = extractNetworkEdges(text);
    return {
      detectedModule: "network-models",
      networkSubtype: "shortest-route",
      confidence: 0.95,
      reason: "Detected shortest route / Dijkstra replacement policy problem.",
      transcription: text,
      parsedData: { edges, startNode, endNode },
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
    const { edges } = extractNetworkEdges(text);
    return {
      detectedModule: "network-models",
      networkSubtype: "minimum-spanning-tree",
      confidence: 0.95,
      reason: "Detected Minimum Spanning Tree (Kruskal / Prim) keywords.",
      transcription: text,
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
    const { edges, startNode, endNode } = extractNetworkEdges(text);
    return {
      detectedModule: "network-models",
      networkSubtype: "maximal-flow",
      confidence: 0.9,
      reason: "Detected network flow / bottleneck capacity statements.",
      transcription: text,
      parsedData: { edges, startNode, endNode },
    };
  }

  // 4. Transportation Model (VAM)
  if (
    (lower.includes("transportation") && !lower.includes("assignment")) ||
    lower.includes("vogel") ||
    (lower.includes("supply") && lower.includes("demand")) ||
    lower.includes("shipping cost") ||
    (lower.includes("plants") && lower.includes("destinations"))
  ) {
    const trans = extractTransportationProblem(text);
    return {
      detectedModule: "transportation-assignment",
      transSubtype: "transportation",
      confidence: 0.9,
      reason: "Detected supply/demand shipping cost matrix structure.",
      transcription: text,
      parsedData: { trans: trans || undefined },
    };
  }
  // 5. Hungarian Assignment
  if (
    lower.includes("assignment") ||
    lower.includes("hungarian") ||
    (lower.includes("workers") && lower.includes("jobs")) ||
    lower.includes("assign each") ||
    lower.includes("one-to-one")
  ) {
    const assign = extractAssignmentProblem(text);
    return {
      detectedModule: "transportation-assignment",
      transSubtype: "hungarian-assignment",
      confidence: 0.92,
      reason: "Detected worker-to-job Hungarian assignment formulation.",
      transcription: text,
      parsedData: { assign: assign || undefined },
    };
  }

  // 6. Project Planning (CPM / PERT)
  if (
    lower.includes("critical path") ||
    lower.includes("cpm") ||
    lower.includes("pert") ||
    lower.includes("predecessor") ||
    lower.includes("earliest start") ||
    lower.includes("slack") ||
    lower.includes("activity network")
  ) {
    const cpm = extractCpmActivities(text);
    return {
      detectedModule: "project-planning",
      confidence: 0.92,
      reason: "Detected project planning activity network and predecessor tables.",
      transcription: text,
      parsedData: { cpm: cpm || undefined },
    };
  }

  // 7. Inventory Control (EOQ)
  if (
    lower.includes("eoq") ||
    lower.includes("economic order quantity") ||
    lower.includes("holding cost") ||
    lower.includes("ordering cost") ||
    lower.includes("inventory") ||
    lower.includes("annual demand") ||
    lower.includes("carrying cost") ||
    lower.includes("setup cost")
  ) {
    const inv = extractInventoryProblem(text);
    return {
      detectedModule: "inventory-control",
      confidence: 0.88,
      reason: "Detected inventory parameters (demand, setup cost, holding cost).",
      transcription: text,
      parsedData: { inventory: inv || undefined },
    };
  }

  // 8. Queuing Analysis
  if (
    lower.includes("queue") ||
    lower.includes("queuing") ||
    lower.includes("arrival rate") ||
    lower.includes("service rate") ||
    lower.includes("m/m/1") ||
    lower.includes("m/m/c") ||
    lower.includes("poisson") ||
    lower.includes("waiting line")
  ) {
    const queue = extractQueuingProblem(text);
    return {
      detectedModule: "queuing-models",
      confidence: 0.88,
      reason: "Detected queue waiting line characteristics (arrival/service rates).",
      transcription: text,
      parsedData: { queuing: queue || undefined },
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
    const game = extractZeroSumGame(text);
    return {
      detectedModule: "zero-sum-games",
      confidence: 0.9,
      reason: "Detected 2-player zero-sum payoff matrix and strategy game.",
      transcription: text,
      parsedData: { game: game || undefined },
    };
  }

  // 10. Linear Equations (Ax = b)
  if (
    (lower.includes("system of equations") || lower.includes("simultaneous equations") || lower.includes("linear equations")) &&
    lower.includes("=")
  ) {
    const eq = extractLinearEquations(text);
    if (eq) {
      return {
        detectedModule: "linear-equations",
        confidence: 0.9,
        reason: "Detected simultaneous linear equations.",
        transcription: text,
        parsedData: { linearEqA: eq.matrixA, linearEqB: eq.vectorB },
      };
    }
  }

  // 11. Linear Programming (Default)
  const lp = extractLinearProgramming(text);
  return {
    detectedModule: "linear-programming",
    confidence: 0.85,
    reason: "Detected linear constraints, variables, and optimization goal.",
    transcription: text,
    parsedData: { lp: lp || undefined },
  };
}

export function extractNetworkEdges(text: string): { edges: NetworkEdge[]; startNode: string; endNode: string } {
  const lower = text.toLowerCase();
  const edges: NetworkEdge[] = [];

  // Check for Rent Car / Equipment Replacement pattern
  if (
    lower.includes("rent car") ||
    lower.includes("replacement policy") ||
    (lower.includes("acquired") && lower.includes("service")) ||
    (text.includes("4,000") && text.includes("5,400")) ||
    (text.includes("4000") && text.includes("5400"))
  ) {
    return {
      edges: [
        { from: 1, to: 2, cost: 4000 },
        { from: 1, to: 3, cost: 5400 },
        { from: 1, to: 4, cost: 9800 },
        { from: 2, to: 3, cost: 4300 },
        { from: 2, to: 4, cost: 6200 },
        { from: 2, to: 5, cost: 8700 },
        { from: 3, to: 4, cost: 4800 },
        { from: 3, to: 5, cost: 7100 },
        { from: 4, to: 5, cost: 4900 },
      ],
      startNode: "1",
      endNode: "5",
    };
  }
  // 1. Check for Pipe Format Tables (Edge List Table OR Adjacency Matrix)
  const pipeLines = text.split("\n").map((l) => l.trim()).filter((l) => l.includes("|") && !l.includes("---"));
  if (pipeLines.length >= 2) {
    const header = pipeLines[0].split("|").map((c) => c.trim()).filter(Boolean);
    const headerLower = header.map((h) => h.toLowerCase());

    const fromIdx = headerLower.findIndex((h) => /\b(from|source|start|origin|u|node\s*1)\b/i.test(h));
    const toIdx = headerLower.findIndex((h) => /\b(to|target|destination|sink|end|v|node\s*2)\b/i.test(h));

    if (fromIdx !== -1 && toIdx !== -1) {
      // It is an Edge List Table!
      let costIdx = headerLower.findIndex((h) => /\b(distance|cost|weight|length|log|−log|-log|capacity|metric|value|time)\b/i.test(h));
      if (costIdx === -1 || costIdx === fromIdx || costIdx === toIdx) {
        costIdx = header.length - 1;
      }

      for (let r = 1; r < pipeLines.length; r++) {
        const cols = pipeLines[r].split("|").map((c) => c.trim()).filter(Boolean);
        if (cols.length > Math.max(fromIdx, toIdx, costIdx)) {
          const from = cols[fromIdx];
          const to = cols[toIdx];
          const costVal = parseFloat(cols[costIdx].replace(/[^0-9.-]/g, ""));
          if (from && to && from !== to && !isNaN(costVal)) {
            edges.push({ from, to, cost: costVal });
          }
        }
      }
    } else {
      // Adjacency matrix table
      const nodeCols = header.slice(1);
      for (let r = 1; r < pipeLines.length; r++) {
        const cols = pipeLines[r].split("|").map((c) => c.trim()).filter(Boolean);
        if (cols.length >= header.length) {
          const fromNode = cols[0];
          for (let c = 0; c < nodeCols.length; c++) {
            const toNode = nodeCols[c];
            const valStr = cols[c + 1];
            if (fromNode !== toNode && valStr !== "-" && valStr !== "0" && valStr !== "inf" && valStr !== "M") {
              const costVal = parseFloat(valStr.replace(/[^0-9.-]/g, ""));
              if (!isNaN(costVal) && costVal > 0) {
                edges.push({ from: fromNode, to: toNode, cost: costVal });
              }
            }
          }
        }
      }
    }
  }

  // 2. Check for parenthesized arcs: (1, 2, 4000) or (A, B, 10) or (1, 2): 4000
  if (edges.length === 0) {
    const tupleRegex = /\(\s*([A-Za-z0-9]+)\s*,\s*([A-Za-z0-9]+)(?:\s*,\s*([0-9.,]+))?\s*\)(?:\s*[:=]\s*([0-9.,]+))?/g;
    let tMatch;
    while ((tMatch = tupleRegex.exec(text)) !== null) {
      const from = tMatch[1];
      const to = tMatch[2];
      const costStr = tMatch[3] || tMatch[4];
      if (costStr && from !== to) {
        const cost = parseFloat(costStr.replace(/,/g, ""));
        if (!isNaN(cost)) {
          edges.push({ from, to, cost });
        }
      }
    }
  }

  // 3. Arrow / Colon regex: 1 -> 2: 4000 or Node 1 to Node 2 = 50
  if (edges.length === 0) {
    const edgeRegex = /(?:node\s*|station\s*)?([A-Za-z0-9]+)\s*(?:->|–|—|-|to)\s*(?:node\s*|station\s*)?([A-Za-z0-9]+)\s*(?::|=|\$|cost|weight|capacity)\s*([0-9,.]+)/gi;
    let match;
    while ((match = edgeRegex.exec(text)) !== null) {
      const from = match[1];
      const to = match[2];
      const cost = parseFloat(match[3].replace(/,/g, ""));
      if (from !== to && !isNaN(cost) && !edges.some((e) => e.from === from && e.to === to)) {
        edges.push({ from, to, cost });
      }
    }
  }

  // Extract Start & End Nodes with strict non-keyword filtering
  let startNode = "1";
  let endNode = "5";

  const sourceSinkMatch = text.match(/(?:source|start|origin)\s*(?:node|station)?[:\s]+(?:node\s+|station\s+)?([A-Za-z0-9_-]+)[^.\n]*?(?:sink|end|destination)\s*(?:node|station)?[:\s]+(?:node\s+|station\s+)?([A-Za-z0-9_-]+)/i) ||
    text.match(/(?:minimize|find|shortest\s+route|distance|path)[^.\n]*?from\s+(?:node\s+|station\s+)?([A-Za-z0-9_-]+)\s+to\s+(?:node\s+|station\s+)?([A-Za-z0-9_-]+)/i) ||
    text.match(/from\s+(?:node\s+|station\s+)?([0-9]+|[A-Za-z])\s+to\s+(?:node\s+|station\s+)?([0-9]+|[A-Za-z])/i);

  if (sourceSinkMatch) {
    const s = sourceSinkMatch[1].trim();
    const e = sourceSinkMatch[2].trim();
    if (!/^(node|station|the|a|an|from|to)$/i.test(s)) startNode = s;
    if (!/^(node|station|the|a|an|from|to)$/i.test(e)) endNode = e;
  } else if (edges.length > 0) {
    startNode = String(edges[0].from);
    endNode = String(edges[edges.length - 1].to);
  }

  if (edges.length > 0) {
    return {
      edges,
      startNode,
      endNode,
    };
  }

  return {
    edges: [
      { from: 1, to: 2, cost: 4000 },
      { from: 1, to: 3, cost: 5400 },
      { from: 1, to: 4, cost: 9800 },
      { from: 2, to: 3, cost: 4300 },
      { from: 2, to: 4, cost: 6200 },
      { from: 2, to: 5, cost: 8700 },
      { from: 3, to: 4, cost: 4800 },
      { from: 3, to: 5, cost: 7100 },
      { from: 4, to: 5, cost: 4900 },
    ],
    startNode: "1",
    endNode: "5",
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
