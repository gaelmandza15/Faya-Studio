import { readFile, stat } from "node:fs/promises";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { getProjectBackupPath } from "@/engine/backups";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; backupId: string }> },
) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId, backupId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, name: true },
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

  if (!membership || !can(membership.role, "project.update")) {
    return new Response("Forbidden", { status: 403 });
  }

  const backup = await db.projectBackup.findFirst({
    where: { id: backupId, projectId },
  });

  if (!backup) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const filePath = getProjectBackupPath(projectId, backup.fileName);
    const info = await stat(filePath);

    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const body = await readFile(filePath);
    const base = project.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${base || "application"}-${backup.id}.db"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
