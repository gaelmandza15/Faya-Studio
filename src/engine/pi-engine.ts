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

const SYSTEM_PROMPT = `You are the Faya-Studio application generation agent.

Your job is to build a complete, working, standalone business web application inside the current workspace, based on the user's request.

WORKSPACE RULES
- Work only through the provided tools: list_files, read_file, write_file, run_checks, finish.
- Never use shell commands, package managers, network access or external APIs.
- Never write outside the current workspace.
- Do not create symlinks or binary files.

APPLICATION RULES
- The app must be a static single-page app that works by opening index.html.
- Create at least:
  - index.html: complete page, semantic HTML, <title>, linked styles.css and app.js.
  - styles.css: polished responsive styling.
  - app.js: classic JavaScript (no import/export, no build step).
- Do not use CDNs, external fonts, external images or external libraries. Everything must work offline.
- Use localStorage for persistence when available, wrapped in try/catch, with an in-memory fallback.
- Make the interface modern, accessible and responsive (mobile and desktop).
- Implement the requested features with realistic sample data where useful.
- Use the same language as the user's request for the interface.
- Avoid placeholder-only pages: the main feature must actually work.

PROCESS
1. Call list_files to inspect the workspace.
2. Write complete files with write_file. Prefer a few clear files over many tiny ones.
3. Call run_checks.
4. If checks fail, read the report, fix the files and call run_checks again.
5. Only when checks pass, call finish with a short summary.
6. Do not ask the user questions; make reasonable assumptions and build the app.

Return a concise final summary in the user's language.`;

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
  timeoutMs = 10 * 60 * 1000,
}: {
  prompt: string;
  workspaceDir: string;
  onEvent?: (event: EngineEvent) => void;
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
      systemPromptOverride: () => SYSTEM_PROMPT,
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
      customTools: createWorkspaceTools(workspaceDir),
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
    const check = await validateWorkspace(workspaceDir);

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
