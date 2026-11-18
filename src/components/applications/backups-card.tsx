"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DatabaseBackup,
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  createBackupAction,
  deleteBackupAction,
  restoreBackupAction,
} from "@/app/actions/backups";
import { useI18n } from "@/i18n/provider";
import { formatDate } from "@/i18n/format";

export interface BackupView {
  id: string;
  kind: string;
  size: number;
  versionNumber: number | null;
  createdAt: string;
}

interface BackupsCardProps {
  projectId: string;
  syncEnabled: boolean;
  canManage: boolean;
  backups: BackupView[];
}

function formatSize(bytes: number): { value: number; unit: "kb" | "mb" } {
  if (bytes >= 1024 * 1024) {
    return { value: bytes / (1024 * 1024), unit: "mb" };
  }

  return { value: Math.max(1, Math.round(bytes / 1024)), unit: "kb" };
}

export function BackupsCard({
  projectId,
  syncEnabled,
  canManage,
  backups,
}: BackupsCardProps) {
  const { locale, dict } = useI18n();
  const labels = dict.applicationsPage.backups;
  const router = useRouter();
  const [items, setItems] = useState(backups);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await createBackupAction(projectId);

      if ("error" in result) {
        setError(labels.error);
        return;
      }

      setItems((current) => [result.backup, ...current].slice(0, 20));
      setMessage(labels.create);
    });
  }

  function restore(backup: BackupView) {
    if (!window.confirm(labels.restoreConfirm)) return;

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await restoreBackupAction(projectId, backup.id);

      if ("error" in result) {
        setError(
          result.error === "syncEnabled"
            ? labels.restoreBlocked
            : labels.error,
        );
        return;
      }

      setMessage(labels.restoreDone);
      router.refresh();
    });
  }

  function remove(backup: BackupView) {
    if (!window.confirm(labels.deleteConfirm)) return;

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await deleteBackupAction(projectId, backup.id);

      if ("error" in result) {
        setError(labels.error);
        return;
      }

      setItems((current) =>
        current.filter((item) => item.id !== backup.id),
      );
    });
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <DatabaseBackup className="h-4 w-4 text-[#1be67a]" />
            {labels.section}
          </h2>
          <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-slate-400">
            {labels.hint}
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={create}
            disabled={pending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1be67a] px-3 py-1.5 text-[10.5px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {pending ? labels.creating : labels.create}
          </button>
        )}
      </div>

      {message && (
        <p className="mt-3 rounded-lg border border-[#1be67a]/20 bg-[#1be67a]/[0.07] px-3 py-2 text-[10.5px] text-[#8af3b8]">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[10.5px] text-red-300">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-[10.5px] text-slate-500">
          {labels.empty}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.05]">
          {items.map((backup) => {
            const size = formatSize(backup.size);
            const sizeLabel = (
              size.unit === "mb" ? labels.sizeMb : labels.sizeKb
            ).replace("{size}", String(size.value));

            return (
              <li
                key={backup.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-200">
                      {backup.kind === "pre-restore"
                        ? labels.kindPreRestore
                        : labels.kindManual}
                    </span>
                    {backup.versionNumber && (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-slate-400">
                        {labels.version.replace(
                          "{number}",
                          String(backup.versionNumber),
                        )}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {formatDate(locale, new Date(backup.createdAt))}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {sizeLabel}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`/api/projects/${projectId}/backups/${backup.id}/download`}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] font-medium text-slate-300 transition hover:bg-white/5"
                  >
                    <Download className="h-3 w-3" />
                    {labels.download}
                  </a>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => restore(backup)}
                        disabled={pending || syncEnabled}
                        title={
                          syncEnabled ? labels.restoreBlocked : labels.restore
                        }
                        className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-[10px] font-medium text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {labels.restore}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(backup)}
                        disabled={pending}
                        aria-label={labels.delete}
                        title={labels.delete}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-500/30 hover:text-red-300 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!canManage && (
        <p className="mt-3 text-[10px] text-slate-500">{labels.viewerHint}</p>
      )}
      {canManage && syncEnabled && (
        <p className="mt-3 text-[10px] text-amber-300/80">
          {labels.restoreBlocked}
        </p>
      )}
    </section>
  );
}
