import { getJobDispatcher } from "@/engine/job-dispatcher";
import { db } from "@/lib/db";

export async function enqueueBuild(
  projectId: string,
  creditTransactionId?: string,
) {
  const dispatcher = (process.env.JOB_DISPATCHER ?? "process").toLowerCase();

  if (dispatcher === "process" && process.platform !== "win32") {
    throw new Error(
      "Desktop exports require a Windows build agent. Configure JOB_DISPATCHER=postgres with a Windows worker before enabling exports on this host.",
    );
  }

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
    data: {
      projectId,
      status: "queued",
      creditTransactionId: creditTransactionId ?? null,
    },
  });

  await getJobDispatcher().dispatchBuild(projectId, {
    id: job.id,
    creditTransactionId: job.creditTransactionId,
  });

  return { job, reused: false };
}
