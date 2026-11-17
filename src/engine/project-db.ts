import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getWorkspacesRoot } from "./workspace";

export interface SqliteStatement {
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface SqliteModule {
  DatabaseSync: new (location: string) => SqliteDatabase;
}

export interface TableColumn {
  name: string;
  type: string;
  pk: number;
  notNull: number;
  defaultValue: unknown;
}

export interface TableSnapshot {
  columns: TableColumn[];
  keyName: string;
  rows: Map<string, Record<string, unknown>>;
}

export interface DatabaseChange {
  table: string;
  id: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
}

const TABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

function getSqliteModule(): SqliteModule {
  const getter = (
    process as unknown as {
      getBuiltinModule?: (id: string) => unknown;
    }
  ).getBuiltinModule;

  if (typeof getter === "function") {
    try {
      const mod = getter.call(process, "node:sqlite") as SqliteModule;
      if (mod?.DatabaseSync) return mod;
    } catch {
      // Fall through
    }
  }

  // Dynamic require fallback for Node runtime
  const req = (globalThis as unknown as { require?: (id: string) => unknown }).require;
  if (typeof req === "function") {
    return req("node:sqlite") as SqliteModule;
  }

  throw new Error("Le module natif node:sqlite n'est pas disponible dans ce runtime.");
}

const globalForProjectDb = globalThis as unknown as {
  __fayaProjectDatabases?: Map<string, SqliteDatabase>;
  __fayaProjectSchemaVersions?: Map<string, number>;
};

const openDatabases =
  globalForProjectDb.__fayaProjectDatabases ??
  (globalForProjectDb.__fayaProjectDatabases = new Map());
const appliedSchemaVersions =
  globalForProjectDb.__fayaProjectSchemaVersions ??
  (globalForProjectDb.__fayaProjectSchemaVersions = new Map());

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      current += char;

      if (char === quote) {
        if (input[index + 1] === quote) {
          current += input[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current);
  return parts;
}

function extractCreateTables(
  schema: string,
): Array<{ table: string; body: string }> {
  const pattern =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))\s*\(/gi;
  const tables: Array<{ table: string; body: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(schema)) !== null) {
    const table = match[1] ?? match[2] ?? match[3] ?? match[4];
    let index = pattern.lastIndex;
    let depth = 1;
    let quote: string | null = null;
    const start = index;

    while (index < schema.length && depth > 0) {
      const char = schema[index];

      if (quote) {
        if (char === quote) {
          if (schema[index + 1] === quote) index += 1;
          else quote = null;
        }
      } else if (char === "'" || char === '"' || char === "`") {
        quote = char;
      } else if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
      }

      index += 1;
    }

    tables.push({ table, body: schema.slice(start, index - 1) });
    pattern.lastIndex = index;
  }

  return tables;
}

/**
 * Adds columns introduced by a regenerated schema. CREATE TABLE IF NOT EXISTS
 * covers new tables; this covers new fields on existing tables.
 */
