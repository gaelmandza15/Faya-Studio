import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createWorkspace,
  listWorkspaceFiles,
  resolveInsideWorkspace,
  writeWorkspaceFile,
} from "../src/engine/workspace";
import { validateWorkspace } from "../src/engine/tools";

const VALID_HTML = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Test Faya-Studio</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <h1 id="title">Test</h1>
    <script src="app.js"></script>
  </body>
</html>`;

const VALID_CSS = `body { font-family: system-ui, sans-serif; }`;

const VALID_JS = `document.querySelector("#title").textContent = "OK";`;

const DESKTOP_SCHEMA = `PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
INSERT OR IGNORE INTO tasks (id, title, done) VALUES (1, 'Test', 0);`;

const DESKTOP_DB = `(function () {
  const invoke = window.__TAURI__?.core?.invoke;
  const DESKTOP = typeof invoke === "function";
  const KEY = "faya:tasks";
  const SEED = [{ id: 1, title: "Test", done: 0 }];

  function localRows() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
      localStorage.setItem(KEY, JSON.stringify(SEED));
    } catch {
      // Fall back to memory when storage is unavailable.
    }
    return SEED.slice();
  }

  async function listTasks() {
    if (DESKTOP) {
      return invoke("db_select", {
        query: "SELECT id, title, done FROM tasks ORDER BY id",
        params: [],
      });
    }
    return localRows();
  }

  async function createTask(task) {
    if (DESKTOP) {
      return invoke("db_execute", {
        query: "INSERT INTO tasks (title, done) VALUES (?1, ?2)",
        params: [task.title, task.done ? 1 : 0],
      });
    }
    const rows = localRows();
    rows.push({ id: Date.now(), title: task.title, done: 0 });
    localStorage.setItem(KEY, JSON.stringify(rows));
    return 1;
  }

  async function upsertTask(task) {
    if (DESKTOP) {
      return invoke("db_execute", {
        query:
          "INSERT INTO tasks (id, title) VALUES (?1, ?2) " +
          "ON CONFLICT(id) DO UPDATE SET title = excluded.title",
        params: [task.id, task.title],
      });
    }
    return 1;
  }

  window.FayaDB = { listTasks, createTask, upsertTask };
})();`;

const DESKTOP_APP = `async function render() {
  const tasks = await window.FayaDB.listTasks();
  document.querySelector("#count").textContent = String(tasks.length);
}
document.querySelector("#add").addEventListener("click", async () => {
  await window.FayaDB.createTask({ title: "Nouvelle tâche", done: false });
  await render();
});
render();`;

const DESKTOP_HTML = `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Test desktop</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <h1 id="count">0</h1>
    <button id="add" type="button">Ajouter</button>
    <script src="db.js"></script>
    <script src="app.js"></script>
  </body>
