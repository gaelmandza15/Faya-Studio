import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const APP_KEY_PREFIX = "fs_";
export const WEBHOOK_SECRET_PREFIX = "whsec_";
export const SYNC_TABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const SYNC_MAX_BATCH = 500;
export const SYNC_MAX_REQUEST_BYTES = 5 * 1024 * 1024;
export const SYNC_MAX_PAYLOAD_BYTES = 256 * 1024;

export function generateAppKey(): string {
  return `${APP_KEY_PREFIX}${randomBytes(20).toString("hex")}`;
}

export function generateWebhookSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function appKeyPrefix(key: string): string {
  return key.slice(0, 12);
}

export function isValidAppKey(value: string | null | undefined): boolean {
  return typeof value === "string" && /^fs_[a-f0-9]{40}$/.test(value);
}

/**
 * The app key is embedded in desktop exports, so it has to be recoverable at
 * build time. It is scoped to a single application and can be rotated at any
 * time, which revokes every previously exported device.
 */
export function ensureAppKey(project: {
  id: string;
  appKey: string | null;
}): Promise<{ appKey: string; created: boolean }> {
  if (project.appKey) {
    return Promise.resolve({ appKey: project.appKey, created: false });
  }

  const appKey = generateAppKey();

  return db.project
    .update({
      where: { id: project.id },
      data: {
        appKey,
        appKeyPrefix: appKeyPrefix(appKey),
        appKeyCreatedAt: new Date(),
      },
      select: { appKey: true },
    })
    .then((updated) => ({ appKey: updated.appKey ?? appKey, created: true }));
}

export function rotateAppKey(projectId: string) {
  const appKey = generateAppKey();

  return db.project
    .update({
      where: { id: projectId },
      data: {
        appKey,
        appKeyPrefix: appKeyPrefix(appKey),
        appKeyCreatedAt: new Date(),
      },
      select: { appKey: true, appKeyPrefix: true },
    })
    .then((updated) => ({
      appKey: updated.appKey ?? appKey,
      prefix: updated.appKeyPrefix ?? appKeyPrefix(appKey),
    }));
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }

  return request.headers.get("x-faya-key")?.trim() ?? null;
}

export function getProjectForAppKey(appKey: string | null) {
  if (!isValidAppKey(appKey)) {
    return Promise.resolve(null);
  }

  return db.project.findUnique({
    where: { appKey: appKey as string },
    select: {
      id: true,
      name: true,
      target: true,
      status: true,
      syncEnabled: true,
      organizationId: true,
    },
  });
}

export function hashPayload(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function syncRecordWhere(projectId: string, table: string, rowKey: string) {
  return {
    projectId_tableName_rowKey: {
      projectId,
      tableName: table,
      rowKey,
    },
  };
}
