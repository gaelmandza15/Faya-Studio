"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  APP_ROLES,
  appCan,
  getProjectAccess,
} from "@/lib/project-access";
import { getWorkspaceContext } from "@/lib/workspace";

const roleSchema = z.enum(APP_ROLES);
const modeSchema = z.enum(["organization", "restricted"]);

export type ProjectAccessMutationResult =
  | { ok: true }
  | {
      error:
        | "notFound"
        | "forbidden"
        | "invalid"
        | "notMember"
        | "lastAdmin"
        | "generic";
    };

async function loadAccess(projectId: string) {
  const workspace = await getWorkspaceContext();
  const access = await getProjectAccess(workspace.user.id, projectId);

  if (!access) {
    return { error: "notFound" as const };
  }

  if (!appCan(access.role, "manage")) {
    return { error: "forbidden" as const };
  }

  return { access };
}

function revalidate(projectId: string) {
  revalidatePath(`/applications/${projectId}`);
  revalidatePath("/applications");
  revalidatePath("/projets");
}

export async function setProjectAccessModeAction(
  projectId: string,
  mode: string,
): Promise<ProjectAccessMutationResult> {
  const parsedMode = modeSchema.safeParse(mode);

  if (!parsedMode.success) {
    return { error: "invalid" };
  }

  try {
    const loaded = await loadAccess(projectId);

    if ("error" in loaded && loaded.error) return { error: loaded.error };

    await db.project.update({
      where: { id: projectId },
      data: { accessMode: parsedMode.data, lastActivityAt: new Date() },
    });

    revalidate(projectId);
    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}

export async function addProjectMemberAction(
  projectId: string,
  userId: string,
  role: string,
): Promise<ProjectAccessMutationResult> {
  const parsedRole = roleSchema.safeParse(role);

  if (!parsedRole.success || !userId) {
    return { error: "invalid" };
  }

  try {
    const loaded = await loadAccess(projectId);

    if ("error" in loaded && loaded.error) return { error: loaded.error };

    const membership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: loaded.access.organizationId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      return { error: "notMember" };
    }

    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role: parsedRole.data },
      update: { role: parsedRole.data },
    });

    revalidate(projectId);
    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}

export async function updateProjectMemberRoleAction(
  projectId: string,
  userId: string,
  role: string,
): Promise<ProjectAccessMutationResult> {
  const parsedRole = roleSchema.safeParse(role);

  if (!parsedRole.success || !userId) {
    return { error: "invalid" };
  }

  try {
    const loaded = await loadAccess(projectId);

    if ("error" in loaded && loaded.error) return { error: loaded.error };

    const result = await db.projectMember.updateMany({
      where: { projectId, userId },
      data: { role: parsedRole.data },
    });

    if (result.count === 0) {
      return { error: "notMember" };
    }

    revalidate(projectId);
    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}

export async function removeProjectMemberAction(
  projectId: string,
  userId: string,
): Promise<ProjectAccessMutationResult> {
  try {
    const loaded = await loadAccess(projectId);

    if ("error" in loaded && loaded.error) return { error: loaded.error };

    await db.projectMember.deleteMany({
      where: { projectId, userId },
    });

    revalidate(projectId);
    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}
