import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getWorkspacesRoot } from "../src/engine/workspace";
import {
  appCan,
  projectVisibilityWhere,
  resolveProjectAccess,
} from "../src/lib/project-access";
import { generateSessionToken, hashSessionToken } from "../src/lib/auth/tokens";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

let failures = 0;

function check(label: string, condition: boolean) {
  console.log(`${condition ? "OK  " : "FAIL"} ${label}`);
  if (!condition) failures += 1;
}

async function main() {
  const suffix = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
  const organization = await prisma.organization.create({
    data: { name: `Access Selftest ${suffix}`, slug: `access-selftest-${suffix}` },
  });

  const passwordHash = "selftest-not-a-real-hash";
  const users = await Promise.all(
    ["owner", "editor", "viewer", "outsider"].map((key) =>
      prisma.user.create({
        data: {
          email: `access-${key}-${suffix}@example.test`,
          passwordHash,
          firstName: key,
          lastName: "Selftest",
        },
      }),
    ),
  );
  const [owner, editor, viewer, outsider] = users;
  const roles = ["owner", "editor", "viewer", "viewer"] as const;

  await Promise.all(
    users.map((user, index) =>
      prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: roles[index],
        },
      }),
    ),
  );

  const project = await prisma.project.create({
    data: {
      name: `Access Project ${suffix}`,
      prompt: "Access selftest",
      status: "ready",
      organizationId: organization.id,
      createdById: owner.id,
    },
  });

  const workspaceDir = path.join(getWorkspacesRoot(), project.id);
  await mkdir(workspaceDir, { recursive: true });
  await writeFile(
    path.join(workspaceDir, "index.html"),
    "<!DOCTYPE html><html><head><title>Access test</title></head><body>Access test</body></html>",
    "utf8",
  );

  const sessions: string[] = [];

  try {
    const ownerAccess = await resolveProjectAccess(prisma, owner.id, project.id);
    const editorAccess = await resolveProjectAccess(prisma, editor.id, project.id);
    const viewerAccess = await resolveProjectAccess(prisma, viewer.id, project.id);

    check(
      "le propriétaire est administrateur de l'application",
      ownerAccess?.role === "admin" && appCan(ownerAccess.role, "manage"),
    );
    check(
      "un éditeur d'organisation est éditeur de l'application",
      editorAccess?.role === "editor" &&
        appCan(editorAccess.role, "write") &&
        !appCan(editorAccess.role, "manage"),
    );
    check(
      "un lecteur d'organisation ne peut pas écrire",
      viewerAccess?.role === "viewer" && !appCan(viewerAccess.role, "write"),
    );

    await prisma.project.update({
      where: { id: project.id },
      data: { accessMode: "restricted" },
    });

    const restrictedOwner = await resolveProjectAccess(prisma, owner.id, project.id);
    const restrictedEditor = await resolveProjectAccess(prisma, editor.id, project.id);
    const restrictedViewer = await resolveProjectAccess(prisma, viewer.id, project.id);

    check(
      "en mode restreint, l'administrateur d'organisation garde l'accès",
      restrictedOwner?.role === "admin",
    );
    check(
      "en mode restreint, un membre non listé n'a aucun accès",
      restrictedEditor?.allowed === false &&
        restrictedViewer?.allowed === false,
    );

    await prisma.projectMember.createMany({
      data: [
        { projectId: project.id, userId: editor.id, role: "viewer" },
        { projectId: project.id, userId: viewer.id, role: "editor" },
      ],
    });

    const explicitViewer = await resolveProjectAccess(prisma, editor.id, project.id);
    const explicitEditor = await resolveProjectAccess(prisma, viewer.id, project.id);

    check(
      "un rôle explicite lecteur ne peut pas écrire",
      explicitViewer?.role === "viewer" &&
        !appCan(explicitViewer.role, "write"),
    );
    check(
      "un rôle explicite éditeur peut écrire",
      explicitEditor?.role === "editor" &&
        appCan(explicitEditor.role, "write"),
    );

    const visibleToEditor = await prisma.project.findMany({
      where: projectVisibilityWhere(editor.id, organization.id, "editor"),
      select: { id: true },
    });
    const visibleToOutsider = await prisma.project.findMany({
      where: projectVisibilityWhere(outsider.id, organization.id, "viewer"),
      select: { id: true },
    });

    check(
      "la liste inclut les applications restreintes où le membre est ajouté",
      visibleToEditor.some((row) => row.id === project.id),
    );
    check(
      "la liste exclut les applications restreintes pour les autres",
      !visibleToOutsider.some((row) => row.id === project.id),
    );

    const baseUrl = arg("--base-url")?.replace(/\/+$/, "");

    if (baseUrl) {
      async function createSession(userId: string): Promise<string> {
        const token = generateSessionToken();
        sessions.push(
          (
            await prisma.session.create({
              data: {
                tokenHash: hashSessionToken(token),
                userId,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
              },
            })
          ).id,
        );
        return token;
      }

      const ownerToken = await createSession(owner.id);
      const editorToken = await createSession(editor.id);
      const outsiderToken = await createSession(outsider.id);

      const cookie = (token: string) =>
        `faya_session=${token}; faya_org=${organization.id}`;

      async function get(path: string, token: string) {
        return fetch(`${baseUrl}${path}`, {
          headers: { cookie: cookie(token) },
          redirect: "manual",
        });
      }

      async function postDb(
        token: string,
        body: Record<string, unknown>,
      ) {
        return fetch(`${baseUrl}/api/projects/${project.id}/db`, {
          method: "POST",
          headers: {
            cookie: cookie(token),
            "content-type": "application/json",
            "x-faya-sandbox": `access-verify-${suffix}`,
          },
          body: JSON.stringify(body),
        });
      }

      const editorWorkspace = await get(
        `/api/workspaces/${project.id}/index.html`,
        editorToken,
      );
      const outsiderWorkspace = await get(
        `/api/workspaces/${project.id}/index.html`,
        outsiderToken,
      );
      const outsiderApp = await get(`/app/${project.id}`, outsiderToken);
      const editorApp = await get(`/app/${project.id}`, editorToken);
      const outsiderList = await get("/applications", outsiderToken);
      const outsiderListHtml = await outsiderList.text();

      check(
        "le workspace est accessible au membre explicite",
        editorWorkspace.status === 200,
      );
      check(
        "le workspace est refusé au non-membre",
        outsiderWorkspace.status === 403,
      );
      check(
        "la page /app est refusée au non-membre",
        outsiderApp.status === 404,
      );
      check(
        "la page /app reste accessible au membre explicite",
        editorApp.status === 200,
      );
      check(
        "la liste masque l'application restreinte aux non-membres",
        outsiderList.status === 200 &&
          !outsiderListHtml.includes(project.name),
      );

      const viewerRead = await postDb(editorToken, {
        cmd: "db_select",
        query: "SELECT 1 AS ok",
        params: [],
      });
      const viewerWrite = await postDb(editorToken, {
        cmd: "db_execute",
        query: "DELETE FROM missing_table",
        params: [],
      });

      check("un lecteur explicite peut lire les données", viewerRead.status === 200);
      check(
        "un lecteur explicite ne peut pas écrire",
        viewerWrite.status === 403,
      );

      const ownerWrite = await postDb(ownerToken, {
        cmd: "db_execute",
        query: "DELETE FROM missing_table",
        params: [],
      });

      check(
        "un administrateur d'application peut écrire (le SQL est ensuite validé)",
        ownerWrite.status !== 403,
      );
    } else {
      console.log(
        "HTTP checks skipped (pass --base-url http://127.0.0.1:3000).",
      );
    }
  } finally {
    if (sessions.length > 0) {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
    }
    await prisma.organization
      .delete({ where: { id: organization.id } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: users.map((user) => user.id) } } })
      .catch(() => undefined);
    await rm(workspaceDir, { recursive: true, force: true }).catch(
      () => undefined,
    );
    await prisma.$disconnect();
  }

  console.log(
    `\n${failures === 0 ? "Access verification passed." : `${failures} failure(s).`}`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
