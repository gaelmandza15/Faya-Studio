"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { db } from "@/lib/db";
import { enqueueGeneration, enqueueModification } from "@/engine/jobs";
import { toProjectIcon } from "@/lib/project-utils";
import type { ProjectIcon } from "@/lib/types";
import { getWorkspaceContext } from "@/lib/workspace";

const startProjectSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  name: z.string().trim().min(1).max(80).optional(),
  icon: z.string().optional(),
});

const projectNameSchema = z.string().trim().min(1).max(80);

export type StartProjectResult =
  | { projectId: string }
  | { error: "invalidPrompt" | "generic" };

export type ProjectMutationResult =
  | { ok: true }
  | { error: "notFound" | "invalidName" | "generic" };

export type DuplicateProjectResult =
  | { projectId: string }
  | { error: "notFound" | "generic" };

function revalidateProjectViews() {
  revalidatePath("/");
  revalidatePath("/projets");
  revalidatePath("/applications");
}

function deriveProject(
  prompt: string,
  dict: ReturnType<typeof getDictionary>,
): { name: string; icon: ProjectIcon } {
  const normalized = prompt.toLowerCase();

  if (/(stock|inventaire|inventory|produit|product)/.test(normalized)) {
    return { name: dict.projectNames.stock, icon: "cube" };
  }

  if (/(factur|invoice|devis|quote)/.test(normalized)) {
    return { name: dict.projectNames.invoicing, icon: "chart" };
  }

  if (/(crm|client|customer|prospect|lead)/.test(normalized)) {
    return { name: dict.projectNames.crm, icon: "users" };
  }

  if (/(tâche|tache|task|todo|to-do)/.test(normalized)) {
    return { name: dict.projectNames.tasks, icon: "calendar" };
  }

  if (/(dépense|depense|expense|budget)/.test(normalized)) {
    return { name: dict.projectNames.expenses, icon: "chart" };
  }

  if (/(planning|calendrier|calendar|tâche|tache|task)/.test(normalized)) {
    return { name: dict.projectNames.planning, icon: "calendar" };
  }

  return { name: dict.projectNames.generic, icon: "cube" };
}

export async function startProjectAction(input: {
  prompt: string;
  name?: string;
  icon?: string;
}): Promise<StartProjectResult> {
  const parsed = startProjectSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "invalidPrompt" };
  }

  try {
    const workspace = await getWorkspaceContext();
    const locale = await getLocale();
    const dict = getDictionary(locale);
    const derived = deriveProject(parsed.data.prompt, dict);

    const project = await db.project.create({
      data: {
        name: parsed.data.name || derived.name,
        prompt: parsed.data.prompt,
        icon: toProjectIcon(parsed.data.icon ?? derived.icon),
        status: "generating",
        target: "desktop",
        organizationId: workspace.organization.id,
        createdById: workspace.user.id,
        lastActivityAt: new Date(),
      },
    });

    await db.projectMessage
      .create({
        data: {
          projectId: project.id,
          role: "user",
          content: parsed.data.prompt,
        },
      })
      .catch((error) => {
        console.error("Failed to persist initial message", error);
      });

    try {
      await enqueueGeneration(project.id);
    } catch (error) {
      console.error("Failed to enqueue generation", error);
    }

    revalidateProjectViews();
    return { projectId: project.id };
  } catch (error) {
    console.error("Project creation failed", error);
    return { error: "generic" };
  }
}

export async function markProjectReadyAction(projectId: string) {
  try {
    const workspace = await getWorkspaceContext();

    await db.project.updateMany({
      where: {
        id: projectId,
        organizationId: workspace.organization.id,
      },
      data: {
        status: "ready",
        lastActivityAt: new Date(),
      },
    });

    revalidateProjectViews();
    return { ok: true as const };
  } catch (error) {
    console.error("Project update failed", error);
    return { error: "generic" as const };
  }
}

export async function renameProjectAction(
  projectId: string,
  name: string,
): Promise<ProjectMutationResult> {
  const parsedName = projectNameSchema.safeParse(name);

  if (!parsedName.success) {
    return { error: "invalidName" };
  }

  try {
    const workspace = await getWorkspaceContext();
    const result = await db.project.updateMany({
      where: {
        id: projectId,
        organizationId: workspace.organization.id,
      },
      data: {
        name: parsedName.data,
        lastActivityAt: new Date(),
      },
    });

    if (result.count === 0) {
      return { error: "notFound" };
    }

    revalidateProjectViews();
    return { ok: true };
  } catch (error) {
    console.error("Project rename failed", error);
    return { error: "generic" };
  }
}

export async function duplicateProjectAction(
  projectId: string,
): Promise<DuplicateProjectResult> {
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

    const locale = await getLocale();
    const dict = getDictionary(locale);

    const copy = await db.project.create({
      data: {
        name: `${project.name} (${dict.common.copySuffix})`,
        prompt: project.prompt,
        icon: project.icon,
        status: "generating",
        target: project.target,
        organizationId: workspace.organization.id,
        createdById: workspace.user.id,
        lastActivityAt: new Date(),
      },
    });

    revalidateProjectViews();
    return { projectId: copy.id };
  } catch (error) {
    console.error("Project duplication failed", error);
    return { error: "generic" };
  }
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ProjectMutationResult> {
  try {
    const workspace = await getWorkspaceContext();
    const result = await db.project.deleteMany({
      where: {
        id: projectId,
        organizationId: workspace.organization.id,
      },
    });

    if (result.count === 0) {
      return { error: "notFound" };
    }

    revalidateProjectViews();
    return { ok: true };
  } catch (error) {
    console.error("Project deletion failed", error);
    return { error: "generic" };
  }
}

export async function retryGenerationAction(projectId: string) {
  try {
    const workspace = await getWorkspaceContext();
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: workspace.organization.id,
      },
    });

    if (!project) {
      return { error: "notFound" as const };
    }

    const latest = await db.generationJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    if (latest?.kind === "modify" && latest.instruction) {
      const { job } = await enqueueModification(
        projectId,
        latest.instruction,
      );
      revalidateProjectViews();
      return { ok: true as const, jobId: job.id, kind: "modify" };
    }

    const { job } = await enqueueGeneration(projectId);
    revalidateProjectViews();
    return { ok: true as const, jobId: job.id, kind: "generate" };
  } catch (error) {
    console.error("Generation retry failed", error);
    return { error: "generic" as const };
  }
}
