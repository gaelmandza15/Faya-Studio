"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getWorkspacesRoot } from "@/engine/workspace";
import {
  createProjectVersion,
  restoreProjectFiles,
} from "@/engine/versions";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";

export type RestoreProjectVersionResult =
  | { ok: true; versionNumber: number }
  | { error: "notFound" | "busy" | "forbidden" | "generic" };

export async function restoreProjectVersionAction(
  projectId: string,
  versionId: string,
): Promise<RestoreProjectVersionResult> {
  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "version.restore")) {
      return { error: "forbidden" };
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: workspace.organization.id,
      },
    });

    if (!project) {
      return { error: "notFound" };
    }

    const [activeJob, activeBuild] = await Promise.all([
      db.generationJob.findFirst({
        where: {
          projectId,
          status: { in: ["queued", "running"] },
        },
      }),
      db.buildJob.findFirst({
        where: {
          projectId,
          status: { in: ["queued", "running"] },
        },
      }),
    ]);

    if (activeJob || activeBuild) {
      return { error: "busy" };
    }

    const version = await db.projectVersion.findFirst({
      where: { id: versionId, projectId },
    });

    if (!version) {
      return { error: "notFound" };
    }

    await restoreProjectFiles(projectId, version.number);
    await createProjectVersion(db, projectId, {
      kind: "restore",
      summary: `Restauration de la version ${version.number}`,
    });

    const job = await db.generationJob.create({
      data: {
        projectId,
        status: "done",
        kind: "restore",
      },
    });

    const jobsDir = path.join(
      getWorkspacesRoot(),
      projectId,
      ".faya",
      "jobs",
    );
    const resultsDir = path.join(
      getWorkspacesRoot(),
      projectId,
      ".faya",
      "results",
    );
    await mkdir(jobsDir, { recursive: true });
    await mkdir(resultsDir, { recursive: true });
    await writeFile(path.join(jobsDir, `${job.id}.jsonl`), "", "utf8");
    await writeFile(
      path.join(resultsDir, `${job.id}.json`),
      JSON.stringify({ summary: `Version ${version.number} restaurée.` }),
      "utf8",
    );

    await db.projectMessage.create({
      data: {
        projectId,
        jobId: job.id,
        role: "agent",
        content: `Version ${version.number} restaurée.`,
      },
    });

    await db.project.update({
      where: { id: projectId },
      data: { status: "ready", lastActivityAt: new Date() },
    });

    revalidatePath("/");
    revalidatePath("/projets");
    revalidatePath("/applications");
    revalidatePath("/creer");

    return { ok: true, versionNumber: version.number };
  } catch (error) {
    console.error("Version restore failed", error);
    return { error: "generic" };
  }
}
