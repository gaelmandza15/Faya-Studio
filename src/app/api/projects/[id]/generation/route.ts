import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { EngineEvent } from "@/engine/pi-engine";
import { getWorkspacesRoot } from "@/engine/workspace";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

async function readEvents(
  eventsPath: string,
): Promise<EngineEvent[] | null> {
  try {
    const raw = await readFile(eventsPath, "utf8");

    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as EngineEvent;
        } catch {
          return null;
        }
      })
      .filter((event): event is EngineEvent => event !== null);
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findFirst({
    where: {
      id,
      organization: {
        memberships: {
          some: { userId: session.userId },
        },
      },
    },
  });

  if (!project) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const job = await db.generationJob.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });

  const messages = await db.projectMessage.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
  });

  const workspaceDir = path.join(getWorkspacesRoot(), id);
  const legacyEventsPath = path.join(
    workspaceDir,
    ".faya",
    "events.jsonl",
  );
  const legacyResultPath = path.join(
    workspaceDir,
    ".faya",
    "result.json",
  );

  const jobEvents = job
    ? await readEvents(
        path.join(workspaceDir, ".faya", "jobs", `${job.id}.jsonl`),
      )
    : null;

  const events =
    jobEvents ?? (await readEvents(legacyEventsPath)) ?? [];

  const url = new URL(request.url);
  const after = Math.max(
    0,
    Number.parseInt(url.searchParams.get("after") ?? "0", 10) || 0,
  );
  const clientJobId = url.searchParams.get("job");
  const eventsReset = job
    ? clientJobId !== job.id || after > events.length
    : false;
  const start = eventsReset ? 0 : after;
  const sliced = events.slice(start);

  const terminal =
    job?.status === "done" ||
    job?.status === "error" ||
    (!job && project.status === "ready");

  let summary = "";

  if (terminal) {
    const resultPaths = job
      ? [
          path.join(
            workspaceDir,
            ".faya",
            "results",
            `${job.id}.json`,
          ),
          legacyResultPath,
        ]
      : [legacyResultPath];

    for (const resultPath of resultPaths) {
      try {
        const result = JSON.parse(
          await readFile(resultPath, "utf8"),
        ) as { summary?: unknown };

        if (typeof result.summary === "string") {
          summary = result.summary;
        }

        break;
      } catch {
        // Try the next result location.
      }
    }
  }

  let previewReady = false;

  try {
    const info = await stat(path.join(workspaceDir, "index.html"));
    previewReady = info.isFile();
  } catch {
    // No generated preview.
  }

  return Response.json(
    {
      projectStatus: project.status,
      job: job
        ? {
            id: job.id,
            status: job.status,
            error: job.error,
            kind: job.kind,
            instruction: job.instruction,
          }
        : null,
      events: sliced,
      eventsReset,
      nextCursor: start + sliced.length,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        jobId: message.jobId,
        createdAt: message.createdAt,
      })),
      previewReady,
      summary,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
