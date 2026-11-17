/*
 * End-to-end verification of templates/faya-runtime/faya-sync.js.
 *
 * Runs the real embedded sync engine twice (two "devices"), each against its
 * own SQLite database, talking to the running platform API. This is a dev
 * script, not part of the product runtime.
 *
 * Usage: node scripts/verify-sync-engine.mjs <appKey> [baseUrl]
 */
import { DatabaseSync } from "node:sqlite";
import { readFile, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";

const appKey = process.argv[2];
const baseUrl = process.argv[3] ?? "http://localhost:3000";

if (!appKey) {
  console.error("Usage: node scripts/verify-sync-engine.mjs <appKey> [baseUrl]");
  process.exit(1);
}

const source = await readFile(
  new URL("../templates/faya-runtime/faya-sync.js", import.meta.url),
  "utf8",
);
const tempDir = await mkdtemp(path.join(tmpdir(), "faya-sync-"));
const dbA = new DatabaseSync(path.join(tempDir, "device-a.db"));
const dbB = new DatabaseSync(path.join(tempDir, "device-b.db"));

const TABLE = `verify_contacts_${Date.now().toString(36)}`;

const SCHEMA = `
  CREATE TABLE ${TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    updated_at TEXT
  );
  INSERT INTO ${TABLE} (name, email, phone, updated_at) VALUES
    ('Amina Diallo', 'amina@example.com', '0612', '2026-11-01T10:00:00.000Z'),
    ('Moussa Traore', 'moussa@example.com', '0712', '2026-11-01T10:00:00.000Z');
`;

for (const db of [dbA, dbB]) {
  db.exec(SCHEMA);
}

function invokeFor(db) {
  return async (command, args) => {
    if (command === "db_execute") {
      const statement = db.prepare(args.query);
      return statement.run(...(args.params ?? [])).changes ?? 0;
    }
    if (command === "db_select") {
      const statement = db.prepare(args.query);
      return statement.all(...(args.params ?? []));
    }
    throw new Error(`Unknown command ${command}`);
  };
}

function loadDevice(db, name) {
  const listeners = new Map();
  const context = {
    console,
    fetch,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: () => undefined,
    URL,
    JSON,
    Math,
    Date,
    Promise,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    navigator: { platform: "Win32", onLine: true, userAgentData: null },
    localStorage: (() => {
      const store = new Map();
      return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
      };
    })(),
    document: {
      readyState: "loading",
      body: { appendChild: () => undefined },
      visibilityState: "visible",
      addEventListener: () => undefined,
      createElement: () => ({
        style: {},
        setAttribute: () => undefined,
        addEventListener: () => undefined,
        appendChild: () => undefined,
        textContent: "",
      }),
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
    dispatchEvent: () => true,
    FAYA_CONFIG: {
      baseUrl,
      projectId: "verify",
      appKey,
      sync: true,
      hooks: false,
      locale: "fr",
      showBadge: false,
      deviceName: name,
    },
    __TAURI__: { core: { invoke: invokeFor(db) } },
  };

  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "faya-sync.js" });

  if (!context.FayaSync) {
    throw new Error("FayaSync was not exposed");
  }

  return context.FayaSync;
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok - ${message}`);
}

function q(sql) {
  return sql.replaceAll("verify_contacts", TABLE);
}

function rows(db, query, params = []) {
  return db.prepare(q(query)).all(...params);
}

const deviceA = loadDevice(dbA, "Poste A");
const deviceB = loadDevice(dbB, "Poste B");

console.log("1. Device A pushes its local rows");
await deviceA.syncNow();
assert(rows(dbA, "SELECT COUNT(*) AS count FROM verify_contacts")[0].count === 2, "A keeps 2 rows");

console.log("2. Device B receives them");
await deviceB.syncNow();
const received = rows(dbB, "SELECT name FROM verify_contacts ORDER BY id");
assert(received.length === 2, "B has 2 rows");
assert(received[0].name === "Amina Diallo", "B received Amina");

console.log("3. Device A edits a row, device B catches up");
dbA
  .prepare(q("UPDATE verify_contacts SET name = ?, updated_at = ? WHERE id = 1"))
  .run("Amina Diallo (maj)", new Date().toISOString());
await deviceA.syncNow();
await deviceB.syncNow();
assert(
  rows(dbB, "SELECT name FROM verify_contacts WHERE id = 1")[0].name === "Amina Diallo (maj)",
  "B sees the edit",
);

console.log("4. Device B deletes a row, device A receives the tombstone");
dbB.prepare(q("DELETE FROM verify_contacts WHERE id = 2")).run();
await deviceB.syncNow();
await deviceA.syncNow();
assert(rows(dbA, "SELECT * FROM verify_contacts WHERE id = 2").length === 0, "A deleted row 2");

console.log("5. Device A sees the same state as device B");
const aRows = rows(dbA, "SELECT id, name, email, phone FROM verify_contacts ORDER BY id");
const bRows = rows(dbB, "SELECT id, name, email, phone FROM verify_contacts ORDER BY id");
assert(JSON.stringify(aRows) === JSON.stringify(bRows), "both devices converge");

dbA.close();
dbB.close();
await rm(tempDir, { recursive: true, force: true });
console.log("\nSYNC_ENGINE_OK");
