"use server";

import { stat } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspacesRoot } from "@/engine/workspace";
import { enqueueModification } from "@/engine/jobs";
import { chargeCredits, refundCredits } from "@/engine/credits";
import {
  CREDIT_COSTS,
  CREDIT_REFUND_REASONS,
} from "@/lib/credit-costs";
import { db } from "@/lib/db";
import { appCan, getProjectAccess } from "@/lib/project-access";
import { can } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";

const messageSchema = z.string().trim().min(2).max(2000);

export type SendProjectMessageResult =
  | { jobId: string }
  | {
      error:
        | "invalid"
        | "notFound"
        | "busy"
        | "notReady"
        | "insufficientCredits"
        | "forbidden"
        | "generic";
    };

export async function sendProjectMessageAction(
  projectId: string,
  message: string,
): Promise<SendProjectMessageResult> {
  const parsed = messageSchema.safeParse(message);

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "generation.run")) {
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

    try {
      const info = await stat(
        path.join(getWorkspacesRoot(), projectId, "index.html"),
      );

      if (!info.isFile()) {
        return { error: "notReady" };
      }
    } catch {
      return { error: "notReady" };
    }

    const active = await db.generationJob.findFirst({
      where: {
        projectId,
        status: { in: ["queued", "running"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (active) {
      return { error: "busy" };
    }

    const charge = await chargeCredits(db, {
      organizationId: workspace.organization.id,
      userId: workspace.user.id,
      amount: CREDIT_COSTS.modification,
      reason: "modification",
    });

    if (!charge.ok) {
      return {
        error:
          charge.reason === "insufficient"
            ? "insufficientCredits"
            : "generic",
      };
    }

    let enqueued: Awaited<ReturnType<typeof enqueueModification>>;

    try {
      enqueued = await enqueueModification(
        projectId,
        parsed.data,
        charge.transactionId,
      );
    } catch (error) {
      await refundCredits(db, {
        transactionId: charge.transactionId,
        reason: CREDIT_REFUND_REASONS.modification,
      });
      throw error;
    }

    if (enqueued.reused) {
      await refundCredits(db, {
        transactionId: charge.transactionId,
        reason: CREDIT_REFUND_REASONS.modification,
      });
      return { error: "busy" };
    }

    const { job } = enqueued;

    const existingMessages = await db.projectMessage.count({
      where: { projectId },
    });

    await db.$transaction(async (tx) => {
      if (existingMessages === 0) {
        await tx.projectMessage.create({
          data: {
            projectId,
            role: "user",
            content: project.prompt,
          },
        });
      }

      await tx.projectMessage.create({
        data: {
          projectId,
          jobId: job.id,
          role: "user",
          content: parsed.data,
        },
      });
    });

    revalidatePath("/creer");
    revalidatePath("/");
    return { jobId: job.id };
  } catch (error) {
    console.error("Project message failed", error);
    return { error: "generic" };
  }
}
