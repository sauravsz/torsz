import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Statement as SqlJsStatement, SqlValue } from "sql.js";
import { getWebSqlite, persistCurrentDatabase } from "./db";

export interface ImportResult {
  tableName: string;
  rowCount: number;
  columns: string[];
}

function sanitizeIdentifier(name: string): string {
  const sanitized = name.trim().replace(/[^a-zA-Z0-9_]/g, "_");
  if (/^[0-9]/.test(sanitized)) {
    return `col_${sanitized}`;
  }
  return sanitized || "col";
}

function inferSqlType(values: unknown[]): string {
  let hasNumber = false;
  let hasFloat = false;
  let hasText = false;

  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number") {
      hasNumber = true;
      if (!Number.isInteger(v)) hasFloat = true;
    } else if (typeof v === "boolean") {
      hasNumber = true;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      if (!isNaN(Number(trimmed)) && trimmed !== "") {
        hasNumber = true;
        if (trimmed.includes(".")) hasFloat = true;
      } else {
        hasText = true;
      }
    } else {
      hasText = true;
    }
  }

  if (hasText) return "TEXT";
  if (hasFloat) return "REAL";
  if (hasNumber) return "INTEGER";
  return "TEXT";
}

function formatValueForSql(val: unknown, type: string): SqlValue {
  if (val === null || val === undefined || val === "" || val === "NULL" || val === "null") {
    return null;
  }
  if (type === "INTEGER") {
    const n = parseInt(String(val).replace(/,/g, ""), 10);
    return isNaN(n) ? null : n;
  }
  if (type === "REAL") {
    const f = parseFloat(String(val).replace(/,/g, ""));
    return isNaN(f) ? null : f;
  }
  return String(val);
}

export async function importSpreadsheetToDb(
  _connectionId: string,
  file: File,
  customTableName?: string
): Promise<ImportResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const db = await getWebSqlite();

  // Derive sanitized table name
  const baseName = customTableName || file.name.replace(/\.[^/.]+$/, "");
  let tableName = sanitizeIdentifier(baseName);
  if (!tableName) tableName = "imported_data";

  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    return new Promise((resolve, reject) => {
      let isHeader = true;
      let rawHeaderCols: string[] = [];
      let sanitizedCols: { original: string; sanitized: string; type: string }[] = [];
      let sampleRows: unknown[][] = [];
      let totalInserted = 0;
      let preparedStmt: SqlJsStatement | null = null;
      let isTableCreated = false;

      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: false,
        chunkSize: 1024 * 1024 * 2, // 2MB stream chunks
        chunk: (results, parser) => {
          try {
            const rows = results.data as unknown[][];
            if (rows.length === 0) return;

            let rowStartIdx = 0;

            if (isHeader) {
              rawHeaderCols = (rows[0] as string[]).map((c) => String(c || ""));
              isHeader = false;
              rowStartIdx = 1;

              // Collect sample for type inference
              sampleRows = rows.slice(1, Math.min(rows.length, 100));

              for (let c = 0; c < rawHeaderCols.length; c++) {
                const orig = rawHeaderCols[c] || `col_${c + 1}`;
                const sanitized = sanitizeIdentifier(orig);
                const colSamples = sampleRows.map((r) => r[c]);
                const type = inferSqlType(colSamples);
                sanitizedCols.push({ original: orig, sanitized, type });
              }

              // Create Table DDL
              const colDefs = sanitizedCols
                .map((c) => `"${c.sanitized}" ${c.type}`)
                .join(",\n  ");

              db.run(`DROP TABLE IF EXISTS "${tableName}";`);
              db.run(`CREATE TABLE "${tableName}" (\n  ${colDefs}\n);`);
              db.run("BEGIN TRANSACTION;");

              const placeholders = sanitizedCols.map(() => "?").join(", ");
              const colNamesSql = sanitizedCols.map((c) => `"${c.sanitized}"`).join(", ");
              preparedStmt = db.prepare(`INSERT INTO "${tableName}" (${colNamesSql}) VALUES (${placeholders});`);
              isTableCreated = true;
            }

            if (!isTableCreated || !preparedStmt) return;

            // Fast Insertion Loop
            for (let i = rowStartIdx; i < rows.length; i++) {
              const row = rows[i];
              if (!row || row.length === 0) continue;

              const bindValues: SqlValue[] = [];
              for (let c = 0; c < sanitizedCols.length; c++) {
                const rawVal = row[c];
                bindValues.push(formatValueForSql(rawVal, sanitizedCols[c].type));
              }

              preparedStmt.run(bindValues);
              totalInserted++;
            }
          } catch (err) {
            parser.abort();
            try {
              if (preparedStmt) preparedStmt.free();
              db.run("ROLLBACK;");
            } catch {}
            reject(err);
          }
        },
        complete: async () => {
          try {
            if (preparedStmt) {
              preparedStmt.free();
            }
            db.run("COMMIT;");
            await persistCurrentDatabase();

            resolve({
              tableName,
              rowCount: totalInserted,
              columns: sanitizedCols.map((c) => c.sanitized),
            });
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => {
          try {
            if (preparedStmt) preparedStmt.free();
            db.run("ROLLBACK;");
          } catch {}
          reject(err);
        },
      });
    });
  } else if (ext === "xlsx" || ext === "xls" || ext === "ods") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", dense: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
    });

    if (rawRows.length < 2) {
      throw new Error("The selected Excel sheet contains no tabular data rows.");
    }

    const rawHeaderCols = (rawRows[0] as string[]).map((c) => String(c || ""));
    const sanitizedCols: { original: string; sanitized: string; type: string }[] = [];
    const sampleRows = rawRows.slice(1, Math.min(rawRows.length, 100));

    for (let c = 0; c < rawHeaderCols.length; c++) {
      const orig = rawHeaderCols[c] || `col_${c + 1}`;
      const sanitized = sanitizeIdentifier(orig);
      const colSamples = sampleRows.map((r) => r[c]);
      const type = inferSqlType(colSamples);
      sanitizedCols.push({ original: orig, sanitized, type });
    }

    const colDefs = sanitizedCols
      .map((c) => `"${c.sanitized}" ${c.type}`)
      .join(",\n  ");

    db.run(`DROP TABLE IF EXISTS "${tableName}";`);
    db.run(`CREATE TABLE "${tableName}" (\n  ${colDefs}\n);`);
    db.run("BEGIN TRANSACTION;");

    const placeholders = sanitizedCols.map(() => "?").join(", ");
    const colNamesSql = sanitizedCols.map((c) => `"${c.sanitized}"`).join(", ");
    const stmt = db.prepare(`INSERT INTO "${tableName}" (${colNamesSql}) VALUES (${placeholders});`);

    let totalInserted = 0;
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const bindValues: SqlValue[] = [];
      for (let c = 0; c < sanitizedCols.length; c++) {
        const rawVal = row[c];
        bindValues.push(formatValueForSql(rawVal, sanitizedCols[c].type));
      }

      stmt.run(bindValues);
      totalInserted++;
    }

    stmt.free();
    db.run("COMMIT;");
    await persistCurrentDatabase();

    return {
      tableName,
      rowCount: totalInserted,
      columns: sanitizedCols.map((c) => c.sanitized),
    };
  } else {
    throw new Error(`Unsupported spreadsheet format: .${ext}. Please use .csv, .xlsx, or .xls`);
  }
}
