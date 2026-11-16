import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createWorkspaceTools, validateWorkspace } from "./tools";
import { listWorkspaceFiles, type WorkspaceFile } from "./workspace";
import type { GenerationTarget } from "../lib/types";

export type EngineEvent =
  | {
      type: "status";
      status: "starting" | "generating" | "done" | "error";
      message?: string;
    }
  | { type: "text"; text: string }
  | { type: "tool_start"; id: string; tool: string; args: unknown }
  | {
      type: "tool_end";
      id: string;
      tool: string;
      isError: boolean;
      summary?: string;
    }
  | { type: "error"; message: string };

export interface GenerationResult {
  ok: boolean;
  summary: string;
  workspaceDir: string;
  files: WorkspaceFile[];
  checkReport: string;
  error?: string;
}

const BASE_PROMPT = `You are the Faya-Studio application generation agent.

Your job is to build a complete, working, standalone business application inside the current workspace, based on the user's request.

WORKSPACE RULES
- Work only through the provided tools: list_files, read_file, write_file, run_checks, finish.
- Never use shell commands, package managers, network access or external APIs.
- Never write outside the current workspace.
- Do not create symlinks or binary files.
- Write complete files; never leave TODOs or placeholder-only screens.

UI RULES
- The app must be a static single-page app that works by opening index.html.
- index.html: complete page, semantic HTML, <title>, linked styles.css, db.js (desktop) and app.js.
- styles.css: polished responsive styling. If you use the HTML hidden attribute, include "[hidden] { display: none !important; }" so CSS display rules never make hidden panels visible.
- app.js: classic JavaScript (no import/export, no build step).
- Do not use CDNs, external fonts, external images or external libraries. Everything must work offline.
- Make the interface modern, accessible and responsive (mobile and desktop).
- Implement the requested features with realistic sample data where useful.
- Use the same language as the user's request for the interface.
- The main feature must actually work: creation, listing, search, update and deletion where relevant.

PROCESS
1. Call list_files to inspect the workspace.
2. Write complete files with write_file. Prefer a few clear files over many tiny ones.
3. Call run_checks.
4. If checks fail, read the report, fix the files and call run_checks again.
5. Only when checks pass, call finish with a short summary.
6. Do not ask the user questions; make reasonable assumptions and build the app.

Return a concise final summary in the user's language.`;

const WEB_RULES = `TARGET: WEB
- app.js uses localStorage for persistence when available, wrapped in try/catch, with an in-memory fallback.
- Use realistic seed data on first load.
- Do not create SQL files.`;

const DESKTOP_RULES = `TARGET: DESKTOP (Tauri 2 + SQLite)
The app will run in a Tauri 2 window with a local SQLite database. The browser preview must still work, using the same FayaDB API backed by localStorage. You must produce both paths.

MANDATORY FILES
- desktop-schema.sql: complete SQLite schema and seed data, at the workspace root.
- db.js: classic script, no import/export, exposing window.FayaDB.
- app.js: classic script, no localStorage, using window.FayaDB for every read and write.
- index.html: loads styles.css, then db.js, then app.js, in that order.

DATABASE RULES
- desktop-schema.sql must use CREATE TABLE IF NOT EXISTS, INTEGER PRIMARY KEY AUTOINCREMENT, NOT NULL, CHECK and FOREIGN KEY constraints where useful, plus indexes on filtered/sorted columns.
- Add INSERT OR IGNORE statements with 3-6 realistic seed rows per main table so the app is never empty on first launch.
- Never use DROP, ATTACH, DETACH, load_extension, readfile, writefile or VACUUM INTO. The only allowed PRAGMA is foreign_keys.
- All SQL in db.js must be parameterized with ?1, ?2, ... Never concatenate user input into SQL.

db.js REQUIREMENTS
- Detect the runtime:
  const invoke = window.__TAURI__?.core?.invoke;
  const DESKTOP = typeof invoke === "function";
- Desktop call shape:
  invoke("db_select", { query, params }) returns an array of row objects.
  invoke("db_execute", { query, params }) returns the number of changed rows.
- Browser fallback: keep an equivalent array of records in localStorage under a namespaced key such as "faya:tasks", seeded with the same sample data on first load.
- db.js is the ONLY file allowed to touch localStorage.
- Expose window.FayaDB with one async function per operation, for example:
  window.FayaDB = { listTasks, searchTasks, createTask, updateTask, deleteTask, getTaskStats };
- The shell creates the tables at startup on desktop: db.js must never run CREATE TABLE through JS.

app.js REQUIREMENTS
- It must not contain the word localStorage.
- It must call FayaDB functions (for example await FayaDB.listTasks()) and render the returned rows.
- It must handle errors with a visible message, not silent failures.

SHAPE EXAMPLE (adapt names and columns to the requested app)
(function () {
  const invoke = window.__TAURI__?.core?.invoke;
  const DESKTOP = typeof invoke === "function";
  const KEY = "faya:tasks";
  const SEED = [{ id: 1, title: "Exemple", done: 0 }];

  function localRows() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
      localStorage.setItem(KEY, JSON.stringify(SEED));
    } catch (error) {
      // Return an in-memory fallback if storage is unavailable.
    }
    return SEED.slice();
  }

  async function listTasks() {
    if (DESKTOP) {
      return invoke("db_select", {
        query: "SELECT id, title, done FROM tasks ORDER BY id DESC",
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
    rows.push({ id: Date.now(), title: task.title, done: task.done ? 1 : 0 });
    localStorage.setItem(KEY, JSON.stringify(rows));
    return 1;
  }

  window.FayaDB = { listTasks, createTask };
})();

SCHEMA EXAMPLE (adapt it):
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
INSERT OR IGNORE INTO tasks (id, title, done) VALUES (1, 'Exemple', 0);`;

