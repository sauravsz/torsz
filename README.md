<div align="center">

# torsz

**In-Browser SQL IDE, Spreadsheet Grid & Operations Research Suite**

[![Live Demo](https://img.shields.io/badge/Live_App-torsz.vercel.app-cc785c?style=for-the-badge&logo=vercel&logoColor=white)](https://torsz.vercel.app)
[![CI Build](https://img.shields.io/github/actions/workflow/status/sauravsz/torsz/ci.yml?branch=main&style=for-the-badge&label=CI%20Build)](https://github.com/sauravsz/torsz/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-97.9%25-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-GPL--2.0-blue?style=for-the-badge)](LICENSE)

*A zero-install workspace combining client-side WebAssembly SQLite, spreadsheet data editing, interactive schema visualization, multimodal OCR, and 11 Operations Research solvers.*

[Open App](https://torsz.vercel.app) · [Report Issue](https://github.com/sauravsz/torsz/issues)

</div>

---

## Visual Tour

### 1. Monaco SQL Worksheet & In-Place Spreadsheet Data Grid
Write SQL in a customized dark-product Monaco editor with auto-completion and table introspection. Double-click any cell in the results table to edit values in-place with staged commit safety.

![Query Editor and Results Grid](docs/screenshots/query-editor.png)

<br/>

### 2. TORA Operations Research Suite
Solve optimization problems with real-time editable cost matrices, interactive 2D graphical constraint canvases, step-by-step Simplex tableaus, Vogel's VAM transportation, Hungarian assignment, and Edmonds-Karp Max-Flow / Min-Cut partitioning.

![TORA Operations Research Suite](docs/screenshots/tora-solvers.png)

<br/>

### 3. Multimodal OCR Paper Scanner & Problem Classifier
Upload or paste photos of textbook questions, exam problems, cost matrices, or network topologies. The OCR engine transcribes problem statements, classifies the mathematical model, and populates the appropriate solver in 1 click.

![OCR Question Scanner Modal](docs/screenshots/ocr-scanner.png)

<br/>

### 4. Interactive Schema Visualizer (ER Diagram)
Inspect foreign key relationships, primary keys, and column data types across an interactive canvas with zoom controls, table dragging, and relationship path highlighting.

![Schema Visualizer ER Diagram](docs/screenshots/schema-visualizer.png)

<br/>

### 5. Minimalist AI Database & Optimization Assistant
Ask questions about your schema or formulate operations research models in natural language. `torsz` translates plain-English prompts into accurate SQL queries and mathematical formulations.

![AI SQL Assistant](docs/screenshots/ai-assistant.png)

---

## Features

### Database & Spreadsheet Engine
* **WebAssembly SQLite (`sql.js`)**: In-browser relational engine with IndexedDB persistence across refreshes.
* **In-Place Cell Editing**: Double-click any cell in the results grid to edit values with auto-generated `UPDATE` statements.
* **Schema Visualizer**: Real-time ER diagram with draggable nodes and foreign-key path highlighting.
* **Data Import & Export**: 1-click import for `.csv`, `.xlsx`, and `.tsv` files; export databases as `.sqlite` binaries or query results as CSV.
* **Monaco SQL Editor**: Multi-tab worksheets, query plan explain profiler, and built-in SQL query formatting (`⇧⌥F`).

### 11 Operations Research Solvers
1. **Linear Programming**: 2D graphical constraint canvas and step-by-step Simplex tableaus with unbounded ray detection.
2. **Transportation (VAM)**: Vogel's Approximation Method with automatic unbalanced supply/demand dummy nodes.
3. **Hungarian Assignment**: Minimum/maximum worker-to-job matching with matrix reduction steps.
4. **Shortest Route**: Dijkstra's algorithm with node sequence and distance breakdown.
5. **Minimum Spanning Tree (MST)**: Kruskal's greedy algorithm with cycle detection (Union-Find).
6. **Maximal Flow**: Edmonds-Karp augmenting paths with residual capacity tracking and Min-Cut ($S, T$) partition.
7. **Project Planning (CPM / PERT)**: Critical path identification, float/slack calculations, and 3-time estimate variance.
8. **Inventory Control (EOQ)**: Economic Order Quantity with planned backorders and quantity discount tiers.
9. **Queuing Analysis**: $M/M/1$, $M/M/c$, and finite-capacity $M/M/c/K$ waiting-line models.
10. **Zero-Sum Game Theory**: Payoff matrices, Minimax/Maximin criteria, and pure saddle-point verification.
11. **Linear Equations ($Ax = b$)**: Simultaneous system solver using Gauss-Jordan row elimination with partial pivoting.

---

## Quick Start

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

```bash
# Run test suite
bun test

# Build for production
bun run build
```

---

## Built With

### Core Technologies & Libraries
* **[React 18](https://react.dev/)** & **[TypeScript 5](https://www.typescriptlang.org/)**: Type-safe reactive component architecture.
* **[Vite 6](https://vite.dev/)**: Next-generation frontend build tooling and HMR dev server.
* **[sql.js](https://github.com/sql-js/sql.js)**: SQLite relational database engine compiled to WebAssembly via Emscripten for zero-install, in-browser SQL execution.
* **[Monaco Editor](https://github.com/microsoft/monaco-editor)** (`@monaco-editor/react`): The code editor powering VS Code with custom syntax highlighting, SQL intellisense, and query execution.
* **[Tesseract.js](https://github.com/naptha/tesseract.js)**: Client-side WebAssembly OCR engine for multi-language question transcription directly in the browser.
* **[SheetJS / xlsx](https://github.com/SheetJS/sheetjs)**: Spreadsheet parser and generator for `.xlsx`, `.xls`, `.csv`, and `.tsv` data import/export.
* **[PapaParse](https://www.papaparse.com/)**: Fast, in-browser CSV streaming and parsing with delimiter auto-detection.
* **[heic2any](https://github.com/alexcorvi/heic2any)**: Client-side Apple HEIC/HEIF image decoder for mobile photo uploads.
* **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first styling with custom dark warm-editorial design tokens (`clsx`, `tailwind-merge`).
* **[Lucide Icons](https://lucide.dev/)**: Clean icon system for UI controls and navigation.

---

## Acknowledgements & Foundations

`torsz` is deeply inspired by and builds upon the foundational work of several landmark open-source projects and Operations Research texts:

### Open-Source Foundations
* **[tora-tool/tora](https://github.com/tora-tool/tora)**: The pioneering open-source C++/Qt multi-database SQL IDE that established desktop database management workflows.
* **[sql-js/sql.js](https://github.com/sql-js/sql.js)**: Bringing full ACID relational database capabilities to the browser via WebAssembly.
* **[RouteIQ](https://github.com/sauravsz/RouteIQ)**: Supply chain optimization and multi-scenario transportation network modeling foundations.

### Operations Research & Mathematical Formulations
* **[Hamdy A. Taha — *Operations Research: An Introduction* (Pearson)](https://www.pearson.com/)**: Algorithmic foundations for the TORA optimization suite (Two-Phase Simplex, Vogel's Approximation Method, MODI stepping-stone method, Dijkstra's algorithm, and queuing theory).
* **[Frederick S. Hillier & Gerald J. Lieberman — *Introduction to Operations Research* (McGraw-Hill)](https://www.mheducation.com/)**: Mathematical formulations for network models, 2D graphical LP convex geometry, and game-theoretic dual linear programming.
* **[Nagraj Balakrishnan, Barry Render, Ralph M. Stair — *Managerial Decision Modeling* (Pearson)](https://www.pearson.com/)**: Practical business benchmarks for CPM/PERT project crashing, inventory control (Planned Backorders, EPQ, Quantity Discounts), and goal programming.
* **[Roy Jonker & Ton Volgenant (1987)](https://doi.org/10.1007/BF02278710)**: The $O(N^3)$ shortest augmenting path algorithm for linear assignment problems.
* **[Jack Edmonds & Richard M. Karp (1972)](https://doi.org/10.1145/321694.321699)**: The BFS augmenting path algorithm for network maximal flow and Min-Cut partitioning.

## License

Licensed under the [GNU General Public License v2.0 (GPL-2.0)](LICENSE).
