import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  SYNC_MAX_BATCH,
  SYNC_MAX_REQUEST_BYTES,
  bearerToken,
  getProjectForAppKey,
} from "@/lib/app-link";
import { db } from "@/lib/db";
import { getProjectDataProvider } from "@/engine/project-db";
import { applyChangesInTx } from "@/engine/sync-store";
import { broadcastProjectUpdate } from "@/lib/project-events";
import { logger } from "@/lib/logger";
import {
  validateSyncChange,
  type ValidatedSyncChange,
} from "@/lib/sync-payload";


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Faya-Key",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : null;
}

async function readBody(request: Request): Promise<unknown> {
  const raw = await request.text();

  if (raw.length > SYNC_MAX_REQUEST_BYTES) {
    throw new Error("payloadTooLarge");
  }

  return raw ? JSON.parse(raw) : {};
}

async function touchDevice(
  tx: Prisma.TransactionClient,
  projectId: string,
  deviceId: string,
  info: { name?: unknown; platform?: unknown; appVersion?: unknown },
  cursor?: number,
) {
  const name = text(info.name, 120) ?? "Appareil";
  const platform = text(info.platform, 40) ?? "windows";
  const appVersion = text(info.appVersion, 40);

  await tx.syncDevice.upsert({
    where: { projectId_deviceId: { projectId, deviceId } },
    create: {
      projectId,
      deviceId,
      name,
      platform,
      appVersion,
      lastSeq: cursor ?? 0,
      lastSeenAt: new Date(),
    },
    update: {
      ...(info.name !== undefined ? { name } : {}),
      ...(info.platform !== undefined ? { platform } : {}),
      ...(info.appVersion !== undefined ? { appVersion } : {}),
      lastSeenAt: new Date(),
      ...(cursor !== undefined ? { lastSeq: cursor } : {}),
    },
  });
}

function toChange(record: {
  tableName: string;
  rowKey: string;
  data: string | null;
  deleted: boolean;
  seq: number;
  deviceId: string | null;
  updatedAt: Date;
}) {
  return {
    table: record.tableName,
    id: record.rowKey,
    data: record.data ? JSON.parse(record.data) : null,
    deleted: record.deleted,
    seq: record.seq,
    deviceId: record.deviceId,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  const appKey = bearerToken(request);
  const project = await getProjectForAppKey(appKey);

  if (!project) {
    return json({ error: "unauthorized" }, 401);
  }

  const log = logger.child({ projectId: project.id, action });

  let body: Record<string, unknown>;

  try {
    body = (await readBody(request)) as Record<string, unknown>;
  } catch {
    return json({ error: "invalidBody" }, 400);
  }

  const deviceId =
    typeof body.deviceId === "string" && /^[A-Za-z0-9._:-]{6,80}$/.test(body.deviceId)
      ? body.deviceId
      : null;

  if (!deviceId) {
    return json({ error: "invalidDevice" }, 400);
  }

  const deviceInfo = {
    name: body.deviceName,
    platform: body.platform,
    appVersion: body.appVersion,
  };

  try {
    if (action === "handshake") {
      await db.$transaction(async (tx) => {
        await touchDevice(tx, project.id, deviceId, deviceInfo);
        await tx.project.update({
          where: { id: project.id },
          data: { lastSyncAt: new Date() },
        });
      });

      return json({
        ok: true,
        project: { id: project.id, name: project.name },
        syncEnabled: project.syncEnabled,
        serverTime: new Date().toISOString(),
      });
    }

    if (action === "pull") {
      if (!project.syncEnabled) {
        return json({ error: "syncDisabled" }, 409);
      }

      const since =
        typeof body.since === "number" && Number.isFinite(body.since)
          ? Math.max(0, Math.trunc(body.since))
          : 0;
      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.min(1000, Math.max(1, Math.trunc(body.limit)))
          : 500;

      const records = await db.syncRecord.findMany({
        where: {
          projectId: project.id,
          seq: { gt: since },
          deleted: false,
        },
        orderBy: { seq: "asc" },
        take: limit,
      });

      const tombstones = await db.syncRecord.findMany({
        where: {
          projectId: project.id,
          seq: { gt: since },
          deleted: true,
        },
        orderBy: { seq: "asc" },
        take: limit,
      });

      const merged = [...records, ...tombstones]
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit);

      const cursor = merged.length
        ? merged[merged.length - 1].seq
        : since;

      await db.$transaction(async (tx) => {
        await touchDevice(tx, project.id, deviceId, deviceInfo, cursor);
        await tx.project.update({
          where: { id: project.id },
          data: { lastSyncAt: new Date() },
        });
      });

      return json({
        ok: true,
        changes: merged.map(toChange),
        cursor,
        hasMore: merged.length === limit,
      });
    }

    if (action === "push") {
      if (!project.syncEnabled) {
        return json({ error: "syncDisabled" }, 409);
      }

      const rawChanges = Array.isArray(body.changes) ? body.changes : [];

      if (rawChanges.length === 0) {
        return json({ ok: true, applied: [], conflicts: [], cursor: 0 });
      }

      if (rawChanges.length > SYNC_MAX_BATCH) {
        return json({ error: "batchTooLarge" }, 413);
      }

      const changes = rawChanges
        .map(validateSyncChange)
        .filter(
          (change): change is ValidatedSyncChange => Boolean(change),
        );

      if (changes.length === 0) {
        return json({ error: "noValidChanges" }, 400);
      }

      const result = await db.$transaction(async (tx) => {
        const stored = await applyChangesInTx(
          tx,
          project.id,
          changes.map((change) => ({
            table: change.table,
            id: change.id,
            updatedAt: new Date(change.updatedAt),
            serialized: change.serialized,
            deleted: change.deleted,
            data: change.data,
          })),
          deviceId,
        );

        await touchDevice(
          tx,
          project.id,
          deviceId,
          deviceInfo,
          stored.cursor,
        );

        return stored;
      });

      // Mirror accepted desktop changes into the platform-side database so
      // browser users working on /app/[id] see them too.
      if (result.accepted.length > 0) {
        try {
          const data = await getProjectDataProvider(project.id);

          for (const change of result.accepted) {
            await data.applyChange({
              table: change.table,
              id: change.id,
              data: change.data,
              deleted: change.deleted,
            });
          }

          // Broadcast real-time event to connected web tabs
          broadcastProjectUpdate(project.id, {
            type: "desktop_push",
            timestamp: new Date().toISOString(),
          });
          log.info("Desktop push mirrored to web db", {
            accepted: result.accepted.length,
          });
        } catch (error) {
          log.warn("Could not mirror pushed changes to web db", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return json({
        ok: true,
        applied: result.applied,
        conflicts: result.conflicts.map(toChange),
        cursor: result.cursor,
      });
    }

    return json({ error: "unknownAction" }, 404);
  } catch (error) {
    log.error("sync api error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "serverError" }, 500);
  }
}
