import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { EngineEvent } from "@/engine/pi-engine";
import { getWorkspacesRoot } from "@/engine/workspace";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

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

  const workspaceDir = path.join(getWorkspacesRoot(), id);
  const eventsPath = path.join(workspaceDir, ".faya", "events.jsonl");
  const resultPath = path.join(workspaceDir, ".faya", "result.json");

  let events: EngineEvent[] = [];

  try {
    const raw = await readFile(eventsPath, "utf8");
    events = raw
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
    // No events yet.
  }

  const url = new URL(request.url);
  const after = Math.max(
    0,
    Number.parseInt(url.searchParams.get("after") ?? "0", 10) || 0,
  );
  const sliced = events.slice(after);

  const terminal =
    job?.status === "done" ||
    job?.status === "error" ||
    (!job && project.status === "ready");

  let summary = "";

  if (terminal) {
    try {
      const result = JSON.parse(
        await readFile(resultPath, "utf8"),
      ) as { summary?: unknown };
      if (typeof result.summary === "string") {
        summary = result.summary;
      }
    } catch {
      // No result file.
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
        ? { id: job.id, status: job.status, error: job.error }
        : null,
      events: sliced,
      nextCursor: after + sliced.length,
      previewReady,
      summary,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
