import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { createWriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { generateApp, type EngineEvent } from "../src/engine/pi-engine";
import { getWorkspacesRoot } from "../src/engine/workspace";

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

  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "running", error: null },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "generating", lastActivityAt: new Date() },
  });

  const workspaceDir = path.join(getWorkspacesRoot(), projectId);
  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(path.join(workspaceDir, ".faya"), { recursive: true });

  const eventsPath = path.join(workspaceDir, ".faya", "events.jsonl");
  const resultPath = path.join(workspaceDir, ".faya", "result.json");
  const eventsStream = createWriteStream(eventsPath, { flags: "a" });

  const closeEvents = () =>
    new Promise<void>((resolve) => {
      if (eventsStream.closed) {
        resolve();
        return;
      }
      eventsStream.end(() => resolve());
    });

  try {
    const result = await generateApp({
      prompt: project.prompt,
      workspaceDir,
      onEvent(event) {
        try {
          eventsStream.write(`${JSON.stringify(sanitize(event))}\n`);
        } catch {
          // The event log is best-effort; generation must continue.
        }
      },
    });

    await writeFile(resultPath, JSON.stringify(result, null, 2), "utf8");

    if (result.ok) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "ready", lastActivityAt: new Date() },
      });
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: "done", error: null },
      });
    } else {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "error", lastActivityAt: new Date() },
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
    await prisma.project
      .update({
        where: { id: projectId },
        data: { status: "error", lastActivityAt: new Date() },
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
