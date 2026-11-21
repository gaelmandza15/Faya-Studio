"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import { db } from "@/lib/db";
import { enqueueGeneration, enqueueModification } from "@/engine/jobs";
import { chargeCredits, refundCredits } from "@/engine/credits";
import { removePublicationFiles } from "@/engine/publications";
import {
  CREDIT_COSTS,
  CREDIT_REFUND_REASONS,
} from "@/lib/credit-costs";
import { toProjectIcon } from "@/lib/project-utils";
import { appCan, getProjectAccess } from "@/lib/project-access";
import { can } from "@/lib/roles";
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
  | {
      error:
        | "invalidPrompt"
        | "insufficientCredits"
        | "forbidden"
        | "generic";
    };

export type ProjectMutationResult =
  | { ok: true }
  | { error: "notFound" | "invalidName" | "forbidden" | "generic" };

export type DuplicateProjectResult =
  | { projectId: string }
  | { error: "notFound" | "forbidden" | "generic" };

function revalidateProjectViews() {
  revalidatePath("/");
  revalidatePath("/projets");
  revalidatePath("/applications");
  revalidatePath("/creer");
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

    if (!can(workspace.organization.role, "project.create")) {
      return { error: "forbidden" };
    }

    const locale = await getLocale();
    const dict = getDictionary(locale);
    const derived = deriveProject(parsed.data.prompt, dict);

    const charge = await chargeCredits(db, {
      organizationId: workspace.organization.id,
      userId: workspace.user.id,
      amount: CREDIT_COSTS.generation,
      reason: "generation",
    });

    if (!charge.ok) {
      return {
        error:
          charge.reason === "insufficient"
            ? "insufficientCredits"
            : "generic",
      };
    }

    let project;

    try {
      project = await db.project.create({
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
    } catch (error) {
      await refundCredits(db, {
        transactionId: charge.transactionId,
        reason: CREDIT_REFUND_REASONS.generation,
      });
      throw error;
    }

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
      const { reused } = await enqueueGeneration(
        project.id,
        charge.transactionId,
      );

      if (reused) {
        await refundCredits(db, {
          transactionId: charge.transactionId,
          reason: CREDIT_REFUND_REASONS.generation,
        });
      }
    } catch (error) {
      console.error("Failed to enqueue generation", error);
      await refundCredits(db, {
        transactionId: charge.transactionId,
        reason: CREDIT_REFUND_REASONS.generation,
      });
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
    const access = await getProjectAccess(workspace.user.id, projectId);

    if (!access || !appCan(access.role, "write")) {
      return { error: "forbidden" as const };
    }

    await db.project.updateMany({
      where: {
        id: projectId,
        organizationId: access.organizationId,
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
    const access = await getProjectAccess(workspace.user.id, projectId);

    if (!access || !appCan(access.role, "write")) {
      return { error: "forbidden" };
    }

    const result = await db.project.updateMany({
      where: {
        id: projectId,
        organizationId: access.organizationId,
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

    if (!can(workspace.organization.role, "project.create")) {
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

    if (!can(workspace.organization.role, "project.delete")) {
      return { error: "forbidden" };
    }

    const access = await getProjectAccess(workspace.user.id, projectId);

    if (!access || !appCan(access.role, "manage")) {
      return { error: "forbidden" };
    }

    const publication = await db.publication.findUnique({
      where: { projectId },
      select: { slug: true },
    });

    const result = await db.project.deleteMany({
      where: {
        id: projectId,
        organizationId: access.organizationId,
      },
    });

    if (result.count === 0) {
      return { error: "notFound" };
    }

    if (publication) {
      await removePublicationFiles(publication.slug).catch(
        () => undefined,
      );
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

    if (!can(workspace.organization.role, "generation.run")) {
      return { error: "forbidden" as const };
    }

    const access = await getProjectAccess(workspace.user.id, projectId);

    if (!access || !appCan(access.role, "write")) {
      return { error: "forbidden" as const };
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: access.organizationId,
      },
    });

    if (!project) {
      return { error: "notFound" as const };
    }

    const latest = await db.generationJob.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    const isModification =
      latest?.kind === "modify" && Boolean(latest.instruction);
    const action = isModification ? "modification" : "generation";
    const charge = await chargeCredits(db, {
      organizationId: workspace.organization.id,
      userId: workspace.user.id,
      amount: CREDIT_COSTS[action],
      reason: action,
    });

    if (!charge.ok) {
      return {
        error:
          charge.reason === "insufficient"
            ? ("insufficientCredits" as const)
            : ("generic" as const),
      };
    }

    try {
      const enqueued =
        isModification && latest?.instruction
          ? await enqueueModification(
              projectId,
              latest.instruction,
              charge.transactionId,
            )
          : await enqueueGeneration(
              projectId,
              charge.transactionId,
            );

      if (enqueued.reused) {
        await refundCredits(db, {
          transactionId: charge.transactionId,
          reason: CREDIT_REFUND_REASONS[action],
        });
        return { error: "busy" as const };
      }

      revalidateProjectViews();
      return {
        ok: true as const,
        jobId: enqueued.job.id,
        kind: isModification ? "modify" : "generate",
      };
    } catch (error) {
      await refundCredits(db, {
        transactionId: charge.transactionId,
        reason: CREDIT_REFUND_REASONS[action],
      });
      throw error;
    }
  } catch (error) {
    console.error("Generation retry failed", error);
    return { error: "generic" as const };
  }
}
