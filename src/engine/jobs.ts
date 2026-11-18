import { getJobDispatcher } from "@/engine/job-dispatcher";
import { db } from "@/lib/db";

async function findActiveJob(projectId: string) {
  return db.generationJob.findFirst({
    where: {
      projectId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function enqueueGeneration(
  projectId: string,
  creditTransactionId?: string,
) {
  const active = await findActiveJob(projectId);

  if (active) {
    return { job: active, reused: true };
  }

  const job = await db.generationJob.create({
    data: {
      projectId,
      status: "queued",
      kind: "generate",
      creditTransactionId: creditTransactionId ?? null,
    },
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "generating", lastActivityAt: new Date() },
  });

  await getJobDispatcher().dispatchGeneration(projectId, {
    id: job.id,
    kind: job.kind,
    creditTransactionId: job.creditTransactionId,
  });

  return { job, reused: false };
}

export async function enqueueModification(
  projectId: string,
  instruction: string,
  creditTransactionId?: string,
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
      creditTransactionId: creditTransactionId ?? null,
    },
  });

  await db.project.update({
    where: { id: projectId },
    data: { status: "generating", lastActivityAt: new Date() },
  });

  await getJobDispatcher().dispatchGeneration(projectId, {
    id: job.id,
    kind: job.kind,
    creditTransactionId: job.creditTransactionId,
  });

  return { job, reused: false };
}
