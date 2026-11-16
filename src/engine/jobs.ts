import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

type GenerationJobRecord = {
  id: string;
};

async function spawnGenerationWorker(
  projectId: string,
  job: GenerationJobRecord,
) {
  const workerPath = path.join(
    process.cwd(),
    "scripts",
    "generation-worker.ts",
  );
  const tsxCli = path.join(
    process.cwd(),
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );
  const logsDir = path.join(process.cwd(), "workspaces", ".logs");
  await mkdir(logsDir, { recursive: true });

  const logHandle = await open(
    path.join(logsDir, `${job.id}.log`),
    "a",
  );
  await logHandle.write(
    `[jobs] Starting worker for project ${projectId}, job ${job.id}\n`,
  );

  try {
    const child = spawn(
      process.execPath,
      [
        tsxCli,
        workerPath,
        "--project",
        projectId,
        "--job",
        job.id,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        detached: true,
        stdio: ["ignore", logHandle.fd, logHandle.fd],
        windowsHide: true,
      },
    );

    child.on("error", (error) => {
      void db.generationJob
        .update({
          where: { id: job.id },
          data: { status: "error", error: error.message },
        })
        .catch(() => undefined);

      void db.project
        .update({
          where: { id: projectId },
          data: { status: "error" },
        })
        .catch(() => undefined);
    });

    child.unref();
  } finally {
    await logHandle.close();
  }
}

async function findActiveJob(projectId: string) {
  return db.generationJob.findFirst({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function enqueueGeneration(projectId: string) {
  const active = await findActiveJob(projectId);

  if (active) {
    return { job: active, reused: true };
  }

  const job = await db.generationJob.create({
    data: { projectId, status: "queued", kind: "generate" },
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "generating", lastActivityAt: new Date() },
  });

  await spawnGenerationWorker(projectId, job);
  return { job, reused: false };
}

export async function enqueueModification(
  projectId: string,
  instruction: string,
) {
  const active = await findActiveJob(projectId);

  if (active) {
    return { job: active, reused: true };
  }

  const job = await db.generationJob.create({
    data: {
      projectId,
      status: "queued",
      kind: "modify",
      instruction,
    },
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "generating", lastActivityAt: new Date() },
  });

  await spawnGenerationWorker(projectId, job);
  return { job, reused: false };
}
