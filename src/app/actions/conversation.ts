"use server";

import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getWorkspacesRoot } from "@/engine/workspace";
import { enqueueModification } from "@/engine/jobs";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/workspace";

const messageSchema = z.string().trim().min(2).max(2000);

export type SendProjectMessageResult =
  | { jobId: string }
  | {
      error: "invalid" | "notFound" | "busy" | "notReady" | "generic";
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

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: workspace.organization.id,
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

    const { job, reused } = await enqueueModification(
      projectId,
      parsed.data,
    );

    if (reused) {
      return { error: "busy" };
    }

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

    return { jobId: job.id };
  } catch (error) {
    console.error("Project message failed", error);
    return { error: "generic" };
  }
}
