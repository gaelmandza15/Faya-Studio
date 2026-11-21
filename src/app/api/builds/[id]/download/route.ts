import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";
import { getWorkspacesRoot } from "@/engine/workspace";
import { db } from "@/lib/db";
import { appCan, getProjectAccess } from "@/lib/project-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const job = await db.buildJob.findFirst({
    where: {
      id,
      project: {
        organization: {
          memberships: {
            some: { userId: session.userId },
          },
        },
      },
    },
  });

  if (!job || job.status !== "done" || !job.artifactName) {
    return new Response("Not found", { status: 404 });
  }

  const access = await getProjectAccess(session.userId, job.projectId);

  if (!access || !appCan(access.role, "write")) {
    return new Response("Forbidden", { status: 403 });
  }

  const artifactPath = path.resolve(
    getWorkspacesRoot(),
    ".artifacts",
    job.id,
    job.artifactName,
  );
  const artifactsRoot = path.resolve(
    getWorkspacesRoot(),
    ".artifacts",
  );

  if (!artifactPath.startsWith(`${artifactsRoot}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(artifactPath);

    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const body = await readFile(artifactPath);
    const asciiName = job.artifactName.replace(/[^\x20-\x7e]/g, "_");
    const encodedName = encodeURIComponent(job.artifactName);

    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.microsoft.portable-executable",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
