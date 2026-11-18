import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assertWorkspaceId } from "@/engine/workspace";
import { subscribeProject } from "@/lib/project-events";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;
  try {
    assertWorkspaceId(projectId);
  } catch {
    return new Response("Invalid project id", { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });

  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId: project.organizationId,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    return new Response("Forbidden", { status: 403 });
  }

  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribe = subscribeProject(projectId, controller);

      // Send initial connection packet
      const initMessage = `data: ${JSON.stringify({ type: "connected", projectId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initMessage));

      // Keepalive ping every 25 seconds
      const interval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(interval);
          unsubscribe();
        }
      }, 25_000);

      cleanup = () => {
        clearInterval(interval);
        unsubscribe();
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
