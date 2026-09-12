export interface ColumnInfo {
  name: string;
  data_type: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: unknown[][];
  execution_time_ms: number;
  affected_rows?: number | null;
  error?: string | null;
}

export interface ForeignKeySchema {
  from_column: string;
  to_table: string;
  to_column: string;
}

export interface ColumnSchema {
  name: string;
  data_type: string;
  is_primary_key: boolean;
  is_nullable: boolean;
  default_value?: string | null;
}

export interface TableSchema {
  name: string;
  table_type: "table" | "view";
  columns: ColumnSchema[];
  foreign_keys: ForeignKeySchema[];
}

export interface DatabaseSchema {
  database_name: string;
  tables: TableSchema[];
}

export interface ConnectionConfig {
  id: string;
  name: string;
  driver: "sqlite" | "postgres" | "mysql";
  filepath?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}
