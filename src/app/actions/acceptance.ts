"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  runProjectAcceptance,
  saveAcceptanceRecord,
} from "@/engine/acceptance-service";
import { summarizeAcceptanceReport } from "@/engine/acceptance";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { can } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";

export type RerunAcceptanceResult =
  | {
      ok: true;
      status: "passed" | "failed" | "skipped";
      passed: number;
      total: number;
      failed: number;
      mode: "platform" | "static";
      warning: string | null;
      runAt: string;
      error: string | null;
      flows: Array<{
        name: string;
        ok: boolean;
        failedStep?: number;
        error?: string;
      }>;
      consoleErrors: string[];
    }
  | { error: "notFound" | "forbidden" | "busy" | "notReady" | "generic" };

async function resolveBaseUrl(): Promise<string> {
  if (process.env.FAYA_ACCEPTANCE_URL) {
    return process.env.FAYA_ACCEPTANCE_URL.replace(/\/+$/, "");
  }

  if (process.env.FAYA_PLATFORM_URL) {
    return process.env.FAYA_PLATFORM_URL.replace(/\/+$/, "");
  }

  const headerList = await headers();
  const proto =
    headerList.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host = headerList.get("host") ?? "localhost:3000";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export async function rerunAcceptanceAction(
  projectId: string,
): Promise<RerunAcceptanceResult> {
  const workspace = await getWorkspaceContext();

  if (!can(workspace.organization.role, "project.update")) {
    return { error: "forbidden" };
  }

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: workspace.organization.id },
    select: { id: true, status: true, organizationId: true },
  });

  if (!project) {
    return { error: "notFound" };
  }

  if (project.status === "generating") {
    return { error: "busy" };
  }

  if (project.status !== "ready") {
    return { error: "notReady" };
  }

  try {
    const baseUrl = await resolveBaseUrl();
    const run = await runProjectAcceptance({
      prisma: db,
      projectId: project.id,
      organizationId: project.organizationId,
      userId: workspace.user.id,
      baseUrl,
    });

    await saveAcceptanceRecord(db, project.id, run.record);
    revalidatePath(`/applications/${project.id}`);

    if (run.outcome.status === "skipped") {
      return {
        ok: true,
        status: "skipped",
        passed: 0,
        total: 0,
        failed: 0,
        mode: run.mode,
        warning: run.warning,
        runAt: run.record.acceptanceRunAt.toISOString(),
        error: run.outcome.reason,
        flows: [],
        consoleErrors: [],
      };
    }

    const summary = summarizeAcceptanceReport(run.outcome.report);

    return {
      ok: true,
      status: run.outcome.status,
      passed: summary.passed,
      total: summary.total,
      failed: summary.failed,
      mode: run.outcome.report.mode,
      warning: run.warning,
      runAt: run.record.acceptanceRunAt.toISOString(),
      error: run.record.acceptanceError,
      flows: run.outcome.report.flows.map((flow) => ({
        name: flow.name,
        ok: flow.ok,
        failedStep: flow.failedStep,
        error: flow.error,
      })),
      consoleErrors: run.outcome.report.consoleErrors.slice(0, 8),
    };
  } catch (error) {
    logger.error("Acceptance rerun failed", {
      projectId: project.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "generic" };
  }
}
