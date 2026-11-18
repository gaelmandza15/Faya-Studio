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
  formatAcceptanceFailure,
  type AcceptanceOutcome,
} from "./acceptance";
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
  /** Result of the automated acceptance run, when one was requested. */
  acceptance?: AcceptanceOutcome;
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

function firstCheckError(report: string): string {
  const lines = report
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !line.startsWith("CHECK") &&
        !line.startsWith("JS syntax OK") &&
        !line.startsWith("SQLite") &&
        !line.startsWith("UI QUALITY") &&
        !line.startsWith("Files:") &&
        !line.startsWith("- "),
    );

  return lines.slice(0, 3).join(" ") || report.slice(0, 500);
}

function getEngineTimeoutMs(mode: "generate" | "modify"): number {
  const configured = Number(process.env.FAYA_ENGINE_TIMEOUT_MS ?? "");

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  // Complex business apps can legitimately take more than ten minutes.
  return mode === "modify" ? 15 * 60 * 1000 : 25 * 60 * 1000;
}

export async function generateApp({
  prompt,
  workspaceDir,
  onEvent,
  target = "desktop",
  mode = "generate",
  context,
  timeoutMs,
  acceptance,
}: {
  prompt: string;
  workspaceDir: string;
  onEvent?: (event: EngineEvent) => void;
  target?: GenerationTarget;
  mode?: "generate" | "modify";
  context?: string;
  timeoutMs?: number;
  /**
   * Runs the generated acceptance plan in the real runner. Failures are fed
   * back to the agent within the same session, so it can repair the UI.
   */
  acceptance?: () => Promise<AcceptanceOutcome>;
}): Promise<GenerationResult> {
  const effectiveTimeoutMs = timeoutMs ?? getEngineTimeoutMs(mode);
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
    }, effectiveTimeoutMs);

    const agentPrompt =
      mode === "modify"
        ? `Modification request:\n${prompt}\n\nOriginal application request (for context):\n${
            context?.trim() || "(not available)"
          }`
        : prompt;

    await session.prompt(agentPrompt);

    let summary =
      finishSummary || session.getLastAssistantText()?.trim() || "";
    let check = await validateWorkspace(workspaceDir, { target, requireAcceptance: mode === "generate" });
    let acceptanceOutcome: AcceptanceOutcome | undefined;

    const runAcceptance = async (): Promise<AcceptanceOutcome | undefined> => {
      if (!acceptance) return undefined;

      emit({
        type: "status",
        status: "generating",
        message: "Running acceptance flows…",
      });

      try {
        return await acceptance();
      } catch (error) {
        return {
          status: "skipped",
          reason: `acceptance-error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    };

    if (check.ok) {
      acceptanceOutcome = await runAcceptance();
    }

    // The agent sometimes stops before every referenced file is written, or
    // ships a UI flow that fails in the real runner. Feed both reports back
    // and ask for a targeted repair before failing the whole job.
    let repairAttempt = 0;

    while (
      (!check.ok || acceptanceOutcome?.status === "failed") &&
      !timedOut &&
      repairAttempt < 2
    ) {
      repairAttempt += 1;
      emit({
        type: "status",
        status: "generating",
        message: `Validation failed — repair attempt ${repairAttempt}.`,
      });

      const instructions = [
        "The workspace validation failed. Fix every error below, create any missing referenced file, and keep index.html consistent.",
        "Then call run_checks again. Do not call finish until run_checks passes.",
      ];

      if (!check.ok) {
        instructions.push("", check.report);
      }

      if (acceptanceOutcome?.status === "failed") {
        instructions.push(
          "",
          formatAcceptanceFailure(acceptanceOutcome.report),
        );
      }

      try {
        await session.prompt(instructions.join("\n"));
      } catch {
        break;
      }

      summary =
        finishSummary || session.getLastAssistantText()?.trim() || summary;
      check = await validateWorkspace(workspaceDir, { target, requireAcceptance: mode === "generate" });

      if (check.ok) {
        acceptanceOutcome = await runAcceptance();
      } else {
        // The files changed again; any previous acceptance result is stale.
        acceptanceOutcome = undefined;
      }
    }

    const files = await listWorkspaceFiles(workspaceDir, 6);

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
        acceptance: acceptanceOutcome,
      };
    }

    if (!check.ok) {
      const error = `Validation failed: ${firstCheckError(check.report)}`;
      emit({ type: "error", message: error });
      return {
        ok: false,
        summary,
        workspaceDir,
        files,
        checkReport: check.report,
        error,
        acceptance: acceptanceOutcome,
      };
    }

    emit({ type: "status", status: "done" });

    return {
      ok: true,
      summary,
      workspaceDir,
      files,
      checkReport: check.report,
      acceptance: acceptanceOutcome,
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
