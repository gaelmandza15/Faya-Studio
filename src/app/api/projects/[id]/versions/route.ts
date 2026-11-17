import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
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

  const versions = await db.projectVersion.findMany({
    where: { projectId: id },
    orderBy: { number: "desc" },
  });

  return Response.json(
    {
      currentNumber: versions[0]?.number ?? null,
      versions: versions.map((version) => ({
        id: version.id,
        number: version.number,
        kind: version.kind,
        summary: version.summary,
        fileCount: version.fileCount,
        createdAt: version.createdAt,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
