import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { ConnectionConfig, DatabaseSchema, QueryResult, TableSchema, ColumnSchema, ForeignKeySchema } from "../types";
import { saveDatabaseToStorage, loadDatabaseFromStorage, clearDatabaseFromStorage } from "./storage";

let webDbInstance: SqlJsDatabase | null = null;
let sqlJsStatic: SqlJsStatic | null = null;
let currentWebDbName = "Sample Store DB (SQLite)";
async function getSqlJsEngine(): Promise<SqlJsStatic> {
  if (sqlJsStatic) return sqlJsStatic;
  try {
    sqlJsStatic = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
    return sqlJsStatic;
  } catch (err) {
    console.warn("Local WASM load failed, falling back to CDN:", err);
    sqlJsStatic = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
    });
    return sqlJsStatic;
  }
}

export async function getWebSqlite(): Promise<SqlJsDatabase> {
  if (!webDbInstance) {
    const SQL = await getSqlJsEngine();
    const stored = await loadDatabaseFromStorage();
    if (stored && stored.bytes.length > 0) {
      webDbInstance = new SQL.Database(stored.bytes);
      currentWebDbName = stored.name;
    } else {
      webDbInstance = new SQL.Database();
      initSampleWebSchema(webDbInstance);
      await persistCurrentDatabase();
    }
  }
  return webDbInstance;
}

export async function persistCurrentDatabase(): Promise<void> {
  if (webDbInstance) {
    try {
      const bytes = webDbInstance.export();
      await saveDatabaseToStorage(bytes, currentWebDbName);
    } catch (e) {
      console.warn("Auto-save failed:", e);
    }
  }
}
export function setDatabaseName(name: string) {
  currentWebDbName = name;
}
export async function exportDatabaseBinary(): Promise<{ bytes: Uint8Array; filename: string }> {
  const db = await getWebSqlite();
  const bytes = db.export();
  let filename = currentWebDbName.endsWith(".sqlite") || currentWebDbName.endsWith(".db")
    ? currentWebDbName
    : `${currentWebDbName.replace(/[^a-zA-Z0-9_-]/g, "_")}.sqlite`;
  return { bytes, filename };
}


export function cleanWorkspaceForImport() {
  if (webDbInstance) {
    const sampleTables = ["categories", "customers", "order_items", "orders", "products"];
    for (const t of sampleTables) {
      try {
        webDbInstance.run(`DROP TABLE IF EXISTS "${t}";`);
      } catch {}
    }
  }
}

