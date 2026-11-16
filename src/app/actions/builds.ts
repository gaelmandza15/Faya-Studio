"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/workspace";
import { db } from "@/lib/db";
import { enqueueBuild } from "@/engine/build-jobs";

export type ExportProjectResult =
  | { jobId: string }
  | { error: "notFound" | "notReady" | "generic" };

export async function exportProjectAction(
  projectId: string,
): Promise<ExportProjectResult> {
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

    if (project.status !== "ready") {
      return { error: "notReady" };
    }

    const { job } = await enqueueBuild(project.id);
    revalidatePath("/applications");

    return { jobId: job.id };
  } catch (error) {
    console.error("Desktop export failed", error);
    return { error: "generic" };
  }
}
