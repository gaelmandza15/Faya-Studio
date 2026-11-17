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
import { buildSystemPrompt } from "./frame";
import {
  installDesignSystem,
  readWorkspaceDesignSystem,
} from "./design";
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

// Prompt construction lives in ./frame.

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
  mode = "generate",
  context,
  timeoutMs = 10 * 60 * 1000,
}: {
  prompt: string;
  workspaceDir: string;
  onEvent?: (event: EngineEvent) => void;
  target?: GenerationTarget;
  mode?: "generate" | "modify";
  context?: string;
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

    const designSystem =
      mode === "generate"
        ? await installDesignSystem(workspaceDir)
        : await readWorkspaceDesignSystem(workspaceDir);

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
      systemPromptOverride: () =>
        buildSystemPrompt(target, mode, designSystem),
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

    const agentPrompt =
      mode === "modify"
        ? `Modification request:\n${prompt}\n\nOriginal application request (for context):\n${
            context?.trim() || "(not available)"
          }`
        : prompt;

    await session.prompt(agentPrompt);

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
