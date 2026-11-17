"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  Package,
  X,
} from "lucide-react";
import { exportProjectAction } from "@/app/actions/builds";
import { useI18n } from "@/i18n/provider";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { cn } from "@/lib/utils";

interface BuildJobView {
  id: string;
  status: string;
  error: string | null;
  artifactName: string | null;
  artifactSize: number | null;
  durationMs: number | null;
  downloadUrl: string | null;
}

interface BuildPayload {
  job: BuildJobView | null;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}) {
  const { dict } = useI18n();
  const labels = dict.editor.exportDialog;
  const [job, setJob] = useState<BuildJobView | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [pollVersion, setPollVersion] = useState(0);
  const [starting, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/builds`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Build status request failed (${response.status}).`);
        }

        const data = (await response.json()) as BuildPayload;
        if (cancelled) return;

        setJob(data.job);
        setPollError(null);

        if (
          data.job?.status === "queued" ||
          data.job?.status === "running"
        ) {
          timer = setTimeout(poll, 1500);
        }
      } catch {
        if (cancelled) return;
        setPollError(labels.pollError);
        timer = setTimeout(poll, 2500);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, projectId, labels.pollError, pollVersion]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  function startBuild() {
    if (starting) return;
    setPollError(null);

    startTransition(async () => {
      const result = await exportProjectAction(projectId);

      if ("jobId" in result) {
        setJob({
          id: result.jobId,
          status: "queued",
          error: null,
          artifactName: null,
          artifactSize: null,
          durationMs: null,
          downloadUrl: null,
        });
        setPollVersion((version) => version + 1);
      } else if (result.error === "notReady") {
        setPollError(labels.notReady);
      } else if (result.error === "insufficientCredits") {
        setPollError(dict.editor.insufficientCredits);
      } else if (result.error === "busy") {
        setPollError(dict.editor.modifyBusy);
      } else {
        setPollError(dict.toasts.actionFailed);
      }
    });
  }

  const isBuilding = job?.status === "queued" || job?.status === "running";
  const isDone = job?.status === "done";
  const isError = job?.status === "error";

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
        aria-labelledby="export-dialog-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e151b] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="export-dialog-title"
                className="text-[15px] font-semibold text-white"
              >
                {labels.title}
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                {projectName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={labels.close}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
          {labels.description}
        </p>
        <p className="mt-2 text-[10.5px] text-slate-500">
          {labels.sqliteNote}
        </p>

        <div className="mt-5">
          {isBuilding ? (
            <div className="rounded-xl border border-[#1be67a]/20 bg-[#1be67a]/[0.06] p-4">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#1be67a]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {job?.status === "queued"
                  ? labels.queued
                  : labels.building}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-[#1be67a]" />
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">
                {labels.buildHint}
              </p>
            </div>
          ) : isDone ? (
            <div className="rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/[0.07] p-4">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#1be67a]">
                <CheckCircle2 className="h-4 w-4" />
                {labels.done}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                {labels.doneHint}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
                <span>{job?.artifactName}</span>
                <span>{formatSize(job?.artifactSize ?? null)}</span>
                {job?.durationMs ? (
                  <span>
                    {labels.duration.replace(
                      "{seconds}",
                      String(Math.round(job.durationMs / 1000)),
                    )}
                  </span>
                ) : null}
              </div>
              {job?.downloadUrl && (
                <a
                  href={job.downloadUrl}
                  download
                  className="mt-4 flex h-9 items-center justify-center gap-2 rounded-lg bg-[#1be67a] text-[12px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
                >
                  <Download className="h-3.5 w-3.5" />
                  {labels.download}
                </a>
              )}
              <button
                type="button"
                onClick={startBuild}
                disabled={starting}
                className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-[10.5px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                {starting ? labels.starting : labels.retry}
              </button>
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-4">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-red-300">
                <CircleAlert className="h-4 w-4" />
                {labels.errorTitle}
              </div>
              <p className="mt-2 break-words text-[11px] leading-relaxed text-red-200/80">
                {job?.error || labels.errorHint}
              </p>
              <button
                type="button"
                onClick={startBuild}
                disabled={starting}
                className="mt-4 h-9 w-full rounded-lg border border-white/15 bg-[#141d24] text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {labels.retry}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startBuild}
              disabled={starting}
              className={cn(
                "flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1be67a] text-[12.5px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.2)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]",
                starting && "cursor-not-allowed opacity-70",
              )}
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {labels.starting}
                </>
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  {labels.startCost.replace(
                    "{count}",
                    String(CREDIT_COSTS.build),
                  )}
                </>
              )}
            </button>
          )}
        </div>

        {pollError && (
          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[10.5px] text-red-300">
            {pollError}
          </p>
        )}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-5 w-full rounded-lg border border-white/10 py-2 text-[11.5px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          {labels.close}
        </button>
      </div>
    </div>
  );
}
