"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/workspace";
import { db } from "@/lib/db";
import { appCan, getProjectAccess } from "@/lib/project-access";
import { enqueueBuild } from "@/engine/build-jobs";
import { chargeCredits, refundCredits } from "@/engine/credits";
import {
  CREDIT_COSTS,
  CREDIT_REFUND_REASONS,
} from "@/lib/credit-costs";
import { can } from "@/lib/roles";

export type ExportProjectResult =
  | { jobId: string }
  | {
      error:
        | "notFound"
        | "notReady"
        | "busy"
        | "insufficientCredits"
        | "forbidden"
        | "generic";
    };

export async function exportProjectAction(
  projectId: string,
): Promise<ExportProjectResult> {
  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "build.run")) {
      return { error: "forbidden" };
    }

    const access = await getProjectAccess(workspace.user.id, projectId);

    if (!access || !appCan(access.role, "write")) {
      return { error: "forbidden" };
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: access.organizationId,
      },
    });

    if (!project) {
      return { error: "notFound" };
    }

    if (project.status !== "ready") {
      return { error: "notReady" };
    }

    const charge = await chargeCredits(db, {
      organizationId: workspace.organization.id,
      userId: workspace.user.id,
      amount: CREDIT_COSTS.build,
      reason: "build",
    });

    if (!charge.ok) {
      return {
        error:
          charge.reason === "insufficient"
            ? "insufficientCredits"
            : "generic",
      };
    }

    let enqueued: Awaited<ReturnType<typeof enqueueBuild>>;

    try {
      enqueued = await enqueueBuild(
        project.id,
        charge.transactionId,
      );
    } catch (error) {
      await refundCredits(db, {
        transactionId: charge.transactionId,
        reason: CREDIT_REFUND_REASONS.build,
      });
      throw error;
    }

    if (enqueued.reused) {
      await refundCredits(db, {
        transactionId: charge.transactionId,
        reason: CREDIT_REFUND_REASONS.build,
      });
      return { error: "busy" };
    }

    revalidatePath("/applications");
    revalidatePath("/creer");
    revalidatePath("/");
    return { jobId: enqueued.job.id };
  } catch (error) {
    console.error("Desktop export failed", error);
    return { error: "generic" };
  }
}