function initSampleWebSchema(db: SqlJsDatabase) {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        city TEXT,
        country TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES customers(id),
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'completed',
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL
    );

    INSERT OR IGNORE INTO categories (id, name, description) VALUES
        (1, 'Electronics', 'Phones, tablets, accessories'),
        (2, 'Apparel', 'Clothing and footwear'),
        (3, 'Home & Kitchen', 'Appliances and cookware');

    INSERT OR IGNORE INTO products (id, name, category_id, price, stock) VALUES
        (1, 'Mechanical Keyboard', 1, 129.99, 45),
        (2, '4K Ultra HD Monitor', 1, 399.00, 18),
        (3, 'Noise-Canceling Headphones', 1, 249.50, 32),
        (4, 'Merino Wool Sweater', 2, 89.00, 60),
        (5, 'Espresso Machine', 3, 599.99, 12);

    INSERT OR IGNORE INTO customers (id, full_name, email, city, country) VALUES
        (1, 'Alex Rivera', 'alex@example.com', 'San Francisco', 'USA'),
        (2, 'Sarah Chen', 'sarah.chen@example.com', 'Toronto', 'Canada'),
        (3, 'Marcus Vance', 'marcus@example.com', 'London', 'UK'),
        (4, 'Elena Rostova', 'elena@example.com', 'Berlin', 'Germany');

    INSERT OR IGNORE INTO orders (id, customer_id, total_amount, status) VALUES
        (1, 1, 528.99, 'completed'),
        (2, 2, 249.50, 'processing'),
        (3, 3, 688.99, 'completed'),
        (4, 4, 89.00, 'shipped');

    INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
        (1, 1, 1, 1, 129.99),
        (2, 1, 2, 1, 399.00),
        (3, 2, 3, 1, 249.50),
        (4, 3, 4, 1, 89.00),
        (5, 3, 5, 1, 599.99),
        (6, 4, 4, 1, 89.00);
  `;
  db.run(schemaSql);
}

export async function connectDatabase(config: ConnectionConfig): Promise<string> {
  currentWebDbName = config.name;
  await getWebSqlite();
  return config.id;
}

export async function disconnectDatabase(_connectionId: string): Promise<void> {
  // Reset active database
}

export async function executeQuery(_connectionId: string, sql: string): Promise<QueryResult> {
  const db = await getWebSqlite();
  const startTime = performance.now();

  try {
    // Execute SQL query
    const execResults = db.exec(sql);
    const executionTime = Math.round(performance.now() - startTime);

    // Persist changes if statement is DDL or DML
    const upper = sql.trim().toUpperCase();
    if (
      upper.includes("CREATE") ||
      upper.includes("INSERT") ||
      upper.includes("UPDATE") ||
      upper.includes("DELETE") ||
      upper.includes("DROP") ||
      upper.includes("ALTER") ||
      upper.includes("REPLACE")
    ) {
      await persistCurrentDatabase();
    }

    if (execResults.length > 0) {
      // Return the final SELECT result set from the batch
      const lastRes = execResults[execResults.length - 1];
      const columns = lastRes.columns.map((name) => ({
        name,
        data_type: "ANY",
      }));

      return {
        columns,
        rows: lastRes.values,
        execution_time_ms: executionTime,
        affected_rows: null,
      };
    } else {
      const affectedRows = db.getRowsModified();
      return {
        columns: [],
        rows: [],
        execution_time_ms: executionTime,
        affected_rows: affectedRows,
      };
    }
  } catch (err: unknown) {
    const executionTime = Math.round(performance.now() - startTime);
    return {
      columns: [],
      rows: [],
      execution_time_ms: executionTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

export async function resetToFreshSampleDatabase(): Promise<ConnectionConfig> {
  await clearDatabaseFromStorage();
  const SQL = await getSqlJsEngine();
  webDbInstance = new SQL.Database();
  initSampleWebSchema(webDbInstance);
  currentWebDbName = "Sample Store DB (SQLite WASM)";
  await persistCurrentDatabase();

  return {
    id: "sample-sqlite-web",
    name: "Sample Store DB (SQLite WASM)",
    driver: "sqlite",
    database: "sample_store.sqlite",
  };
}

export async function getDatabaseSchema(_connectionId: string): Promise<DatabaseSchema> {
  const db = await getWebSqlite();
  const tableRes = db.exec(
    "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );

  const tables: TableSchema[] = [];

  if (tableRes.length > 0 && tableRes[0].values) {
    for (const row of tableRes[0].values) {
      const tableName = String(row[0]);
      const tableType = String(row[1]) as "table" | "view";

      const columns: ColumnSchema[] = [];
      const foreignKeys: ForeignKeySchema[] = [];

      // Columns via PRAGMA
      const colRes = db.exec(`PRAGMA table_info("${tableName}")`);
      if (colRes.length > 0 && colRes[0].values) {
        for (const colRow of colRes[0].values) {
          const colName = String(colRow[1]);
          const dataType = String(colRow[2]) || "TEXT";
          const notNull = Number(colRow[3]) === 1;
          const defaultVal = colRow[4] !== null ? String(colRow[4]) : null;
          const isPk = Number(colRow[5]) > 0;

          columns.push({
            name: colName,
            data_type: dataType,
            is_primary_key: isPk,
            is_nullable: !notNull,
            default_value: defaultVal,
          });
        }
      }

      // Foreign Keys via PRAGMA
      const fkRes = db.exec(`PRAGMA foreign_key_list("${tableName}")`);
      if (fkRes.length > 0 && fkRes[0].values) {
        for (const fkRow of fkRes[0].values) {
          const toTable = String(fkRow[2]);
          const fromCol = String(fkRow[3]);
          const toCol = String(fkRow[4]);

          foreignKeys.push({
            from_column: fromCol,
            to_table: toTable,
            to_column: toCol,
          });
        }
      }

      tables.push({
        name: tableName,
        table_type: tableType,
        columns,
        foreign_keys: foreignKeys,
      });
    }
  }

  return {
    database_name: currentWebDbName,
    tables,
  };
}

export async function testConnection(config: ConnectionConfig): Promise<boolean> {
  if (config.driver === "sqlite") return true;
  throw new Error("Direct TCP connection to remote Postgres/MySQL requires a backend server. In the web version, use SQLite or CSV/Excel.");
}

export async function createSampleDatabase(): Promise<ConnectionConfig> {
  currentWebDbName = "Sample Store DB (SQLite WASM)";
  const SQL = await getSqlJsEngine();
  webDbInstance = new SQL.Database();
  initSampleWebSchema(webDbInstance);

  return {
    id: "sample-sqlite-web",
    name: "Sample Store DB (SQLite WASM)",
    driver: "sqlite",
    database: "sample_store.sqlite",
  };
}

export async function loadDatabaseFromFile(file: File): Promise<ConnectionConfig> {
  const arrayBuffer = await file.arrayBuffer();
  const SQL = await getSqlJsEngine();
  webDbInstance = new SQL.Database(new Uint8Array(arrayBuffer));
  currentWebDbName = file.name;

  return {
    id: `web_db_${Date.now()}`,
    name: file.name,
    driver: "sqlite",
    filepath: file.name,
  };
}
