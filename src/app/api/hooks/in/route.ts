import { NextResponse } from "next/server";
import {
  SYNC_MAX_BATCH,
  SYNC_MAX_REQUEST_BYTES,
  bearerToken,
  getProjectForAppKey,
} from "@/lib/app-link";
import { db } from "@/lib/db";
import { getProjectDataProvider } from "@/engine/project-db";
import { applyChangesInTx } from "@/engine/sync-store";
import { logger } from "@/lib/logger";
import { broadcastProjectUpdate } from "@/lib/project-events";
import { rateLimit } from "@/lib/rate-limit";
import { validateSyncChange } from "@/lib/sync-payload";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Faya-Key",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Inbound ingestion API for external tools.
 *
 * POST /api/hooks/in
 * Authorization: Bearer <app key>
 *
 * Body: a change, or { changes: [...] } with up to 500 changes.
 * A change is { table, id, data, deleted?, updatedAt? }.
 *
 * Changes are stored in the project sync stream and applied to the
 * platform-side database, so browser tabs refresh through SSE and desktop
 * devices receive them on their next pull.
 */
export async function POST(request: Request) {
  const project = await getProjectForAppKey(bearerToken(request));

  if (!project) {
    return json({ error: "unauthorized" }, 401);
  }

  const limiter = rateLimit(`inbound:${project.id}`, {
    windowMs: 60_000,
    max: 240,
  });

  if (!limiter.success) {
    return json(
      { error: "rateLimited" },
      429,
    );
  }

  const raw = await request.text();

  if (raw.length > SYNC_MAX_REQUEST_BYTES) {
    return json({ error: "payloadTooLarge" }, 413);
  }

  let body: Record<string, unknown>;

  try {
    body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
  } catch {
    return json({ error: "invalidBody" }, 400);
  }

  const incoming = Array.isArray(body.changes) ? body.changes : [body];

  if (incoming.length === 0) {
    return json({ error: "noChanges" }, 400);
  }

  if (incoming.length > SYNC_MAX_BATCH) {
    return json({ error: "batchTooLarge" }, 413);
  }

  const changes = incoming
    .map(validateSyncChange)
    .filter((change): change is NonNullable<typeof change> =>
      Boolean(change),
    );

  if (changes.length === 0) {
    return json({ error: "noValidChanges" }, 400);
  }

  const log = logger.child({
    projectId: project.id,
    source: "inbound",
  });

  try {
    const result = await db.$transaction(async (tx) =>
      applyChangesInTx(
        tx,
        project.id,
        changes.map((change) => ({
          ...change,
          updatedAt: new Date(change.updatedAt),
        })),
        "external",
      ),
    );

    if (result.accepted.length > 0) {
      const data = await getProjectDataProvider(project.id);

      for (const change of result.accepted) {
        await data.applyChange({
          table: change.table,
          id: change.id,
          data: change.data,
          deleted: change.deleted,
        });
      }

      broadcastProjectUpdate(project.id, {
        type: "external_write",
        timestamp: new Date().toISOString(),
      });

      log.info("Inbound changes applied", {
        accepted: result.accepted.length,
        conflicts: result.conflicts.length,
      });
    }

    return json({
      ok: true,
      applied: result.applied,
      conflicts: result.conflicts.map((conflict) => ({
        table: conflict.tableName,
        id: conflict.rowKey,
        data: conflict.data ? JSON.parse(conflict.data) : null,
        deleted: conflict.deleted,
        updatedAt: conflict.updatedAt.toISOString(),
      })),
      cursor: result.cursor,
    });
  } catch (error) {
    log.error("Inbound ingestion failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "serverError" }, 500);
  }
}
