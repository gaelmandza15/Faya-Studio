import type { Prisma } from "@prisma/client";

export interface StoreChange {
  table: string;
  id: string;
  updatedAt: Date;
  serialized: string | null;
  deleted: boolean;
  data: Record<string, unknown> | null;
}

export interface SyncRecordRow {
  tableName: string;
  rowKey: string;
  data: string | null;
  deleted: boolean;
  seq: number;
  deviceId: string | null;
  updatedAt: Date;
}

export interface ApplyChangesResult {
  applied: Array<{ table: string; id: string; seq: number }>;
  accepted: StoreChange[];
  conflicts: SyncRecordRow[];
  cursor: number;
}

/**
 * Stores accepted changes and allocates sequence numbers for a project.
 * Last-write-wins is resolved against the existing SyncRecord timestamp.
 *
 * Must run inside a Prisma transaction together with device bookkeeping.
 */
export async function applyChangesInTx(
  tx: Prisma.TransactionClient,
  projectId: string,
  changes: StoreChange[],
  deviceId: string | null,
): Promise<ApplyChangesResult> {
  if (changes.length === 0) {
    return { applied: [], accepted: [], conflicts: [], cursor: 0 };
  }

  const updated = await tx.project.update({
    where: { id: projectId },
    data: {
      syncSeq: { increment: changes.length },
      lastSyncAt: new Date(),
    },
    select: { syncSeq: true },
  });

  let nextSeq = updated.syncSeq - changes.length + 1;
  const applied: ApplyChangesResult["applied"] = [];
  const accepted: StoreChange[] = [];
  const conflicts: SyncRecordRow[] = [];

  for (const change of changes) {
    const where = {
      projectId_tableName_rowKey: {
        projectId,
        tableName: change.table,
        rowKey: change.id,
      },
    };
    const existing = await tx.syncRecord.findUnique({ where });
    const incomingAt = change.updatedAt;

    if (existing) {
      const existingAt = new Date(existing.updatedAt);
      const stale =
        existingAt.getTime() > incomingAt.getTime() ||
        (existingAt.getTime() === incomingAt.getTime() &&
          existing.data !== change.serialized);

      if (stale) {
        conflicts.push(existing);
        continue;
      }
    }

    const seq = nextSeq++;

    await tx.syncRecord.upsert({
      where,
      create: {
        projectId,
        tableName: change.table,
        rowKey: change.id,
        data: change.serialized,
        deleted: change.deleted,
        seq,
        deviceId,
        updatedAt: incomingAt,
      },
      update: {
        data: change.serialized,
        deleted: change.deleted,
        seq,
        deviceId,
        updatedAt: incomingAt,
      },
    });

    applied.push({ table: change.table, id: change.id, seq });
    accepted.push(change);
  }

  return {
    applied,
    accepted,
    conflicts,
    cursor: applied.length
      ? applied[applied.length - 1].seq
      : updated.syncSeq - changes.length,
  };
}
