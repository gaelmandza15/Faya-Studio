"use client";

import {
  CircleAlert,
  ExternalLink,
  Loader2,
  Lock,
  Monitor,
  Smartphone,
} from "lucide-react";
import { StockApp } from "@/components/editor/stock-app";
import { useI18n } from "@/i18n/provider";
import { getDemoData } from "@/lib/mock-data";
import type { GenerationStatus, PreviewDevice } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PreviewPanel({
  status,
  currentStep,
  progress,
  device,
  previewUrl,
  previewReady = false,
  previewVersion,
  activityLabel,
  projectName,
}: {
  status: GenerationStatus;
  currentStep: number;
  progress: number;
  device: PreviewDevice;
  previewUrl?: string;
  previewReady?: boolean;
  previewVersion?: string;
  activityLabel?: string;
  projectName?: string;
}) {
  const { locale, dict } = useI18n();
  const steps = getDemoData(locale).generation.steps;
  const activeStep = steps[Math.min(currentStep, steps.length - 1)];
  const stepLabel = activityLabel ?? activeStep.label;
  const isRealMode = Boolean(previewUrl);
  const showPreview = isRealMode && previewReady && status === "done";
  const iframeSrc =
    previewUrl && previewVersion
      ? `${previewUrl}?v=${encodeURIComponent(previewVersion)}`
      : previewUrl;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#070b0e]">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              status === "error"
                ? "bg-red-500"
                : status === "running"
                  ? "animate-pulse bg-amber-400"
                  : "bg-[#1be67a]",
            )}
          />
          <span>{dict.editor.livePreview}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-500">
            {dict.common.demo}
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            {device === "desktop" ? (
              <Monitor className="h-3 w-3" />
            ) : (
              <Smartphone className="h-3 w-3" />
            )}
            {device === "desktop" ? dict.common.desktop : dict.common.mobile}
          </span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-hidden p-3 sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(27,230,122,0.05)_0%,transparent_70%)]"
        />
        <div
          className={cn(
            "relative flex h-full w-full flex-col transition-all duration-300",
            device === "mobile" ? "max-w-[390px]" : "max-w-none",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <BrowserChrome
              urlLabel={
                isRealMode
                  ? "preview.faya-studio.app"
                  : "stockflow.faya-studio.app"
              }
            />
            <div
              className={cn(
                "min-h-0 flex-1",
                showPreview
                  ? "overflow-hidden"
                  : "scrollbar-light overflow-y-auto",
              )}
            >
              {isRealMode ? (
                status === "error" ? (
                  <PreviewError />
                ) : showPreview ? (
                  <iframe
                    src={iframeSrc}
                    title={projectName ?? "Application preview"}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                    className="h-full w-full border-0 bg-white"
                  />
                ) : status === "done" ? (
                  <NoPreview />
                ) : (
                  <PreviewSkeleton
                    stepLabel={stepLabel}
                    progress={progress}
                    compact={device === "mobile"}
                    buildingLabel={dict.editor.buildingApp}
                  />
                )
              ) : status === "done" ? (
                <StockApp compact={device === "mobile"} />
              ) : (
                <PreviewSkeleton
                  stepLabel={stepLabel}
                  progress={progress}
                  compact={device === "mobile"}
                  buildingLabel={dict.editor.buildingApp}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BrowserChrome({ urlLabel }: { urlLabel: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-slate-200 bg-[#eef1f4] px-3">
      <div className="flex shrink-0 gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#f87171]" />
        <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
        <span className="h-2 w-2 rounded-full bg-[#34d399]" />
      </div>
      <div className="mx-auto flex min-w-0 max-w-[75%] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[9.5px] text-slate-500">
        <Lock className="h-2.5 w-2.5 shrink-0 text-emerald-600" />
        <span className="truncate">{urlLabel}</span>
      </div>
      <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
    </div>
  );
}

function PreviewError() {
  const { dict } = useI18n();

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f6f7f9] p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
          <CircleAlert className="h-5 w-5" />
        </span>
        <p className="mt-3 text-[13px] font-semibold text-slate-800">
          {dict.editor.errorTitle}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
          {dict.editor.errorHint}
        </p>
      </div>
    </div>
  );
}

function NoPreview() {
  const { dict } = useI18n();

  return (
    <div className="flex min-h-full items-center justify-center bg-[#f6f7f9] p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Monitor className="h-5 w-5" />
        </span>
        <p className="mt-3 text-[13px] font-semibold text-slate-800">
          {dict.editor.noPreview}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">
          {dict.editor.previewNotReady}
        </p>
      </div>
    </div>
  );
}

function PreviewSkeleton({
  stepLabel,
  progress,
  compact,
  buildingLabel,
}: {
  stepLabel: string;
  progress: number;
  compact: boolean;
  buildingLabel: string;
}) {
  return (
    <div className="min-h-full bg-[#f6f7f9] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-2 w-20 animate-pulse rounded-full bg-slate-200" />
          <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
          <div className="h-2 w-56 max-w-full animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-emerald-200/70" />
      </div>

      <div
        className={cn(
          "mt-5 grid grid-cols-2 gap-3",
          !compact && "xl:grid-cols-4",
        )}
      >
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" />
            <div className="mt-3 h-2 w-16 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-2 h-5 w-20 animate-pulse rounded-md bg-slate-200" />
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-4 grid grid-cols-1 gap-4",
          !compact && "xl:grid-cols-3",
        )}
      >
        <div
          className={cn(
            "h-52 rounded-xl border border-slate-200 bg-white p-4",
            !compact && "xl:col-span-2",
          )}
        >
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 flex h-32 items-end gap-2">
            {[45, 65, 50, 75, 60, 85].map((height, index) => (
              <div
                key={index}
                className="flex-1 animate-pulse rounded-t bg-slate-200"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
        <div className="h-52 rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="h-6 w-6 animate-pulse rounded-md bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
                  <div className="h-2 w-2/3 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#1be67a]/20 bg-[#1be67a]/5 p-3">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-slate-700">
            {stepLabel}
          </p>
          <p className="text-[10px] text-slate-500">{buildingLabel}</p>
        </div>
        <span className="ml-auto text-[11px] font-bold text-emerald-600">
          {progress}%
        </span>
      </div>
    </div>
  );
}