export function syncSchemaColumns(
  database: SqliteDatabase,
  schema: string,
): number {
  let added = 0;

  for (const { table, body } of extractCreateTables(schema)) {
    if (!TABLE_PATTERN.test(table)) continue;

    const existing = new Set(
      listTableColumns(database, table).map((column) =>
        column.name.toLowerCase(),
      ),
    );

    for (const definition of splitTopLevel(body)) {
      const trimmed = definition.trim();

      if (!trimmed) continue;
      if (
        /^(primary|unique|check|foreign|constraint)\b/i.test(trimmed)
      ) {
        continue;
      }
      if (/primary\s+key|unique/i.test(trimmed)) continue;

      const match = /^(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][A-Za-z0-9_]*))\s+([\s\S]+)$/.exec(
        trimmed,
      );
      const name = match?.[1] ?? match?.[2] ?? match?.[3] ?? match?.[4];
      const rest = match?.[5];

      if (!name || !rest) continue;
      if (existing.has(name.toLowerCase())) continue;
      if (/not\s+null/i.test(rest) && !/default/i.test(rest)) continue;

      try {
        database.exec(
          `ALTER TABLE ${quoteIdentifier(table)} ADD COLUMN ${quoteIdentifier(name)} ${rest}`,
        );
        existing.add(name.toLowerCase());
        added += 1;
      } catch (error) {
        console.warn(
          `[project-db] Could not add column ${table}.${name}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  return added;
}

async function applySchema(
  projectId: string,
  workspaceRoot: string,
  database: SqliteDatabase,
) {
  const schemaPath = path.join(workspaceRoot, "desktop-schema.sql");
  let info;

  try {
    info = await stat(schemaPath);
  } catch {
    return;
  }

  if (appliedSchemaVersions.get(projectId) === info.mtimeMs) {
    return;
  }

  const schema = await readFile(schemaPath, "utf8").catch(() => "");

  if (!schema.trim()) return;

  try {
    database.exec(schema);
  } catch (error) {
    // Keep the database usable and surface the problem in server logs.
    console.warn(
      `[project-db] Could not apply desktop-schema.sql for ${projectId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const added = syncSchemaColumns(database, schema);
    if (added > 0) {
      console.info(
        `[project-db] Added ${added} column(s) to ${projectId}.`,
      );
    }
  } catch (error) {
    console.warn(
      `[project-db] Could not synchronize columns for ${projectId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  appliedSchemaVersions.set(projectId, info.mtimeMs);
}

export async function getProjectDatabase(projectId: string): Promise<SqliteDatabase> {
  const workspaceRoot = path.join(getWorkspacesRoot(), projectId);
  const cached = openDatabases.get(projectId);

  if (cached) {
    // Pick up a regenerated desktop-schema.sql without restarting the server.
    await applySchema(projectId, workspaceRoot, cached);
    return cached;
  }

  const fayaDir = path.join(workspaceRoot, ".faya");
  await mkdir(fayaDir, { recursive: true });

  const dbPath = path.join(fayaDir, "app.db");
  const { DatabaseSync } = getSqliteModule();
  const database = new DatabaseSync(dbPath);
  database.exec(
    "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
  );

  await applySchema(projectId, workspaceRoot, database);

  openDatabases.set(projectId, database);
  return database;
}

export function quoteIdentifier(value: string): string {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

export function listTableColumns(
  database: SqliteDatabase,
  table: string,
): TableColumn[] {
  if (!TABLE_PATTERN.test(table)) return [];

  const rows = database
    .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    name: String(row.name),
    type: String(row.type ?? ""),
    pk: Number(row.pk) || 0,
    notNull: Number(row.notnull) || 0,
    defaultValue: row.dflt_value ?? null,
  }));
}

export function pickKeyColumn(columns: TableColumn[]): TableColumn | null {
  return (
    columns.find((column) => column.name.toLowerCase() === "id") ??
    columns.find((column) => column.pk > 0) ??
    null
  );
}

function isNumericType(type: string): boolean {
  return /int/i.test(type || "");
}

export function coerceKey(
  value: string,
  column: TableColumn | null,
): string | number {
  if (!column || !isNumericType(column.type)) return String(value);
  return /^-?\d+$/.test(String(value)) ? Number(value) : String(value);
}

export function readTableRows(
  database: SqliteDatabase,
  table: string,
): Record<string, unknown>[] {
  if (!TABLE_PATTERN.test(table)) return [];

  return database
    .prepare(`SELECT * FROM ${quoteIdentifier(table)}`)
    .all() as Record<string, unknown>[];
}

export function snapshotTable(
  database: SqliteDatabase,
  table: string,
): TableSnapshot | null {
  if (!TABLE_PATTERN.test(table)) return null;

  const columns = listTableColumns(database, table);
  const keyColumn = pickKeyColumn(columns);

  if (!keyColumn) return null;

  const rows = new Map<string, Record<string, unknown>>();

  for (const row of readTableRows(database, table)) {
    rows.set(String(row[keyColumn.name]), row);
  }

  return { columns, keyName: keyColumn.name, rows };
}

function toDbValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export function diffSnapshots(
  table: string,
  before: TableSnapshot,
  after: TableSnapshot,
): DatabaseChange[] {
  const changes: DatabaseChange[] = [];

  for (const [key, row] of after.rows) {
    const previous = before.rows.get(key);

    if (!previous || JSON.stringify(previous) !== JSON.stringify(row)) {
      changes.push({ table, id: key, data: row, deleted: false });
    }
  }

  for (const key of before.rows.keys()) {
    if (!after.rows.has(key)) {
      changes.push({ table, id: key, data: null, deleted: true });
    }
  }

  return changes;
}

/**
 * Applies a change coming from a desktop device to the platform-side database.
 * Unknown tables/columns are ignored instead of failing the whole sync batch.
 */
export function applyDatabaseChange(
  database: SqliteDatabase,
  change: DatabaseChange,
): boolean {
  if (!TABLE_PATTERN.test(change.table)) return false;

  const columns = listTableColumns(database, change.table);
  const keyColumn = pickKeyColumn(columns);

  if (!keyColumn) return false;

  const key = coerceKey(change.id, keyColumn);

  if (change.deleted) {
    database
      .prepare(
        `DELETE FROM ${quoteIdentifier(change.table)} WHERE ${quoteIdentifier(keyColumn.name)} = ?`,
      )
      .run(key);
    return true;
  }

  const data = change.data && typeof change.data === "object" ? change.data : {};
  const available = new Set(columns.map((column) => column.name));
  const names = Object.keys(data).filter((name) => available.has(name));

  if (!names.includes(keyColumn.name)) {
    names.unshift(keyColumn.name);
  }

  const existing = database
    .prepare(
      `SELECT ${quoteIdentifier(keyColumn.name)} FROM ${quoteIdentifier(change.table)} WHERE ${quoteIdentifier(keyColumn.name)} = ? LIMIT 1`,
    )
    .all(key);

  if (existing.length > 0) {
    const setters = names.filter((name) => name !== keyColumn.name);

    if (setters.length === 0) return true;

    database
      .prepare(
        `UPDATE ${quoteIdentifier(change.table)} SET ${setters
          .map((name) => `${quoteIdentifier(name)} = ?`)
          .join(", ")} WHERE ${quoteIdentifier(keyColumn.name)} = ?`,
      )
      .run(...setters.map((name) => toDbValue(data[name])), key);

    return true;
  }

  database
    .prepare(
      `INSERT INTO ${quoteIdentifier(change.table)} (${names
        .map(quoteIdentifier)
        .join(", ")}) VALUES (${names.map(() => "?").join(", ")})`,
    )
    .run(
      ...names.map((name) =>
        name === keyColumn.name ? key : toDbValue(data[name]),
      ),
    );

  return true;
}
