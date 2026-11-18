import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { refundCredits } from "@/engine/credits";
import { getWorkspacesRoot } from "@/engine/workspace";
import { CREDIT_REFUND_REASONS } from "@/lib/credit-costs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface GenerationDispatchJob {
  id: string;
  kind: string;
  creditTransactionId: string | null;
}

export interface BuildDispatchJob {
  id: string;
  creditTransactionId: string | null;
}

/**
 * Dispatches queued jobs to an execution backend.
 *
 * Local/default: detached `tsx` worker process.
 * Future cloud: a Postgres-backed queue consumed by dedicated workers.
 */
export interface JobDispatcher {
  dispatchGeneration(
    projectId: string,
    job: GenerationDispatchJob,
  ): Promise<void>;
  dispatchBuild(projectId: string, job: BuildDispatchJob): Promise<void>;
}

interface SpawnInput {
  script: string;
  logPrefix: string;
  projectId: string;
  jobId: string;
  onError: (error: Error) => void;
}

async function spawnWorker(input: SpawnInput) {
  const workerPath = path.join(process.cwd(), "scripts", input.script);
  const tsxCli = path.join(
    process.cwd(),
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );
  const logsDir = path.join(getWorkspacesRoot(), ".logs");
  await mkdir(logsDir, { recursive: true });

  const logHandle = await open(path.join(logsDir, `${input.jobId}.log`), "a");

  await logHandle.write(
    `[${input.logPrefix}] Starting worker for project ${input.projectId}, job ${input.jobId}\n`,
  );

  try {
    const child = spawn(
      process.execPath,
      [
        tsxCli,
        workerPath,
        "--project",
        input.projectId,
        "--job",
        input.jobId,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        detached: true,
        stdio: ["ignore", logHandle.fd, logHandle.fd],
        windowsHide: true,
      },
    );

    child.on("error", input.onError);
    child.unref();
  } finally {
    await logHandle.close();
  }
}

class ProcessJobDispatcher implements JobDispatcher {
  async dispatchGeneration(
    projectId: string,
    job: GenerationDispatchJob,
  ): Promise<void> {
    const log = logger.child({ projectId, jobId: job.id });

    await spawnWorker({
      script: "generation-worker.ts",
      logPrefix: "jobs",
      projectId,
      jobId: job.id,
      onError: (error) => {
        log.error("Generation worker failed to start", {
          error: error.message,
        });

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

        if (job.creditTransactionId) {
          void refundCredits(db, {
            transactionId: job.creditTransactionId,
            reason:
              CREDIT_REFUND_REASONS[
                job.kind === "modify" ? "modification" : "generation"
              ],
          });
        }
      },
    });
  }

  async dispatchBuild(
    projectId: string,
    job: BuildDispatchJob,
  ): Promise<void> {
    const log = logger.child({ projectId, jobId: job.id });

    await spawnWorker({
      script: "build-worker.ts",
      logPrefix: "build-jobs",
      projectId,
      jobId: job.id,
      onError: (error) => {
        log.error("Build worker failed to start", { error: error.message });

        void db.buildJob
          .update({
            where: { id: job.id },
            data: { status: "error", error: error.message },
          })
          .catch(() => undefined);

        if (job.creditTransactionId) {
          void refundCredits(db, {
            transactionId: job.creditTransactionId,
            reason: CREDIT_REFUND_REASONS.build,
          });
        }
      },
    });
  }
}

const globalForDispatcher = globalThis as unknown as {
  __fayaJobDispatcher?: JobDispatcher;
};

export function getJobDispatcher(): JobDispatcher {
  const provider = (process.env.JOB_DISPATCHER ?? "process").toLowerCase();

  if (provider !== "process") {
    throw new Error(
      `Job dispatcher "${provider}" is not implemented. Use JOB_DISPATCHER=process.`,
    );
  }

  if (!globalForDispatcher.__fayaJobDispatcher) {
    globalForDispatcher.__fayaJobDispatcher = new ProcessJobDispatcher();
  }

  return globalForDispatcher.__fayaJobDispatcher;
}
