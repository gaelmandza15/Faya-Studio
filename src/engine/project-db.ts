import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
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

/**
 * Contract for a project's data store. The SQLite adapter is local-only; a
 * libSQL/Turso adapter will implement the same surface for cloud deployments.
 */
export interface ProjectDataProvider {
  select(
    query: string,
    params: unknown[],
  ): Promise<Record<string, unknown>[]>;
  execute(
    query: string,
    params: unknown[],
  ): Promise<{ changes: number; lastInsertRowid: number }>;
  snapshot(table: string): Promise<TableSnapshot | null>;
  applyChange(change: DatabaseChange): Promise<boolean>;
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
  cacheKey: string,
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

  if (appliedSchemaVersions.get(cacheKey) === info.mtimeMs) {
    return;
  }

  const schema = await readFile(schemaPath, "utf8").catch(() => "");

  if (!schema.trim()) return;

  try {
    database.exec(schema);
  } catch (error) {
    // Keep the database usable and surface the problem in server logs.
    console.warn(
      `[project-db] Could not apply desktop-schema.sql for ${cacheKey}:`,
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const added = syncSchemaColumns(database, schema);
    if (added > 0) {
      console.info(
        `[project-db] Added ${added} column(s) to ${cacheKey}.`,
      );
    }
  } catch (error) {
    console.warn(
      `[project-db] Could not synchronize columns for ${cacheKey}:`,
      error instanceof Error ? error.message : error,
    );
  }

  appliedSchemaVersions.set(cacheKey, info.mtimeMs);
}

export interface ProjectDatabaseOptions {
  /**
   * Acceptance runs use a throwaway database seeded from desktop-schema.sql
   * instead of the application's live data.
   */
  sandbox?: string;
  /** Delete sandbox files older than this when a new sandbox opens. */
  pruneOlderThanMs?: number;
}

export const SANDBOX_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function databaseCacheKey(projectId: string, sandbox?: string): string {
  return sandbox ? `${projectId}::${sandbox}` : projectId;
}

async function pruneSandboxes(
  projectId: string,
  keepKey: string,
  olderThanMs: number,
) {
  const dir = path.join(getWorkspacesRoot(), projectId, ".faya", "sandbox");
  const entries = await readdir(dir).catch(() => [] as string[]);
  const cutoff = Date.now() - olderThanMs;

  for (const entry of entries) {
    if (!entry.endsWith(".db")) continue;

    const sandbox = entry.slice(0, -3);
    const key = databaseCacheKey(projectId, sandbox);
    if (key === keepKey) continue;

    const file = path.join(dir, entry);
    const info = await stat(file).catch(() => null);
    if (!info || info.mtimeMs >= cutoff) continue;

    const database = openDatabases.get(key);
    try {
      database?.close();
    } catch {
      // Best effort: the file may already be closed.
    }
    openDatabases.delete(key);
    appliedSchemaVersions.delete(key);
    projectProviders.delete(key);

    await rm(file, { force: true }).catch(() => undefined);
    await rm(`${file}-wal`, { force: true }).catch(() => undefined);
    await rm(`${file}-shm`, { force: true }).catch(() => undefined);
  }
}

export async function getProjectDatabase(
  projectId: string,
  options: ProjectDatabaseOptions = {},
): Promise<SqliteDatabase> {
  const workspaceRoot = path.join(getWorkspacesRoot(), projectId);
  const sandbox =
    options.sandbox && SANDBOX_ID_PATTERN.test(options.sandbox)
      ? options.sandbox
      : undefined;
  const cacheKey = databaseCacheKey(projectId, sandbox);
  const cached = openDatabases.get(cacheKey);

  if (cached) {
    // Pick up a regenerated desktop-schema.sql without restarting the server.
    await applySchema(cacheKey, workspaceRoot, cached);
    return cached;
  }

  const fayaDir = path.join(workspaceRoot, ".faya");
  await mkdir(fayaDir, { recursive: true });

  let dbPath: string;

  if (sandbox) {
    await pruneSandboxes(
      projectId,
      cacheKey,
      options.pruneOlderThanMs ?? 10 * 60 * 1000,
    );
    const sandboxDir = path.join(fayaDir, "sandbox");
    await mkdir(sandboxDir, { recursive: true });
    dbPath = path.join(sandboxDir, `${sandbox}.db`);
  } else {
    dbPath = path.join(fayaDir, "app.db");
  }

  const { DatabaseSync } = getSqliteModule();
  const database = new DatabaseSync(dbPath);
  database.exec(
    "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;",
  );

  await applySchema(cacheKey, workspaceRoot, database);

  openDatabases.set(cacheKey, database);
  return database;
}

/**
 * Creates a consistent snapshot of the project database (WAL checkpoint
 * included) and returns its size in bytes.
 */
export async function backupProjectDatabase(
  projectId: string,
  targetPath: string,
): Promise<number> {
  const database = await getProjectDatabase(projectId);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await rm(targetPath, { force: true });

  database.exec(
    `VACUUM INTO '${targetPath.replace(/'/g, "''")}'`,
  );

  const info = await stat(targetPath);
  return info.size;
}

/**
 * Closes the cached connection so a restore can replace the database file.
 * The next request reopens it and reapplies the schema.
 */
export function closeProjectDatabase(projectId: string) {
  const database = openDatabases.get(projectId);

  if (database) {
    database.close();
  }

  openDatabases.delete(projectId);
  appliedSchemaVersions.delete(projectId);
  projectProviders.delete(projectId);
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

class SqliteProjectDataProvider implements ProjectDataProvider {
  constructor(private readonly database: SqliteDatabase) {}

  async select(
    query: string,
    params: unknown[],
  ): Promise<Record<string, unknown>[]> {
    return this.database.prepare(query).all(...params) as Record<
      string,
      unknown
    >[];
  }

  async execute(
    query: string,
    params: unknown[],
  ): Promise<{ changes: number; lastInsertRowid: number }> {
    const info = this.database.prepare(query).run(...params);

    return {
      changes: info.changes,
      lastInsertRowid: Number(info.lastInsertRowid),
    };
  }

  async snapshot(table: string): Promise<TableSnapshot | null> {
    return snapshotTable(this.database, table);
  }

  async applyChange(change: DatabaseChange): Promise<boolean> {
    return applyDatabaseChange(this.database, change);
  }
}

const globalForProviders = globalThis as unknown as {
  __fayaProjectDataProviders?: Map<string, ProjectDataProvider>;
};

const projectProviders: Map<string, ProjectDataProvider> =
  globalForProviders.__fayaProjectDataProviders ??
  (globalForProviders.__fayaProjectDataProviders = new Map());

/**
 * Returns the configured data provider for a project. Only SQLite ships
 * locally; selecting an unimplemented provider fails loudly.
 */
export async function getProjectDataProvider(
  projectId: string,
  options: ProjectDatabaseOptions = {},
): Promise<ProjectDataProvider> {
  const provider = (process.env.PROJECT_DATA_PROVIDER ?? "sqlite").toLowerCase();

  if (provider !== "sqlite") {
    throw new Error(
      `Project data provider "${provider}" is not implemented. Use PROJECT_DATA_PROVIDER=sqlite.`,
    );
  }

  const sandbox =
    options.sandbox && SANDBOX_ID_PATTERN.test(options.sandbox)
      ? options.sandbox
      : undefined;
  const cacheKey = databaseCacheKey(projectId, sandbox);
  const cached = projectProviders.get(cacheKey);

  if (cached) {
    return cached;
  }

  const created = new SqliteProjectDataProvider(
    await getProjectDatabase(projectId, { ...options, sandbox }),
  );
  projectProviders.set(cacheKey, created);
  return created;
}

