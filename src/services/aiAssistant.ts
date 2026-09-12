import { DatabaseSchema } from "../types";

export interface AiGeneratedSql {
  sql: string;
  explanation: string;
  suggestedQuestions?: string[];
  isOptimizationModel?: boolean;
  orModule?: string;
  modelType?: string;
}

export interface AiSettings {
  provider: "groq" | "claude" | "custom" | "local";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getStoredAiSettings(): AiSettings {
  const provider = (localStorage.getItem("torsz_ai_provider") as AiSettings["provider"]) || "groq";
  const apiKey = localStorage.getItem("torsz_ai_api_key") || "";
  const baseUrl = localStorage.getItem("torsz_ai_base_url") || "https://api.groq.com/openai/v1";
  const model = localStorage.getItem("torsz_ai_model") || "openai/gpt-oss-120b";

  return { provider, apiKey, baseUrl, model };
}

export function saveStoredAiSettings(settings: Partial<AiSettings>) {
  if (settings.provider) localStorage.setItem("torsz_ai_provider", settings.provider);
  if (settings.apiKey !== undefined) localStorage.setItem("torsz_ai_api_key", settings.apiKey);
  if (settings.baseUrl !== undefined) localStorage.setItem("torsz_ai_base_url", settings.baseUrl);
  if (settings.model !== undefined) localStorage.setItem("torsz_ai_model", settings.model);
}

export function generateOptimizationSuggestions(): { title: string; prompt: string; module: string }[] {
  return [
    {
      title: "Maximize Product Profit (LP)",
      prompt: "Formulate a Linear Programming problem to maximize profit Z = 5*x1 + 4*x2 subject to resource limits 6*x1 + 4*x2 <= 24 and 1*x1 + 2*x2 <= 6.",
      module: "linear-programming",
    },
    {
      title: "Transportation Shipping Matrix",
      prompt: "Formulate a Transportation shipping cost model for 3 Supply Plants and 4 Destination Markets with supply and demand constraints.",
      module: "transportation-assignment",
    },
    {
      title: "Hungarian Task Assignment",
      prompt: "Solve a 4x4 Hungarian Assignment problem to allocate 4 workers to 4 jobs at minimal total task cost.",
      module: "transportation-assignment",
    },
    {
      title: "CPM / PERT Project Duration",
      prompt: "Calculate the Critical Path, slack times, and project duration for construction activities A through G.",
      module: "project-planning",
    },
    {
      title: "Optimal Inventory EOQ",
      prompt: "Calculate Economic Order Quantity (EOQ), optimal cycle time, and annual holding cost for annual demand D=1000, ordering cost K=$100, holding cost h=$2.",
      module: "inventory-control",
    },
    {
      title: "M/M/1 Queuing Analysis",
      prompt: "Compute steady-state queuing metrics for arrival rate lambda=2 arrivals/hr and service rate mu=3 services/hr.",
      module: "queuing-models",
    },
  ];
}

export function generateSmartSuggestions(schema: DatabaseSchema | null): string[] {
  if (!schema || schema.tables.length === 0) {
    return [
      "Show all records from the first table",
      "Count total rows in each table",
      "Find top 10 items sorted by value descending",
      "Calculate summary averages across numeric columns",
      "Show distinct values of categorical fields",
    ];
  }

  const suggestions: string[] = [];
  const tableNames = schema.tables.map((t) => t.name.toLowerCase());

  if (tableNames.includes("superstore")) {
    suggestions.push("Total sales, profit, and profit margin percentage grouped by Category and Sub_Category");
    suggestions.push("Top 10 loss-making products with their average discount percentage");
    suggestions.push("Top 10 highest spending customers with total orders placed");
    suggestions.push("Regional sales and profit comparison between East, West, Central, and South");
    suggestions.push("Find all orders where discount is greater than 30% and profit is negative");
  } else if (tableNames.includes("netflix_titles")) {
    suggestions.push("Breakdown of total Movies vs TV Shows with percentages");
    suggestions.push("Top 10 countries producing the most Netflix content");
    suggestions.push("Top 10 most prolific directors with title counts");
    suggestions.push("Content releases per year from 2015 to 2021 split by Movies and TV Shows");
    suggestions.push("Find all titles starring Leonardo DiCaprio, Tom Hanks, or Brad Pitt");
  } else if (tableNames.includes("all_stocks_5yr")) {
    suggestions.push("20-day moving average of close prices for AAPL, MSFT, and AMZN");
    suggestions.push("Top 15 stocks with highest single-day percentage price gains");
    suggestions.push("Top 10 most traded stocks by total liquidity (volume * close)");
    suggestions.push("All-time high, all-time low, and average price spread per ticker");
    suggestions.push("Find dates where AAPL trading volume exceeded 50 million shares");
  } else if (tableNames.includes("walmart_sales") || tableNames.includes("walmart")) {
    suggestions.push("Weekly sales and average discount breakdown by department");
    suggestions.push("Compare total sales during holiday weeks vs non-holiday weeks");
    suggestions.push("Top 5 stores with highest total weekly sales");
    suggestions.push("Average weekly sales and unemployment rate grouped by store type");
    suggestions.push("Find weeks where weekly sales exceeded $50,000 in Department 1");
  } else if (tableNames.includes("spotify")) {
    suggestions.push("Peak daily streams reached by each track");
    suggestions.push("Dates where Despacito had higher streams than Shape of You");
    suggestions.push("Top 10 days with highest overall streaming volume");
    suggestions.push("Monthly stream averages for each track over time");
    suggestions.push("Find all dates where daily streams of HUMBLE exceeded 5 million");
  } else if (tableNames.includes("titanic")) {
    suggestions.push("Survival rate percentage grouped by passenger class (Pclass) and sex");
    suggestions.push("Average ticket fare paid by survivors vs non-survivors");
    suggestions.push("Age distribution and survival count across children, adults, and seniors");
    suggestions.push("Passenger counts and survival rates by embarkation port");
    suggestions.push("Find 1st class passengers with ticket fares greater than $100");
  } else if (tableNames.includes("housing")) {
    suggestions.push("Median house value and population grouped by ocean proximity");
    suggestions.push("Top 10 districts with median income greater than $100,000");
    suggestions.push("Average number of rooms and bedrooms per household by location");
    suggestions.push("Districts where median house value exceeds $400,000 and age is under 15");
    suggestions.push("Correlation between population density and median house price");
  } else if (tableNames.includes("products") && tableNames.includes("categories")) {
    suggestions.push("Top 5 most expensive products with their category names");
    suggestions.push("Total stock count and average price per category");
    suggestions.push("Find customers with total order spending greater than $200");
    suggestions.push("Products with stock below 20 items ordered by price");
    suggestions.push("Orders count and revenue breakdown by customer country");
  } else {
    const firstTable = schema.tables[0];
    const cols = firstTable.columns;
    const numCol = cols.find(
      (c) => c.data_type.includes("INT") || c.data_type.includes("REAL") || c.data_type.includes("NUM")
    );
    const textCol = cols.find(
      (c) => c.data_type.includes("TEXT") || c.data_type.includes("CHAR") || c.data_type.includes("VARCHAR")
    );

    suggestions.push(`Show all columns from "${firstTable.name}" limited to 50 rows`);
    if (numCol) {
      suggestions.push(`Find top 10 rows in "${firstTable.name}" sorted by "${numCol.name}" descending`);
      suggestions.push(`Calculate average, minimum, and maximum of "${numCol.name}" in "${firstTable.name}"`);
    }
    if (textCol) {
      suggestions.push(`Count total records in "${firstTable.name}" grouped by "${textCol.name}"`);
      suggestions.push(`Find distinct values of "${textCol.name}" in "${firstTable.name}"`);
    }
    if (schema.tables.length > 1) {
      suggestions.push(`Show total row counts across all ${schema.tables.length} tables in database`);
    }
  }

  return suggestions.slice(0, 5);
}

export async function convertTextToSql(
  prompt: string,
  schema: DatabaseSchema | null,
  customSettings?: Partial<AiSettings>
): Promise<AiGeneratedSql> {
  const settings = { ...getStoredAiSettings(), ...customSettings };

  if (settings.provider === "local") {
    return localSemanticSqlGenerator(prompt, schema);
  }

  if (!settings.apiKey) {
    if (settings.provider === "groq") {
      throw new Error("Groq API key required. Click 'Configure API' to enter your free Groq API key.");
    }
    if (settings.provider === "claude") {
      throw new Error("Anthropic Claude API key required. Click 'Configure API' to enter your key.");
    }
    return localSemanticSqlGenerator(prompt, schema);
  }

  try {
    if (settings.provider === "claude") {
      return await callClaudeApi(prompt, schema, settings.apiKey);
    } else {
      return await callOpenAiCompatibleApi(prompt, schema, settings);
    }
  } catch (err: unknown) {
    console.warn("Remote AI request failed, falling back to local semantic engine:", err);
    const fallback = localSemanticSqlGenerator(prompt, schema);
    fallback.explanation = `(Offline Fallback) ${fallback.explanation}`;
    return fallback;
  }
}

async function callOpenAiCompatibleApi(
  prompt: string,
  schema: DatabaseSchema | null,
  settings: AiSettings
): Promise<AiGeneratedSql> {
  const schemaContext = schema
    ? schema.tables
        .map(
          (t) =>
            `Table: "${t.name}"\nColumns:\n` +
            t.columns.map((c) => `  - "${c.name}" (${c.data_type})`).join("\n")
        )
        .join("\n\n")
    : "No database tables loaded.";

  const systemPrompt = `You are torsz's AI Database & Operations Research Assistant.
You have two core competencies:
1. SQL Database Engineering: Converting natural language requests into clean, optimized SQLite queries.
2. Operations Research & Optimization Suite: Formulating and solving Linear Programming (Simplex & Graphical), Transportation (VAM), Hungarian Assignment, Network Flow (Dijkstra, MST, Max Flow), Project Planning (CPM/PERT), Inventory Control (EOQ), Queuing Models, and Zero-Sum Games.

When answering:
- If the user asks an optimization / OR question (e.g. Linear Program, Transportation matrix, CPM/PERT, EOQ, Queuing):
  1. Provide the mathematical formulation (decision variables, objective function, constraints).
  2. Provide an executable SQL script that models and queries the problem in SQLite tables.
  3. Mark "isOptimizationModel": true and name the relevant "orModule" (linear-programming, transportation-assignment, network-models, project-planning, inventory-control, queuing-models, zero-sum-games).
- If the user asks a database query question:
  1. Generate clean, valid SQLite SQL.
  2. Use correct table and column names matching the schema.

Schema:
${schemaContext}

Output MUST be strictly a JSON object:
{
  "sql": "SELECT ...;",
  "explanation": "Markdown text explaining the query or mathematical optimization formulation.",
  "suggestedQuestions": ["Question 1", "Question 2"],
  "isOptimizationModel": false,
  "orModule": "linear-programming"
}`;

  const response = await fetch(`${settings.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(content);
    return {
      sql: (parsed.sql || "").trim(),
      explanation: parsed.explanation || "Query generated successfully.",
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [],
      isOptimizationModel: !!parsed.isOptimizationModel,
      orModule: parsed.orModule || "linear-programming",
    };
  } catch {
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/i) || content.match(/```([\s\S]*?)\n```/i);
    const sql = sqlMatch ? sqlMatch[1].trim() : content.trim();
    return {
      sql,
      explanation: "Generated SQL query.",
      suggestedQuestions: [],
    };
  }
}

async function callClaudeApi(
  prompt: string,
  schema: DatabaseSchema | null,
  apiKey: string
): Promise<AiGeneratedSql> {
  const schemaContext = schema
    ? schema.tables
        .map(
          (t) =>
            `Table: "${t.name}"\nColumns:\n` +
            t.columns.map((c) => `  - "${c.name}" (${c.data_type})`).join("\n")
        )
        .join("\n\n")
    : "No database tables loaded.";

  const systemPrompt = `You are torsz's AI Database & Operations Research Assistant.
Support both SQLite database querying and Operations Research optimization formulations.
Schema:
${schemaContext}

Return strictly a JSON object with "sql", "explanation", "suggestedQuestions", "isOptimizationModel", and "orModule".`;

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
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const textContent = data.content?.[0]?.text || "";

  try {
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sql: (parsed.sql || "").trim(),
        explanation: parsed.explanation || "Query generated successfully.",
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [],
        isOptimizationModel: !!parsed.isOptimizationModel,
        orModule: parsed.orModule || "linear-programming",
      };
    }
  } catch {}

  return {
    sql: textContent.trim(),
    explanation: "Generated SQL statement.",
  };
}

function localSemanticSqlGenerator(
  prompt: string,
  schema: DatabaseSchema | null
): AiGeneratedSql {
  const lower = prompt.toLowerCase();

  // 1. Operations Research: Linear Programming
  if (lower.includes("linear program") || lower.includes("simplex") || lower.includes("maximize profit") || lower.includes("minimize cost")) {
    return {
      sql: `-- Linear Programming Optimization Model
-- Objective: Maximize Z = 5*x1 + 4*x2
-- Subject to: 6*x1 + 4*x2 <= 24, 1*x1 + 2*x2 <= 6, -1*x1 + 1*x2 <= 1, x1, x2 >= 0

CREATE TABLE IF NOT EXISTS lp_decision_variables (
  variable_name VARCHAR(10) PRIMARY KEY,
  optimal_value DOUBLE PRECISION,
  objective_profit DOUBLE PRECISION
);

INSERT OR REPLACE INTO lp_decision_variables VALUES 
  ('x1 (Product A)', 3.0, 5.0),
  ('x2 (Product B)', 1.5, 4.0);

SELECT 
  variable_name,
  optimal_value,
  objective_profit,
  (optimal_value * objective_profit) AS subtotal_contribution,
  (SELECT SUM(optimal_value * objective_profit) FROM lp_decision_variables) AS total_optimal_Z
FROM lp_decision_variables;`,
      explanation: `**Linear Programming Model**:
- **Decision Variables**: $x_1$ = units of Product A, $x_2$ = units of Product B.
- **Objective Function**: $\\text{Maximize } Z = 5x_1 + 4x_2$.
- **Constraints**:
  1. $6x_1 + 4x_2 \\le 24$ (Raw Material 1)
  2. $x_1 + 2x_2 \\le 6$ (Labor Limit)
  3. $-x_1 + x_2 \\le 1$ (Market Demand Balance)
  4. $x_1, x_2 \\ge 0$
- **Optimal Solution**: Vertex $(x_1^*, x_2^*) = (3.0, 1.5)$ with $\\text{Max } Z^* = 21.0$.`,
      suggestedQuestions: [
        "Calculate dual shadow prices for constraint limits",
        "Formulate integer programming branch and bound tree",
        "Compute sensitivity range for objective coefficients",
      ],
      isOptimizationModel: true,
      orModule: "linear-programming",
    };
  }

  // 2. Operations Research: Transportation Model (VAM)
  if (lower.includes("transportation") || lower.includes("shipping") || lower.includes("vogel") || lower.includes("vam")) {
    return {
      sql: `-- Transportation Problem Matrix (Vogel's Approximation Method)
CREATE TABLE IF NOT EXISTS shipping_allocations (
  source VARCHAR(50),
  destination VARCHAR(50),
  unit_cost DOUBLE PRECISION,
  allocated_units INTEGER,
  PRIMARY KEY (source, destination)
);

INSERT OR REPLACE INTO shipping_allocations VALUES
  ('Plant 1', 'Market 1', 10, 0),
  ('Plant 1', 'Market 2', 2, 15),
  ('Plant 1', 'Market 3', 20, 0),
  ('Plant 1', 'Market 4', 11, 0),
  ('Plant 2', 'Market 1', 12, 0),
  ('Plant 2', 'Market 2', 7, 0),
  ('Plant 2', 'Market 3', 9, 15),
  ('Plant 2', 'Market 4', 20, 10),
  ('Plant 3', 'Market 1', 4, 5),
  ('Plant 3', 'Market 2', 14, 0),
  ('Plant 3', 'Market 3', 16, 0),
  ('Plant 3', 'Market 4', 18, 5);

SELECT 
  source, 
  destination, 
  allocated_units, 
  unit_cost,
  (allocated_units * unit_cost) AS total_lane_cost
FROM shipping_allocations
WHERE allocated_units > 0
ORDER BY source, destination;`,
      explanation: `**Transportation Shipping Model**:
- Solves balanced distribution across 3 Supply Plants (Total Supply: 50 units) and 4 Destination Markets (Total Demand: 50 units).
- Applies Vogel's Approximation Method (VAM) to compute unit cost penalty differences and minimize distribution expenditure.`,
      suggestedQuestions: [
        "Compute dummy node allocation for unbalanced supply/demand",
        "Solve Hungarian assignment for 1-to-1 worker matching",
      ],
      isOptimizationModel: true,
      orModule: "transportation-assignment",
    };
  }

  // 3. Operations Research: Project Planning (CPM / PERT)
  if (lower.includes("cpm") || lower.includes("pert") || lower.includes("critical path") || lower.includes("project duration")) {
    return {
      sql: `-- Critical Path Method (CPM / PERT) Analysis
CREATE TABLE IF NOT EXISTS project_activities (
  activity_id VARCHAR(5) PRIMARY KEY,
  name VARCHAR(50),
  duration_weeks INTEGER,
  early_start INTEGER,
  early_finish INTEGER,
  late_start INTEGER,
  late_finish INTEGER,
  slack_float INTEGER,
  is_critical BOOLEAN
);

INSERT OR REPLACE INTO project_activities VALUES
  ('A', 'Site Preparation', 2, 0, 2, 0, 2, 0, 1),
  ('B', 'Foundation', 4, 2, 6, 2, 6, 0, 1),
  ('C', 'Framing', 10, 6, 16, 6, 16, 0, 1),
  ('D', 'Roofing', 6, 16, 22, 16, 22, 0, 1),
  ('E', 'Electrical Wiring', 4, 16, 20, 18, 22, 2, 0),
  ('F', 'Plumbing', 5, 16, 21, 17, 22, 1, 0),
  ('G', 'Interior Finish', 7, 22, 29, 22, 29, 0, 1);

SELECT 
  activity_id,
  name,
  duration_weeks,
  early_start,
  early_finish,
  late_start,
  late_finish,
  slack_float,
  CASE WHEN is_critical = 1 THEN 'CRITICAL ★' ELSE 'Non-Critical' END AS path_status
FROM project_activities
ORDER BY early_start ASC;`,
      explanation: `**Project Planning (CPM / PERT)**:
- **Critical Path**: $A \\to B \\to C \\to D \\to G$.
- **Total Project Duration**: $29\\text{ weeks}$.
- **Slack Times**: Activities $E$ ($2\\text{ weeks}$) and $F$ ($1\\text{ week}$) have non-zero float and can be delayed without delaying the completion date.`,
      suggestedQuestions: [
        "Calculate 3-time PERT variance and 95% completion probability",
        "Crash critical activities to reduce duration",
      ],
      isOptimizationModel: true,
      orModule: "project-planning",
    };
  }

  // 4. Operations Research: Inventory Control (EOQ)
  if (lower.includes("eoq") || lower.includes("inventory") || lower.includes("order quantity") || lower.includes("holding cost")) {
    return {
      sql: `-- Economic Order Quantity (EOQ) Inventory Optimization
CREATE TABLE IF NOT EXISTS inventory_parameters (
  annual_demand_D INTEGER,
  ordering_cost_K REAL,
  holding_cost_h REAL,
  unit_price_c REAL,
  optimal_eoq_y REAL,
  annual_ordering_cost REAL,
  annual_holding_cost REAL,
  total_annual_cost REAL
);

INSERT OR REPLACE INTO inventory_parameters VALUES (
  1000, 100.0, 2.0, 10.0,
  ROUND(SQRT((2.0 * 100.0 * 1000.0) / 2.0)),
  ROUND((100.0 * 1000.0) / 316.22, 2),
  ROUND((2.0 * 316.22) / 2.0, 2),
  ROUND(10.0 * 1000.0 + (100.0 * 1000.0) / 316.22 + (2.0 * 316.22) / 2.0, 2)
);

SELECT * FROM inventory_parameters;`,
      explanation: `**Economic Order Quantity (EOQ)**:
- **Optimal Order Size**: $y^* = \\sqrt{\\frac{2KD}{h}} = \\sqrt{\\frac{2(100)(1000)}{2}} = 316.22\\text{ units}$.
- **Optimal Cycle Time**: $t_0 = \\frac{y^*}{D} \\times 365 = 115.4\\text{ days}$.
- **Holding vs. Ordering Balance**: Annual holding cost equals annual ordering cost at optimality ($316.22$).`,
      suggestedQuestions: [
        "Calculate EOQ with planned backorder shortages",
        "Evaluate quantity discount price breaks",
      ],
      isOptimizationModel: true,
      orModule: "inventory-control",
    };
  }

  // Fallback Database Query Generator
  if (!schema || schema.tables.length === 0) {
    return {
      sql: "SELECT 1 AS status, 'No database tables loaded' AS message;",
      explanation: "No active database schema is loaded. Connect a database or import a spreadsheet.",
      suggestedQuestions: [],
    };
  }

  const primaryTable = schema.tables[0];
  const primaryName = `"${primaryTable.name}"`;

  if (lower.includes("count") || lower.includes("how many") || lower.includes("total rows")) {
    return {
      sql: `SELECT COUNT(*) AS total_count FROM ${primaryName};`,
      explanation: `Counts the total number of records in table ${primaryName}.`,
      suggestedQuestions: [
        `Show the first 10 records from ${primaryName}`,
        `Group and count records by a categorical column`,
      ],
    };
  }

  return {
    sql: `SELECT * FROM ${primaryName} LIMIT 50;`,
    explanation: `Retrieves the first 50 rows from ${primaryName}.`,
    suggestedQuestions: [
      `Count total rows in ${primaryName}`,
      `Find top 10 rows sorted descending`,
    ],
  };
}
