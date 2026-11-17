import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { rateLimit } from "@/lib/rate-limit";
import { inspectSql } from "@/lib/sql-guard";
import { assertWorkspaceId } from "@/engine/workspace";
import {
  diffSnapshots,
  getProjectDatabase,
  snapshotTable,
} from "@/engine/project-db";
import { applyChangesInTx } from "@/engine/sync-store";
import { broadcastProjectUpdate } from "@/lib/project-events";

function normalizeParams(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null;

  for (const param of value) {
    const valid =
      param === null ||
      typeof param === "string" ||
      typeof param === "number" ||
      typeof param === "boolean";

    if (!valid) return null;
  }

  return value.map((param) =>
    typeof param === "boolean" ? (param ? 1 : 0) : param,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const clientId =
    request.headers.get("x-faya-client")?.slice(0, 64) || undefined;

  // Rate limiting: 180 requests per minute per user/session
  const limiter = rateLimit(`db:${session.userId}`, {
    windowMs: 60_000,
    max: 180,
  });

  if (!limiter.success) {
    return NextResponse.json(
      { error: "Trop de requêtes. Veuillez ralentir." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limiter.resetMs / 1000)),
        },
      },
    );
  }

  const { id: projectId } = await params;
  try {
    assertWorkspaceId(projectId);
  } catch {
    return NextResponse.json({ error: "ID de projet invalide" }, { status: 400 });
  }

  // Verify that the user belongs to the organization that owns this project
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, syncEnabled: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
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
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { cmd, query, params: sqlParams = [] } = body as {
    cmd?: string;
    query?: string;
    params?: unknown[];
  };

  if (!cmd || (cmd !== "db_select" && cmd !== "db_execute")) {
    return NextResponse.json(
      { error: "Commande non supportée. Utilisez db_select ou db_execute" },
      { status: 400 },
    );
  }

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Requête SQL manquante" }, { status: 400 });
  }

  const boundParams = normalizeParams(sqlParams);

  if (!boundParams) {
    return NextResponse.json(
      { error: "Paramètres SQL invalides" },
      { status: 400 },
    );
  }

  const inspection = inspectSql(cmd, query);

  if (!inspection.ok) {
    return NextResponse.json({ error: inspection.error }, { status: 400 });
  }

  // RBAC checks: viewer can only execute read queries
  if (inspection.kind === "write" && !can(membership.role, "project.update")) {
    return NextResponse.json(
      { error: "Votre rôle ne permet pas de modifier les données de cette application" },
      { status: 403 },
    );
  }

  try {
    const database = await getProjectDatabase(projectId);
    const statement = database.prepare(query);

    if (cmd === "db_select") {
      const rows = statement.all(...boundParams);
      return NextResponse.json({ ok: true, result: rows });
    }

    const target = inspection.target;
    const before =
      project.syncEnabled && target
        ? snapshotTable(database, target.table)
        : null;

    const info = statement.run(...boundParams);

    // Web writes must reach desktop devices through the same sync stream.
    if (project.syncEnabled && target && before) {
      try {
        const after = snapshotTable(database, target.table);

        if (after) {
          const now = new Date();
          const changes = diffSnapshots(target.table, before, after).map(
            (change) => ({
              ...change,
              updatedAt: now,
              serialized: change.deleted
                ? null
                : JSON.stringify(change.data),
            }),
          );

          if (changes.length > 0) {
            await db.$transaction((tx) =>
              applyChangesInTx(tx, projectId, changes, "web"),
            );
            broadcastProjectUpdate(projectId, {
              type: "web_write",
              table: target.table,
              clientId,
              timestamp: now.toISOString(),
            });
          }
        }
      } catch (error) {
        console.warn(
          "[web-db] Could not record sync changes:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      result: info.changes,
      lastInsertRowid: Number(info.lastInsertRowid),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
