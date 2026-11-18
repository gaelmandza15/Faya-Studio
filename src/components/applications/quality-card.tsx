"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PlayCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  rerunAcceptanceAction,
  type RerunAcceptanceResult,
} from "@/app/actions/acceptance";
import { formatRelativeTime } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";

export interface AcceptanceFlowView {
  name: string;
  ok: boolean;
  failedStep?: number;
  error?: string;
}

interface QualityCardProps {
  projectId: string;
  canManage: boolean;
  appStatus: string;
  status: string | null;
  passed: number;
  total: number;
  failed: number;
  runAt: string | null;
  error: string | null;
  mode: "platform" | "static" | null;
  flows: AcceptanceFlowView[];
  consoleErrors: string[];
}

type ViewState = {
  status: string | null;
  passed: number;
  total: number;
  failed: number;
  runAt: string | null;
  error: string | null;
  mode: "platform" | "static" | null;
  flows: AcceptanceFlowView[];
  consoleErrors: string[];
};

export function QualityCard({
  projectId,
  canManage,
  appStatus,
  status,
  passed,
  total,
  failed,
  runAt,
  error,
  mode,
  flows,
  consoleErrors,
}: QualityCardProps) {
  const { locale, dict } = useI18n();
  const labels = dict.applicationsPage.quality;
  const [view, setView] = useState<ViewState>({
    status,
    passed,
    total,
    failed,
    runAt,
    error,
    mode,
    flows,
    consoleErrors,
  });
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const isRunning = pending || appStatus === "generating";
  const disabled = !canManage || isRunning || appStatus !== "ready";

  const tone =
    view.status === "passed"
      ? "border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]"
      : view.status === "failed"
        ? "border-red-500/25 bg-red-500/10 text-red-300"
        : view.status === "skipped"
          ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
          : "border-white/10 bg-white/[0.04] text-slate-400";

  const statusLabel =
    view.status === "passed"
      ? labels.statusPassed
      : view.status === "failed"
        ? labels.statusFailed
        : view.status === "skipped"
          ? labels.statusSkipped
          : labels.statusPending;

  const StatusIcon =
    view.status === "passed"
      ? CheckCircle2
      : view.status === "failed"
        ? XCircle
        : view.status === "skipped"
          ? AlertTriangle
          : ShieldCheck;

  const skippedNoPlan = view.error?.includes("missing-acceptance-plan");

  function rerun() {
    setActionError(null);

    startTransition(async () => {
      const result: RerunAcceptanceResult = await rerunAcceptanceAction(
        projectId,
      );

      if (!("ok" in result)) {
        setActionError(
          result.error === "busy"
            ? labels.busy
            : result.error === "notReady"
              ? labels.notReady
              : result.error === "forbidden"
                ? labels.viewerHint
                : labels.error,
        );
        return;
      }

      setView({
        status: result.status,
        passed: result.passed,
        total: result.total,
        failed: result.failed,
        runAt: result.runAt,
        error: result.error,
        mode: result.mode,
        flows: result.flows,
        consoleErrors: result.consoleErrors,
      });
    });
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#1be67a]" />
            {labels.section}
            <span
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${tone}`}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {statusLabel}
            </span>
          </h2>
          <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-slate-400">
            {labels.hint}
          </p>
        </div>

        <button
          type="button"
          onClick={rerun}
          disabled={disabled}
          title={
            !canManage
              ? labels.viewerHint
              : appStatus === "generating"
                ? labels.busy
                : appStatus !== "ready"
                  ? labels.notReady
                  : undefined
          }
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10.5px] font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <PlayCircle className="h-3 w-3" />
          )}
          {isRunning ? labels.running : labels.rerun}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {typeof view.total === "number" && view.total > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-slate-200">
                {labels.flows
                  .replace("{passed}", String(view.passed))
                  .replace("{total}", String(view.total))}
              </span>
              <span className="text-slate-500">
                {view.runAt
                  ? labels.lastRun.replace(
                      "{time}",
                      formatRelativeTime(locale, new Date(view.runAt)),
                    )
                  : labels.never}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={
                  view.failed > 0
                    ? "h-full rounded-full bg-amber-400"
                    : "h-full rounded-full bg-[#1be67a]"
                }
                style={{
                  width: `${Math.round((view.passed / view.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {view.total === 0 && (
          <p className="text-[11px] text-slate-500">
            {view.status === "skipped" && skippedNoPlan
              ? labels.noPlan
              : view.runAt
                ? labels.lastRun.replace(
                    "{time}",
                    formatRelativeTime(locale, new Date(view.runAt)),
                  )
                : labels.never}
          </p>
        )}

        {view.mode === "static" && view.status !== "skipped" && (
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[10.5px] leading-relaxed text-amber-200">
            {labels.staticMode}
          </p>
        )}

        {view.failed > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {labels.failedFlows}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {view.flows
                .filter((flow) => !flow.ok)
                .slice(0, 4)
                .map((flow) => (
                  <li
                    key={flow.name}
                    className="rounded-lg border border-red-500/15 bg-red-500/[0.05] px-3 py-2"
                  >
                    <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium text-red-200">
                      {flow.name}
                      {typeof flow.failedStep === "number" && (
                        <span className="text-[9.5px] font-normal text-red-300/70">
                          {labels.step.replace(
                            "{step}",
                            String(flow.failedStep),
                          )}
                        </span>
                      )}
                    </p>
                    {flow.error && (
                      <p className="mt-0.5 line-clamp-2 break-words font-mono text-[9.5px] leading-relaxed text-red-300/70">
                        {flow.error}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {view.consoleErrors.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {labels.consoleErrors} ({view.consoleErrors.length})
            </p>
            <ul className="mt-1.5 space-y-1">
              {view.consoleErrors.slice(0, 3).map((message, index) => (
                <li
                  key={`${index}-${message.slice(0, 24)}`}
                  className="line-clamp-2 break-words font-mono text-[9.5px] leading-relaxed text-slate-400"
                >
                  {message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {view.status === "skipped" && view.error && !skippedNoPlan && (
          <p className="break-words font-mono text-[9.5px] leading-relaxed text-slate-500">
            {view.error}
          </p>
        )}

        {!canManage && (
          <p className="text-[10.5px] text-slate-500">
            {labels.viewerHint}
          </p>
        )}

        {actionError && (
          <p className="text-[10.5px] text-red-300">{actionError}</p>
        )}
      </div>
    </section>
  );
}
