import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

export async function enqueueGeneration(projectId: string) {
  const active = await db.generationJob.findFirst({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    return { job: active, reused: true };
  }

  const job = await db.generationJob.create({
    data: { projectId, status: "queued" },
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "generating", lastActivityAt: new Date() },
  });

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

  return { job, reused: false };
}
