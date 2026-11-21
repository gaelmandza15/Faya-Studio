"use server";

import { revalidatePath } from "next/cache";
import { stat } from "node:fs/promises";
import {
  BACKUP_KIND_MANUAL,
  createProjectBackup,
  deleteProjectBackup,
  getProjectBackupPath,
  listProjectBackups,
  restoreProjectBackup,
} from "@/engine/backups";
import { db } from "@/lib/db";
import { broadcastProjectUpdate } from "@/lib/project-events";
import { appCan, getProjectAccess } from "@/lib/project-access";
import { getWorkspaceContext } from "@/lib/workspace";

export type CreateBackupResult =
  | {
      ok: true;
      backup: {
        id: string;
        kind: string;
        size: number;
        versionNumber: number | null;
        createdAt: string;
      };
    }
  | { error: "notFound" | "forbidden" | "generic" };

export type RestoreBackupResult =
  | { ok: true }
  | { error: "notFound" | "forbidden" | "syncEnabled" | "missingFile" | "generic" };

export type DeleteBackupResult =
  | { ok: true }
  | { error: "notFound" | "forbidden" | "generic" };

type LoadedProject =
  | { error: "notFound" | "forbidden" }
  | { project: { id: string; name: string; syncEnabled: boolean } };

async function loadProject(projectId: string): Promise<LoadedProject> {
  const workspace = await getWorkspaceContext();
  const access = await getProjectAccess(workspace.user.id, projectId);

  if (!access || !appCan(access.role, "manage")) {
    return { error: "forbidden" as const };
  }

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: access.organizationId },
    select: { id: true, name: true, syncEnabled: true },
  });

  if (!project) {
    return { error: "notFound" as const };
  }

  return { project };
}

function revalidate(projectId: string) {
  revalidatePath(`/applications/${projectId}`);
}

export async function createBackupAction(
  projectId: string,
): Promise<CreateBackupResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) return { error: loaded.error };

    const backup = await createProjectBackup(
      db,
      projectId,
      BACKUP_KIND_MANUAL,
    );

    // Keep the 20 most recent backups.
    const backups = await listProjectBackups(db, projectId, 100);

    for (const old of backups.slice(20)) {
      await deleteProjectBackup(db, projectId, old.id).catch(() => undefined);
    }

    revalidate(projectId);

    return {
      ok: true,
      backup: {
        id: backup.id,
        kind: backup.kind,
        size: backup.size,
        versionNumber: backup.versionNumber,
        createdAt: backup.createdAt.toISOString(),
      },
    };
  } catch {
    return { error: "generic" };
  }
}

export async function restoreBackupAction(
  projectId: string,
  backupId: string,
): Promise<RestoreBackupResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) return { error: loaded.error };

    if (loaded.project.syncEnabled) {
      return { error: "syncEnabled" };
    }

    const backup = await db.projectBackup.findFirst({
      where: { id: backupId, projectId },
      select: { fileName: true },
    });

    if (!backup) return { error: "notFound" };

    // Validate the file exists before closing the live database.
    try {
      const filePath = getProjectBackupPath(projectId, backup.fileName);
      const info = await stat(filePath);
      if (!info.isFile()) return { error: "missingFile" };
    } catch {
      return { error: "missingFile" };
    }

    await restoreProjectBackup(db, projectId, backupId);

    broadcastProjectUpdate(projectId, {
      type: "restore",
      timestamp: new Date().toISOString(),
    });

    revalidate(projectId);

    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}

export async function deleteBackupAction(
  projectId: string,
  backupId: string,
): Promise<DeleteBackupResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) return { error: loaded.error };

    const deleted = await deleteProjectBackup(db, projectId, backupId);

    if (!deleted) return { error: "notFound" };

    revalidate(projectId);

    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}
