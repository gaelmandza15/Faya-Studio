import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { appCan, getProjectAccess } from "@/lib/project-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const access = await getProjectAccess(session.userId, id);

  if (!access || !appCan(access.role, "view")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

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

  const job = await db.buildJob.findFirst({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(
    {
      job: job
        ? {
            id: job.id,
            status: job.status,
            error: job.error,
            artifactName: job.artifactName,
            artifactSize: job.artifactSize,
            durationMs: job.durationMs,
            createdAt: job.createdAt,
            downloadUrl:
              job.status === "done"
                ? `/api/builds/${job.id}/download`
                : null,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
