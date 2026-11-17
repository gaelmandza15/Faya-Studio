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

  const publication = await db.publication.findUnique({
    where: { projectId: id },
  });

  return Response.json(
    {
      publication: publication
        ? {
            slug: publication.slug,
            url: `/p/${publication.slug}`,
            versionNumber: publication.versionNumber,
            publishedAt: publication.createdAt,
            updatedAt: publication.updatedAt,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
