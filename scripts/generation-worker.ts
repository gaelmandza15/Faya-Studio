import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { createWriteStream } from "node:fs";
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { generateApp, type EngineEvent } from "../src/engine/pi-engine";
import { getWorkspacesRoot } from "../src/engine/workspace";
import { refundCredits } from "../src/engine/credits";
import { CREDIT_REFUND_REASONS } from "../src/lib/credit-costs";
import {
  clearProjectFiles,
  createProjectVersion,
  restoreLatestProjectFiles,
} from "../src/engine/versions";

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sanitize(event: EngineEvent): EngineEvent {
  if (event.type === "tool_start") {
    const args = event.args as Record<string, unknown> | undefined;
    const safeArgs: Record<string, unknown> = {};

    if (args) {
      for (const key of ["path", "name", "summary"]) {
        if (key in args) safeArgs[key] = args[key];
      }
    }

    return { ...event, args: safeArgs };
  }

  if (event.type === "tool_end") {
    return { ...event, summary: event.summary?.slice(0, 500) };
  }

  if (event.type === "text") {
    return { ...event, text: event.text.slice(0, 2000) };
  }

  return event;
}

async function isFile(pathname: string): Promise<boolean> {
  try {
    const info = await stat(pathname);
    return info.isFile();
  } catch {
    return false;
  }
}

async function main() {
  const projectId = getArg("--project");
  const jobId = getArg("--job");

  if (!projectId || !jobId) {
    throw new Error("Missing --project or --job argument.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
  });

  if (!job || job.projectId !== projectId) {
    throw new Error(`Generation job not found: ${jobId}`);
  }

  const mode = job.kind === "modify" ? "modify" : "generate";

  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "running", error: null },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "generating", lastActivityAt: new Date() },
  });

  const workspaceDir = path.join(getWorkspacesRoot(), projectId);

  if (mode === "generate") {
    const messageCount = await prisma.projectMessage.count({
      where: { projectId },
    });

    if (messageCount === 0) {
      await prisma.projectMessage
        .create({
          data: {
            projectId,
            role: "user",
            content: project.prompt,
          },
        })
        .catch(() => undefined);
    }
  }

  const jobsDir = path.join(workspaceDir, ".faya", "jobs");
  const resultsDir = path.join(workspaceDir, ".faya", "results");
  await mkdir(jobsDir, { recursive: true });
  await mkdir(resultsDir, { recursive: true });

  const eventsPath = path.join(jobsDir, `${jobId}.jsonl`);
  const resultPath = path.join(resultsDir, `${jobId}.json`);
  const eventsStream = createWriteStream(eventsPath, { flags: "a" });

  const closeEvents = () =>
    new Promise<void>((resolve) => {
      if (eventsStream.closed) {
        resolve();
        return;
      }
      eventsStream.end(() => resolve());
    });

  const restoreAfterFailure = async (): Promise<number | undefined> => {
    try {
      return await restoreLatestProjectFiles(prisma, projectId);
    } catch (error) {
      console.error("Failed to restore the previous version", error);
      return undefined;
    }
  };

  const refundCharge = async (): Promise<void> => {
    if (!job.creditTransactionId) return;

    await refundCredits(prisma, {
      transactionId: job.creditTransactionId,
      reason:
        CREDIT_REFUND_REASONS[
          mode === "modify" ? "modification" : "generation"
        ],
    });
  };

  try {
    if (mode === "generate") {
      await clearProjectFiles(projectId);
    } else if (!(await isFile(path.join(workspaceDir, "index.html")))) {
      throw new Error(
        "The application has no generated files to modify. Generate it first.",
      );
    }

    if (mode === "modify") {
      const versionCount = await prisma.projectVersion.count({
        where: { projectId },
      });

      if (versionCount === 0) {
        await createProjectVersion(prisma, projectId, {
          kind: "baseline",
          summary: "État avant la première modification",
        });
      }
    }

    const desktopApp =
      (await isFile(path.join(workspaceDir, "desktop-schema.sql"))) &&
      (await isFile(path.join(workspaceDir, "db.js")));

    const target = desktopApp
      ? "desktop"
      : mode === "modify"
        ? "web"
        : project.target === "web"
          ? "web"
          : "desktop";

    const instruction = job.instruction?.trim() ?? "";

    if (mode === "modify" && !instruction) {
      throw new Error("Missing modification instruction.");
    }

    const result = await generateApp({
      prompt: mode === "modify" ? instruction : project.prompt,
      context: project.prompt,
      workspaceDir,
      target,
      mode,
      onEvent(event) {
        try {
          eventsStream.write(`${JSON.stringify(sanitize(event))}\n`);
        } catch {
          // The event log is best-effort; generation must continue.
        }
      },
    });

    await writeFile(resultPath, JSON.stringify(result, null, 2), "utf8");

    if (result.ok && target === "desktop") {
      await copyFile(
        path.join(workspaceDir, "desktop-schema.sql"),
        path.join(workspaceDir, ".faya", "desktop-schema.sql"),
      ).catch(() => undefined);
    }

    if (result.ok) {
      const summary = result.summary.trim();

      try {
        await createProjectVersion(prisma, projectId, {
          kind: mode,
          jobId,
          summary: summary || null,
        });
      } catch (error) {
        console.error("Failed to snapshot project version", error);
      }

      if (summary) {
        await prisma.projectMessage
          .create({
            data: {
              projectId,
              jobId,
              role: "agent",
              content: summary.slice(0, 4000),
            },
          })
          .catch(() => undefined);
      }

      await prisma.project.update({
        where: { id: projectId },
        data: { status: "ready", lastActivityAt: new Date() },
      });
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "done", error: null },
      });
    } else {
      await refundCharge();
      const restored = await restoreAfterFailure();
      await prisma.project.update({
        where: { id: projectId },
        data: {
          status: restored ? "ready" : "error",
          lastActivityAt: new Date(),
        },
      });
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "error",
          error: result.error ?? "Generation failed.",
        },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    const failure = {
      ok: false,
      summary: "",
      workspaceDir,
      files: [],
      checkReport: "",
      error: message,
    };

    await writeFile(resultPath, JSON.stringify(failure, null, 2), "utf8").catch(
      () => undefined,
    );

    await refundCharge();
    const restored = await restoreAfterFailure();

    await prisma.project
      .update({
        where: { id: projectId },
        data: {
          status: restored ? "ready" : "error",
          lastActivityAt: new Date(),
        },
      })
      .catch(() => undefined);
    await prisma.generationJob
      .update({
        where: { id: jobId },
        data: { status: "error", error: message },
      })
      .catch(() => undefined);
  } finally {
    await closeEvents();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
