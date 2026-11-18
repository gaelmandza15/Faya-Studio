import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  backupProjectDatabase,
  closeProjectDatabase,
  getProjectDatabase,
} from "@/engine/project-db";
import { getWorkspacesRoot } from "@/engine/workspace";

export const BACKUP_KIND_MANUAL = "manual";
export const BACKUP_KIND_PRE_RESTORE = "pre-restore";

export function getProjectBackupDir(projectId: string): string {
  return path.join(getWorkspacesRoot(), projectId, ".faya", "backups");
}

export function getProjectBackupPath(
  projectId: string,
  fileName: string,
): string {
  if (!/^[A-Za-z0-9._-]+\.db$/.test(fileName)) {
    throw new Error("Invalid backup file name.");
  }

  return path.join(getProjectBackupDir(projectId), fileName);
}

export async function createProjectBackup(
  prisma: PrismaClient,
  projectId: string,
  kind: string = BACKUP_KIND_MANUAL,
) {
  const version = await prisma.projectVersion.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const id = randomUUID();
  const fileName = `${id}.db`;
  const target = path.join(getProjectBackupDir(projectId), fileName);

  await mkdir(path.dirname(target), { recursive: true });

  const size = await backupProjectDatabase(projectId, target);

  return prisma.projectBackup.create({
    data: {
      id,
      projectId,
      kind,
      fileName,
      size,
      versionNumber: version?.number ?? null,
    },
  });
}

export async function listProjectBackups(
  prisma: PrismaClient,
  projectId: string,
  take = 20,
) {
  return prisma.projectBackup.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Restores the platform-side SQLite database from a snapshot.
 *
 * The caller must ensure the project is not synced: desktop devices keep their
 * own local copies and are not rolled back by this operation.
 */
export async function restoreProjectBackup(
  prisma: PrismaClient,
  projectId: string,
  backupId: string,
) {
  const backup = await prisma.projectBackup.findFirst({
    where: { id: backupId, projectId },
  });

  if (!backup) {
    throw new Error("Backup not found.");
  }

  const source = getProjectBackupPath(projectId, backup.fileName);
  const info = await stat(source).catch(() => null);

  if (!info?.isFile()) {
    throw new Error("Backup file is missing.");
  }

  // Keep the current state so a restore can itself be undone.
  await createProjectBackup(prisma, projectId, BACKUP_KIND_PRE_RESTORE);

  closeProjectDatabase(projectId);

  const fayaDir = path.join(getWorkspacesRoot(), projectId, ".faya");
  const databasePath = path.join(fayaDir, "app.db");

  await rm(databasePath, { force: true });
  await rm(`${databasePath}-wal`, { force: true });
  await rm(`${databasePath}-shm`, { force: true });
  await copyFile(source, databasePath);

  // Reopen and reapply the schema so the restored database is ready.
  await getProjectDatabase(projectId);

  return backup;
}

export async function deleteProjectBackup(
  prisma: PrismaClient,
  projectId: string,
  backupId: string,
) {
  const backup = await prisma.projectBackup.findFirst({
    where: { id: backupId, projectId },
  });

  if (!backup) return false;

  await rm(getProjectBackupPath(projectId, backup.fileName), {
    force: true,
  });
  await prisma.projectBackup.delete({ where: { id: backup.id } });

  return true;
}