function buildSystemPrompt(target: GenerationTarget): string {
  return `${BASE_PROMPT}\n\n${
    target === "desktop" ? DESKTOP_RULES : WEB_RULES
  }`;
}

function getDeepSeekKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "DEEPSEEK_API_KEY is missing. Add it to web/.env.local (or web/.env) before running the engine.",
    );
  }
  return key;
}

export async function generateApp({
  prompt,
  workspaceDir,
  onEvent,
  target = "desktop",
  timeoutMs = 10 * 60 * 1000,
}: {
  prompt: string;
  workspaceDir: string;
  onEvent?: (event: EngineEvent) => void;
  target?: GenerationTarget;
  timeoutMs?: number;
}): Promise<GenerationResult> {
  const emit = (event: EngineEvent) => {
    try {
      onEvent?.(event);
    } catch {
      // A broken observer must not break generation.
    }
  };

  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
  let unsubscribe: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let finishSummary = "";

  try {
    emit({ type: "status", status: "starting" });

    const modelRuntime = await ModelRuntime.create();
    await modelRuntime.setRuntimeApiKey("deepseek", getDeepSeekKey());

    const requestedModel = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-flash";
    const model =
      modelRuntime.getModel("deepseek", requestedModel) ??
      modelRuntime.getModel("deepseek", "deepseek-flash") ??
      modelRuntime.getModel("deepseek", "deepseek-v4-pro");

    if (!model) {
      throw new Error(
        "No DeepSeek model is available in the Pi model catalog.",
      );
    }

    const agentDir = getAgentDir();
    const resourceLoader = new DefaultResourceLoader({
      cwd: workspaceDir,
      agentDir,
      systemPromptOverride: () => buildSystemPrompt(target),
      appendSystemPromptOverride: () => [],
    });
    await resourceLoader.reload();

    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 2 },
    });

    const result = await createAgentSession({
      cwd: workspaceDir,
      agentDir,
      model,
      thinkingLevel: "off",
      modelRuntime,
      resourceLoader,
      customTools: createWorkspaceTools(workspaceDir, { target }),
      noTools: "builtin",
      sessionManager: SessionManager.inMemory(workspaceDir),
      settingsManager,
    });

    session = result.session;

    unsubscribe = session.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        emit({ type: "text", text: event.assistantMessageEvent.delta });
        return;
      }

      if (event.type === "tool_execution_start") {
        if (event.toolName === "finish") {
          const args = event.args as { summary?: unknown };
          if (typeof args?.summary === "string") {
            finishSummary = args.summary;
          }
        }

        emit({
          type: "tool_start",
          id: event.toolCallId,
          tool: event.toolName,
          args: event.args,
        });
        return;
      }

      if (event.type === "tool_execution_end") {
        const content = event.result?.content;
        const text = Array.isArray(content)
          ? content.find(
              (part: { type?: string; text?: string }) =>
                part?.type === "text" && typeof part.text === "string",
            )?.text
          : undefined;

        emit({
          type: "tool_end",
          id: event.toolCallId,
          tool: event.toolName,
          isError: event.isError,
          summary: text?.slice(0, 500),
        });
        return;
      }

      if (event.type === "agent_start") {
        emit({ type: "status", status: "generating" });
      }
    });

    timeout = setTimeout(() => {
      timedOut = true;
      void session?.abort();
    }, timeoutMs);

    await session.prompt(prompt);

    const summary =
      finishSummary || session.getLastAssistantText()?.trim() || "";
    const files = await listWorkspaceFiles(workspaceDir, 6);
    const check = await validateWorkspace(workspaceDir, { target });

    if (timedOut) {
      const error = "Generation timed out.";
      emit({ type: "error", message: error });
      return {
        ok: false,
        summary,
        workspaceDir,
        files,
        checkReport: check.report,
        error,
      };
    }

    emit({ type: "status", status: "done" });

    return {
      ok: check.ok,
      summary,
      workspaceDir,
      files,
      checkReport: check.report,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    emit({ type: "error", message });

    return {
      ok: false,
      summary: "",
      workspaceDir,
      files: await listWorkspaceFiles(workspaceDir, 6).catch(() => []),
      checkReport: "Generation did not complete.",
      error: message,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    unsubscribe?.();

    try {
      session?.dispose();
    } catch {
      // Ignore disposal errors.
    }
  }
}
