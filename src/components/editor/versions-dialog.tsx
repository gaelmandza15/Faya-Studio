"use client";

import { useEffect, useState } from "react";
import {
  History,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { restoreProjectVersionAction } from "@/app/actions/versions";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

interface VersionView {
  id: string;
  number: number;
  kind: string;
  summary: string | null;
  fileCount: number;
  createdAt: string;
}

interface VersionsPayload {
  currentNumber: number | null;
  versions: VersionView[];
}

export function VersionsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  onRestored: () => void;
}) {
  const { locale, dict } = useI18n();
  const labels = dict.editor;
  const [versions, setVersions] = useState<VersionView[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setConfirmId(null);

      try {
        const response = await fetch(
          `/api/projects/${projectId}/versions`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Version request failed (${response.status}).`);
        }

        const data = (await response.json()) as VersionsPayload;
        if (cancelled) return;

        setVersions(data.versions);
        setCurrentNumber(data.currentNumber);
      } catch {
        if (!cancelled) setError(labels.versionsError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, labels.versionsError]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  async function restore(version: VersionView) {
    if (restoringId) return;
    setRestoringId(version.id);
    setError(null);

    const result = await restoreProjectVersionAction(
      projectId,
      version.id,
    );

    if ("ok" in result) {
      onRestored();
      return;
    }

    setRestoringId(null);
    setConfirmId(null);

    if (result.error === "busy") {
      setError(labels.versionRestoreBusy);
    } else {
      setError(labels.versionRestoreFailed);
    }
  }

  function formatDate(value: string): string {
    try {
      return new Intl.DateTimeFormat(
        locale === "fr" ? "fr-FR" : "en-US",
        { dateStyle: "medium", timeStyle: "short" },
      ).format(new Date(value));
    } catch {
      return value;
    }
  }

  function kindLabel(kind: string): string {
    return (
      labels.versionKinds[
        kind as keyof typeof labels.versionKinds
      ] ?? kind
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="versions-dialog-title"
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#0e151b] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
              <History className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="versions-dialog-title"
                className="text-[15px] font-semibold text-white"
              >
                {labels.versionsTitle}
              </h2>
              <p className="mt-1 text-[11.5px] text-slate-400">
                {projectName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={labels.versionClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-5 pt-4 text-[11.5px] leading-relaxed text-slate-400">
          {labels.versionsDescription}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {labels.versionsLoading}
            </div>
          ) : versions.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-slate-500">
              {labels.versionsEmpty}
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map((version) => {
                const isCurrent = version.number === currentNumber;
                const isConfirming = confirmId === version.id;
                const isRestoring = restoringId === version.id;

                return (
                  <li
                    key={version.id}
                    className={cn(
                      "rounded-xl border p-3",
                      isCurrent
                        ? "border-[#1be67a]/25 bg-[#1be67a]/[0.06]"
                        : "border-white/[0.07] bg-[#11191f]",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-8 shrink-0 items-center justify-center rounded-lg px-2 font-mono text-[11px] font-semibold",
                          isCurrent
                            ? "bg-[#1be67a]/15 text-[#1be67a]"
                            : "bg-white/[0.06] text-slate-300",
                        )}
                      >
                        v{version.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-semibold text-slate-200">
                            {labels.versionLabel.replace(
                              "{number}",
                              String(version.number),
                            )}
                          </span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9.5px] text-slate-400">
                            {kindLabel(version.kind)}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-[#1be67a]/15 px-2 py-0.5 text-[9.5px] font-medium text-[#1be67a]">
                              {labels.versionCurrent}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[10.5px] text-slate-500">
                          {formatDate(version.createdAt)}
                          {" · "}
                          {labels.versionFiles.replace(
                            "{count}",
                            String(version.fileCount),
                          )}
                        </p>
                        {version.summary && (
                          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                            {version.summary}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 flex justify-end gap-2">
                      {isConfirming ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            disabled={isRestoring}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-[10.5px] text-slate-400 transition hover:bg-white/5"
                          >
                            {labels.versionRestoreCancel}
                          </button>
                          <button
                            type="button"
                            onClick={() => void restore(version)}
                            disabled={isRestoring}
                            className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-2.5 py-1 text-[10.5px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                          >
                            {isRestoring && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            {labels.versionRestoreConfirm}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(version.id)}
                          disabled={Boolean(restoringId)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[10.5px] font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {labels.versionRestore}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[10.5px] text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-white/[0.08] p-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-lg border border-white/10 py-2 text-[11.5px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            {labels.versionClose}
          </button>
        </div>
      </div>
    </div>
  );
}
