<div align="center">

# torsz

**The Modern Web SQL IDE, Spreadsheet Engine, Database Visualizer & Operations Research Solver**

[![Live Demo](https://img.shields.io/badge/Live_App-torsz.vercel.app-cc785c?style=for-the-badge&logo=vercel&logoColor=white)](https://torsz.vercel.app)
[![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/sauravsz/torsz/ci.yml?branch=main&style=for-the-badge&label=CI%20Build)](https://github.com/sauravsz/torsz/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-97.9%25-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-GPL--2.0-blue?style=for-the-badge)](LICENSE)

*A fast, zero-install database workspace engineered with a warm-editorial design system, client-side WebAssembly SQLite engine, interactive ER diagram visualizer, multimodal OCR vision, and 11 Operations Research mathematical optimization solvers.*

[Explore Live Demo](https://torsz.vercel.app) · [Report Issue](https://github.com/sauravsz/torsz/issues)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Visual Tour](#visual-tour)
  - [1. Query Editor & In-Place Spreadsheet Data Grid](#1-monaco-sql-worksheet--in-place-spreadsheet-data-grid)
  - [2. TORA Operations Research Suite & Interactive Graph Canvas](#2-tora-operations-research-suite)
  - [3. Multimodal OCR Paper Scanner & Problem Classifier](#3-multimodal-ocr-paper-scanner--problem-classifier)
  - [4. Interactive Schema Visualizer (ER Diagram)](#4-interactive-schema-visualizer-er-diagram)
  - [5. Minimalist AI Database & Optimization Assistant](#5-minimalist-ai-database--optimization-assistant)
- [Comprehensive Capabilities](#comprehensive-capabilities)
  - [Database & Spreadsheet Engine](#-database--spreadsheet-engine)
  - [TORA Operations Research Mathematical Solvers](#-tora-operations-research-solvers)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Local Development & Building](#local-development--building)
- [Test Suite & Quality Verification](#test-suite--quality-verification)
- [License](#license)

---

## Overview

**torsz** is a modern, zero-server-install SQL IDE and Operations Research computing harness that runs 100% in the browser. Originally inspired by the classic open-source `tora` desktop IDE, `torsz` replaces legacy desktop code with a native WebAssembly architecture (`sql.js`), Monaco Code Editor integration, and a warm cream-and-coral editorial interface.

Whether you are writing complex SQL queries, modifying database records in-place like a spreadsheet, visualizing table relationships, or solving operations research models (Simplex, Transportation, Hungarian Assignment, Dijkstra, Minimum Spanning Tree, CPM/PERT, EOQ, Queues, Game Theory, and Gauss-Jordan), **torsz** delivers instant results with zero cloud latency.

---

## Visual Tour

### 1. Monaco SQL Worksheet & In-Place Spreadsheet Data Grid
Write SQL in a customized dark-product Monaco editor with intelligent auto-completion, table introspection, and query execution. Double-click any cell in the virtualized results grid to edit values in-place with automatic `UPDATE` generation and staged commit safety.

![Query Editor and Results Grid](docs/screenshots/query-editor.png)

<br/>

### 2. TORA Operations Research Suite
Solve complex optimization problems with real-time editable cost matrices, interactive 2D graphical constraint canvases, step-by-step Simplex tableaus, Vogel's VAM transportation, Hungarian task assignment, and network flow optimization with Edmonds-Karp Max-Flow / Min-Cut partitioning.

![TORA Operations Research Suite](docs/screenshots/tora-solvers.png)

<br/>

### 3. Multimodal OCR Paper Scanner & Problem Classifier
Upload or paste photos of textbook questions, exam problems, cost matrices, or network topologies. The OCR vision engine transcribes problem statements, classifies the mathematical model, and populates the appropriate solver in 1 click.

![OCR Question Scanner Modal](docs/screenshots/ocr-scanner.png)

<br/>

### 4. Interactive Schema Visualizer (ER Diagram)
Inspect foreign key relationships, primary key constraints, and column data types across an interactive canvas with zoom controls, table dragging, and relationship path highlighting.

![Schema Visualizer ER Diagram](docs/screenshots/schema-visualizer.png)

<br/>

### 5. Minimalist AI Database & Optimization Assistant
Ask questions about your schema or formulate operations research models in natural language. `torsz` translates plain-English prompts into accurate SQL queries and mathematical formulations with 1-click execution.

![AI SQL Assistant](docs/screenshots/ai-assistant.png)

---

## Comprehensive Capabilities

### 🗄️ Database & Spreadsheet Engine
* **In-Browser WebAssembly SQLite (`sql.js`)**: Execute raw SQL queries, create schemas, and run transactions in-memory with zero server setup.
* **In-Place Double-Click Spreadsheet Editing**: Edit cells directly in the query results table. Changes are staged and committed via generated SQL transactions.
* **Context-Aware Left Sidebar**: Full table and view hierarchy with column types, primary key badges, search filtering, and 1-click `SELECT` query builders.
* **Interactive ER Diagram Canvas**: Real-time Entity-Relationship visualizer with draggable table nodes, primary/foreign key mappings, and zoom/pan navigation.
* **Spreadsheet & DB Importer**: 1-click import for `.csv`, `.xlsx`, `.xls`, and `.tsv` files directly into SQLite tables.
* **Full Database Export**: Export entire in-browser databases as `.sqlite` binary files or query results as CSV.

### 📐 TORA Operations Research Solvers
* **Linear Programming (Simplex & 2D Graphical)**:
  * Interactive 2D graphical constraint canvas with feasible region shading and optimal corner-point detection.
  * Step-by-step Simplex tableau generator with entering/leaving variable highlights and pivot element calculations.
  * Big-M and two-phase artificial variable simplex support for $\ge$ and $=$ constraints.
  * Dual shadow prices and multi-scenario sensitivity sweep analysis.
* **Transportation Models**:
  * Vogel's Approximation Method (VAM), Least Cost Method, and Northwest Corner rule.
  * Automatic balancing with dummy source/destination supply-demand balancing.
* **Hungarian Assignment Model**:
  * Optimal $N \times N$ worker-to-job assignment with row/column reduction matrix tracking.
* **Network Models**:
  * **Shortest Route (Dijkstra)**: Minimum cost/distance path between any two vertices with step-by-step sequence tracking.
  * **Minimum Spanning Tree (MST)**: Kruskal's greedy algorithm with cycle detection (Union-Find) connecting all nodes at minimum cost.
  * **Maximal Flow (Edmonds-Karp)**: Augmenting path BFS with residual capacity tracking, individual arc utilization breakdown ($f_{uv} / c_{uv}$), and Min-Cut partition theorem ($S, T$).
  * **Interactive SVG Graph Canvas**: Visual node positioning, circular layout distribution, and coral highlighted solution arcs.
* **Project Planning (CPM / PERT)**:
  * Critical Path Method (CPM) calculating Earliest Start (ES), Earliest Finish (EF), Latest Start (LS), Latest Finish (LF), and Total Slack.
  * PERT 3-time estimate calculations ($a, m, b$) with variance and critical path identification.
* **Inventory Control (EOQ)**:
  * Classic Economic Order Quantity ($Q^*$), annual holding cost, ordering cost, and total inventory curves.
  * Quantity discount break-point analysis and backorder models.
* **Queuing Analysis**:
  * Kendall notation models ($M/M/1$, $M/M/c$, $M/M/1/K$, and $M/M/c/K$ finite capacity systems).
  * System metrics: $L$ (average in system), $L_q$ (average in queue), $W$ (wait time in system), $W_q$ (wait time in queue), and $\rho$ (server utilization).
* **Zero-Sum Game Theory**:
  * Matrix games with row minima, column maxima, Minimax/Maximin criteria, and pure saddle-point verification.
* **Linear Equations ($Ax = b$)**:
  * Simultaneous linear system solver with Gauss-Jordan row elimination.

---

## Architecture & Tech Stack

```
torsz/
├── src/
│   ├── components/            # React UI Components
│   │   ├── AiAssistant.tsx    # Minimalist AI Chat & Prompt Canvas
│   │   ├── ErDiagram.tsx      # Interactive Schema Visualizer (SVG)
│   │   ├── NetworkGraphCanvas.tsx # Visual Network Topology Graph
│   │   ├── OcrUploadModal.tsx # Multimodal Vision & OCR Problem Scanner
│   │   ├── OrSuiteView.tsx    # 11 TORA Operations Research Solver Views
│   │   ├── ResultsTable.tsx   # Virtualized Spreadsheet Results Grid
│   │   ├── Sidebar.tsx        # Context-Aware Left Schema & Solver Navigation
│   │   ├── SqlEditor.tsx      # Monaco Code Editor with Dark Product Theme
│   │   └── TopNav.tsx         # Unified Top Navigation Bar
│   ├── services/
│   │   ├── db.ts              # SQLite WebAssembly (sql.js) Engine
│   │   ├── ocr.ts             # OCR & AI Problem Classification
│   │   ├── aiAssistant.ts     # Natural Language SQL & OR Generation
│   │   ├── theme.ts           # Warm Cream & Dark Theme State Engine
│   │   └── or/                # Mathematical Solvers
│   │       ├── solvers.ts     # Pure TS Algorithms (Simplex, VAM, MST, Max-Flow, CPM, EOQ)
│   │       ├── types.ts       # Mathematical & Network Type Definitions
│   │       └── exporter.ts    # LaTeX, Excel, and Executive Report Exporters
│   ├── App.tsx                # Master Application Layout & View Controller
│   └── main.tsx               # Application Entry Point
```

* **Frontend**: React 18, TypeScript 5.x, Vite 6, Tailwind CSS
* **Code Editor**: `@monaco-editor/react` with custom warm-dark editorial syntax theme
* **Database Engine**: `sql.js` (SQLite WASM compiled with Emscripten)
* **Mathematical Solvers**: Pure deterministic TypeScript with zero heavy external math dependencies
* **Icons & Typography**: Lucide React, Copernicus / Tiempos Headline serif, StyreneB / Inter sans, JetBrains Mono

---

## Local Development & Building

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/) (recommended)

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/sauravsz/torsz.git
cd torsz

# Install dependencies
bun install   # or npm install

# Start development server
bun run dev   # or npm run dev
```

Open [http://localhost:1420](http://localhost:1420) in your browser.

### Production Build

```bash
bun run build # or npm run build
```

---

## Test Suite & Quality Verification

`torsz` maintains a deterministic test suite covering database execution, spreadsheet parsing, and all 11 Operations Research mathematical algorithms:

```bash
bun test
```

```
✓ Simplex Tableau Pivoting & Corner Points
✓ Vogel's Approximation Method (VAM) Transportation
✓ Hungarian Assignment Algorithm Matrix Reductions
✓ Dijkstra Shortest Path Finding
✓ Kruskal Minimum Spanning Tree (MST)
✓ Edmonds-Karp Maximal Flow & Min-Cut Partition Theorem
✓ CPM / PERT Project Planning & Slack Calculations
✓ EOQ Inventory Optimization & Quantity Discounts
✓ M/M/1 and Multi-Server Queuing Analysis
✓ Zero-Sum Saddle Point Game Theory
✓ Gauss-Jordan Linear Equation Solver
```

---

## License

This project is licensed under the [GNU General Public License v2.0 (GPL-2.0)](LICENSE).
