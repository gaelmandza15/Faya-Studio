import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import {
  runProjectAcceptance,
  saveAcceptanceRecord,
} from "../src/engine/acceptance-service";
import { resolveAcceptanceBaseUrl } from "../src/engine/acceptance-gate";

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const projectId = getArg("--project") ?? process.argv[2];

  if (!projectId) {
    console.error(
      "Usage: tsx scripts/verify-acceptance-gate.ts --project <id> [--base-url <url>]",
    );
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient();

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        status: true,
        organizationId: true,
        createdById: true,
      },
    });

    if (!project) {
      console.error(`Project not found: ${projectId}`);
      process.exitCode = 2;
      return;
    }

    const userId =
      project.createdById ??
      (
        await prisma.membership.findFirst({
          where: { organizationId: project.organizationId },
          select: { userId: true },
          orderBy: { createdAt: "asc" },
        })
      )?.userId;

    if (!userId) {
      console.error("No member can run the acceptance gate.");
      process.exitCode = 2;
      return;
    }

    const baseUrl = (
      getArg("--base-url") ?? resolveAcceptanceBaseUrl()
    ).replace(/\/+$/, "");

    console.log(
      `Acceptance gate for "${project.name}" (${project.status}) against ${baseUrl}`,
    );

    const run = await runProjectAcceptance({
      prisma,
      projectId: project.id,
      organizationId: project.organizationId,
      userId,
      baseUrl,
      onLog: (message, details) =>
        console.log(`[gate] ${message}`, details ?? ""),
    });

    await saveAcceptanceRecord(prisma, project.id, run.record);
    console.log(JSON.stringify(run, null, 2));

    if (run.outcome.status !== "passed") process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
