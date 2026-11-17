import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { getWorkspacesRoot } from "./workspace";

const VERSIONS_DIR = path.join(".faya", "versions");
const EXCLUDED = [".faya", ".build", ".git", "node_modules"];

function projectDir(projectId: string): string {
  return path.join(getWorkspacesRoot(), projectId);
}

export function versionFilesDir(
  projectId: string,
  number: number,
): string {
  return path.join(projectDir(projectId), VERSIONS_DIR, `v${number}`);
}

async function countFiles(directory: string): Promise<number> {
  let count = 0;

  for (const entry of await readdir(directory, {
    withFileTypes: true,
  })) {
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      count += await countFiles(absolute);
    } else if (entry.isFile()) {
      count += 1;
    }
  }

  return count;
}

export async function snapshotProjectFiles(
  projectId: string,
  number: number,
): Promise<number> {
  const root = projectDir(projectId);
  const target = versionFilesDir(projectId, number);

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  for (const entry of await readdir(root, {
    withFileTypes: true,
  })) {
    if (EXCLUDED.includes(entry.name)) continue;

    await cp(
      path.join(root, entry.name),
      path.join(target, entry.name),
      { recursive: true },
    );
  }

  return countFiles(target);
}

export async function restoreProjectFiles(
  projectId: string,
  number: number,
): Promise<void> {
  const root = projectDir(projectId);
  const source = versionFilesDir(projectId, number);
  const info = await stat(source).catch(() => null);

  if (!info?.isDirectory()) {
    throw new Error(`Version ${number} not found.`);
  }

  await mkdir(root, { recursive: true });

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === ".faya") continue;
    await rm(path.join(root, entry.name), {
      recursive: true,
      force: true,
    });
  }

  await cp(source, root, { recursive: true });
}

export async function clearProjectFiles(projectId: string): Promise<void> {
  const root = projectDir(projectId);
  await mkdir(root, { recursive: true });

  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === ".faya") continue;
    await rm(path.join(root, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

export async function createProjectVersion(
  prisma: PrismaClient,
  projectId: string,
  input: {
    kind: "generate" | "modify" | "baseline" | "restore";
    jobId?: string | null;
    summary?: string | null;
  },
) {
  const aggregate = await prisma.projectVersion.aggregate({
    where: { projectId },
    _max: { number: true },
  });
  const number = (aggregate._max.number ?? 0) + 1;
  const fileCount = await snapshotProjectFiles(projectId, number);

  return prisma.projectVersion.create({
    data: {
      projectId,
      number,
      kind: input.kind,
      jobId: input.jobId ?? null,
      summary: input.summary?.slice(0, 4000) ?? null,
      fileCount,
    },
  });
}

export async function restoreLatestProjectFiles(
  prisma: PrismaClient,
  projectId: string,
): Promise<number | undefined> {
  const latest = await prisma.projectVersion.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
  });

  if (!latest) return undefined;

  await restoreProjectFiles(projectId, latest.number);
  return latest.number;
}
