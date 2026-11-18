import path from "node:path";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import {
  ACCEPTANCE_SESSION_TTL_MS,
  generateSessionToken,
  hashSessionToken,
} from "../lib/auth/tokens";
import {
  buildAcceptanceRecord,
  readAcceptancePlan,
  type AcceptanceMode,
  type AcceptanceOutcome,
  type AcceptanceRecord,
} from "./acceptance";
import {
  isPlatformReachable,
  resolveAcceptanceBaseUrl,
  runAcceptanceGate,
} from "./acceptance-gate";
import { getWorkspacesRoot } from "./workspace";

export interface RunProjectAcceptanceInput {
  prisma: PrismaClient;
  projectId: string;
  organizationId: string;
  /** Member used for the short-lived acceptance session. */
  userId: string;
  workspaceDir?: string;
  baseUrl?: string;
  timeoutMs?: number;
  onLog?: (message: string, details?: Record<string, unknown>) => void;
}

export type ProjectAcceptanceRun = {
  outcome: AcceptanceOutcome;
  record: AcceptanceRecord;
  mode: AcceptanceMode;
  /** Set when the platform was unreachable and the static runner was used. */
  warning: string | null;
  durationMs: number;
};

/**
 * Run `acceptance.json` against the application.
 *
 * Platform mode creates a short-lived session and loads the exact document the
 * runner embeds (`/api/workspaces/<id>/index.html`), so the Web Bridge and the
 * project's SQLite database are exercised. If the platform cannot be reached,
 * the static runner is used and the result is flagged as degraded.
 */
export async function runProjectAcceptance(
  input: RunProjectAcceptanceInput,
): Promise<ProjectAcceptanceRun> {
  const startedAt = Date.now();
  const workspaceDir =
    input.workspaceDir ?? path.join(getWorkspacesRoot(), input.projectId);
  const plan = await readAcceptancePlan(workspaceDir);

  if (!plan.ok) {
    const outcome: AcceptanceOutcome = {
      status: "skipped",
      reason: plan.missing
        ? "missing-acceptance-plan"
        : `invalid-acceptance-plan: ${plan.errors.join(" ")}`,
    };

    return {
      outcome,
      record: buildAcceptanceRecord(outcome),
      mode: "static",
      warning: null,
      durationMs: Date.now() - startedAt,
    };
  }

  const baseUrl = (input.baseUrl ?? resolveAcceptanceBaseUrl()).replace(
    /\/+$/,
    "",
  );

  let mode: AcceptanceMode = "platform";
  let warning: string | null = null;
  let token: string | undefined;
  let sessionId: string | undefined;

  const reachable = await isPlatformReachable(baseUrl);

  if (reachable) {
    token = generateSessionToken();
    const session = await input.prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: input.userId,
        expiresAt: new Date(Date.now() + ACCEPTANCE_SESSION_TTL_MS),
      },
      select: { id: true },
    });
    sessionId = session.id;
  } else {
    mode = "static";
    warning =
      "Platform unreachable: static validation only, the Web Bridge was not exercised.";
  }

  input.onLog?.("Acceptance started", {
    mode,
    baseUrl: mode === "platform" ? baseUrl : undefined,
    flows: plan.plan.flows.length,
  });

  // The runner writes its report under the workspace.
  await mkdir(path.join(workspaceDir, ".faya", "acceptance"), {
    recursive: true,
  });

  try {
    // A fresh sandbox per run keeps test rows out of the live database and
    // makes flows independent from previous runs.
    const sandbox = `acceptance-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;

    const gate = await runAcceptanceGate({
      projectId: input.projectId,
      workspaceDir,
      baseUrl: mode === "platform" ? baseUrl : undefined,
      token,
      organizationId:
        mode === "platform" ? input.organizationId : undefined,
      sandbox: mode === "platform" ? sandbox : undefined,
      timeoutMs: input.timeoutMs,
    });

    const outcome = gate.outcome;
    const durationMs = Date.now() - startedAt;

    input.onLog?.("Acceptance finished", {
      status: outcome.status,
      exitCode: gate.exitCode,
      durationMs,
      ...(outcome.status === "skipped"
        ? { reason: outcome.reason }
        : {
            passed: outcome.report.flows.filter((flow) => flow.ok).length,
            total: outcome.report.flows.length,
            mode: outcome.report.mode,
          }),
    });

    return {
      outcome,
      record: buildAcceptanceRecord(outcome, warning),
      mode:
        outcome.status === "skipped"
          ? mode
          : outcome.report.mode,
      warning,
      durationMs,
    };
  } finally {
    if (sessionId) {
      await input.prisma.session
        .delete({ where: { id: sessionId } })
        .catch(() => undefined);
    }
  }
}

export async function saveAcceptanceRecord(
  prisma: PrismaClient,
  projectId: string,
  record: AcceptanceRecord,
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: record,
  });
}