</html>`;

async function main() {
  const workspace = await createWorkspace();
  let failures = 0;

  const check = (label: string, condition: boolean) => {
    console.log(`${condition ? "OK " : "FAIL"} ${label}`);
    if (!condition) failures += 1;
  };

  try {
    await writeWorkspaceFile(workspace.dir, "index.html", VALID_HTML);
    await writeWorkspaceFile(workspace.dir, "styles.css", VALID_CSS);
    await writeWorkspaceFile(workspace.dir, "app.js", VALID_JS);

    const files = await listWorkspaceFiles(workspace.dir);
    check(
      "les fichiers générés sont listés",
      files.some((file) => file.path === "index.html"),
    );

    const valid = await validateWorkspace(workspace.dir);
    check("une application valide passe les contrôles", valid.ok);
    if (!valid.ok) console.log(valid.report);

    await writeWorkspaceFile(workspace.dir, "index.html", DESKTOP_HTML);
    await writeWorkspaceFile(workspace.dir, "app.js", DESKTOP_APP);
    await writeWorkspaceFile(workspace.dir, "db.js", DESKTOP_DB);
    await writeWorkspaceFile(
      workspace.dir,
      "desktop-schema.sql",
      DESKTOP_SCHEMA,
    );

    const desktop = await validateWorkspace(workspace.dir, {
      target: "desktop",
    });
    check(
      "une application desktop valide passe les contrôles SQLite",
      desktop.ok,
    );
    if (!desktop.ok) console.log(desktop.report);

    await writeWorkspaceFile(
      workspace.dir,
      "desktop-schema.sql",
      "CREATE TABLE broken (",
    );
    const brokenSchema = await validateWorkspace(workspace.dir, {
      target: "desktop",
    });
    check(
      "un schéma SQLite invalide est détecté",
      !brokenSchema.ok &&
        brokenSchema.report.includes("failed to apply"),
    );
    await writeWorkspaceFile(
      workspace.dir,
      "desktop-schema.sql",
      DESKTOP_SCHEMA,
    );

    await writeWorkspaceFile(
      workspace.dir,
      "desktop-schema.sql",
      "CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL);",
    );
    const notIdempotent = await validateWorkspace(workspace.dir, {
      target: "desktop",
    });
    check(
      "un schéma non idempotent est détecté",
      !notIdempotent.ok &&
        notIdempotent.report.includes("not idempotent"),
    );
    await writeWorkspaceFile(
      workspace.dir,
      "desktop-schema.sql",
      DESKTOP_SCHEMA,
    );

    await writeWorkspaceFile(
      workspace.dir,
      "db.js",
      DESKTOP_DB.replace("FROM tasks", "FROM missing_table"),
    );
    const missingTable = await validateWorkspace(workspace.dir, {
      target: "desktop",
    });
    check(
      "une table absente du schéma est détectée",
      !missingTable.ok &&
        missingTable.report.includes("does not create: missing_table"),
    );
    await writeWorkspaceFile(workspace.dir, "db.js", DESKTOP_DB);

    await writeWorkspaceFile(
      workspace.dir,
      "db.js",
      "window.FayaDB = { listTasks: async () => [] };",
    );
    const missingBridge = await validateWorkspace(workspace.dir, {
      target: "desktop",
    });
    check(
      "une application desktop sans bridge Tauri est refusée",
      !missingBridge.ok &&
        missingBridge.report.includes("shell bridge"),
    );
    await writeWorkspaceFile(workspace.dir, "db.js", DESKTOP_DB);

    let escaped = false;
    try {
      resolveInsideWorkspace(workspace.dir, "../outside.txt");
    } catch {
      escaped = true;
    }
    check("une tentative de sortie du workspace est refusée", escaped);

    await writeFile(
      path.join(workspace.dir, "bad.js"),
      "const = ;",
      "utf8",
    );
    const invalid = await validateWorkspace(workspace.dir);
    check(
      "une erreur JavaScript est détectée",
      !invalid.ok && invalid.report.includes("JS syntax error"),
    );

    await writeFile(
      path.join(workspace.dir, "broken.html"),
      "<html><body><script src=\"missing.js\"></script></body></html>",
      "utf8",
    );
    await writeFile(
      path.join(workspace.dir, "index.html"),
      '<!DOCTYPE html><html><head><title>Broken</title><script src="missing.js"></script></head><body></body></html>',
      "utf8",
    );
    const missingAsset = await validateWorkspace(workspace.dir);
    check(
      "un asset local manquant est détecté",
      !missingAsset.ok &&
        missingAsset.report.includes("Missing local asset"),
    );

    await writeFile(
      path.join(workspace.dir, "index.html"),
      '<!DOCTYPE html><html><head><title>CDN</title><script src="https://cdn.example.com/lib.js"></script></head><body></body></html>',
      "utf8",
    );
    const externalAsset = await validateWorkspace(workspace.dir);
    check(
      "un asset externe est refusé",
      !externalAsset.ok &&
        externalAsset.report.includes("External asset is not allowed"),
    );

    console.log(
      `\n${failures === 0 ? "Selftest réussi." : `${failures} échec(s).`}`,
    );
    if (failures > 0) process.exitCode = 1;
  } finally {
    await rm(workspace.dir, { recursive: true, force: true });
    console.log(`Workspace de test supprimé : ${workspace.dir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
