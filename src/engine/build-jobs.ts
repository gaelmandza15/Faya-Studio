import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

export async function enqueueBuild(projectId: string) {
  await db.buildJob.updateMany({
    where: {
      status: "running",
      updatedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    data: {
      status: "error",
      error: "The build worker stopped responding.",
    },
  });

  const active = await db.buildJob.findFirst({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    return { job: active, reused: true };
  }

  const job = await db.buildJob.create({
    data: { projectId, status: "queued" },
  });

  const workerPath = path.join(
    process.cwd(),
    "scripts",
    "build-worker.ts",
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
    `[build-jobs] Starting build for project ${projectId}, job ${job.id}\n`,
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
      void db.buildJob
        .update({
          where: { id: job.id },
          data: { status: "error", error: error.message },
        })
        .catch(() => undefined);
    });

    child.unref();
  } finally {
    await logHandle.close();
  }

  return { job, reused: false };
}
