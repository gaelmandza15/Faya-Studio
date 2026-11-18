import {
  SYNC_MAX_PAYLOAD_BYTES,
  SYNC_TABLE_PATTERN,
} from "@/lib/app-link";

export interface ValidatedSyncChange {
  table: string;
  id: string;
  updatedAt: string;
  deleted: boolean;
  data: Record<string, unknown> | null;
  serialized: string | null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max
    ? value
    : null;
}

function parseData(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Validates one change submitted by a desktop device or an external tool.
 * Shared by /api/sync/push and /api/hooks/in so both entry points enforce the
 * same table, id, timestamp and payload limits.
 */
export function validateSyncChange(
  input: unknown,
): ValidatedSyncChange | null {
  if (!input || typeof input !== "object") return null;

  const source = input as Record<string, unknown>;
  const table = text(source.table, 64);
  const id =
    typeof source.id === "string"
      ? text(source.id, 200)
      : typeof source.id === "number" && Number.isFinite(source.id)
        ? String(source.id)
        : null;
  const deleted = source.deleted === true;
  const data = parseData(source.data);
  const updatedAtInput = text(source.updatedAt, 40);
  const parsed = updatedAtInput ? new Date(updatedAtInput) : new Date();

  if (!table || !SYNC_TABLE_PATTERN.test(table) || !id) return null;
  if (Number.isNaN(parsed.getTime())) return null;
  if (!deleted && !data) return null;

  const serialized = deleted ? null : JSON.stringify(data ?? {});

  if (
    serialized &&
    Buffer.byteLength(serialized, "utf8") > SYNC_MAX_PAYLOAD_BYTES
  ) {
    return null;
  }

  return {
    table,
    id,
    updatedAt: parsed.toISOString(),
    deleted,
    data,
    serialized,
  };
}
