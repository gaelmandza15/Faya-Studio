"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Download,
  History,
  Loader2,
  Monitor,
  Smartphone,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/provider";
import { getDemoData } from "@/lib/mock-data";
import type { GenerationStatus, PreviewDevice } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EditorTopbar({
  projectName,
  status,
  progress,
  currentStep,
  device,
  onDeviceChange,
  progressLabel,
  onExport,
  onVersions,
  onPublish,
  canExport = true,
  canPublish = true,
}: {
  projectName: string;
  status: GenerationStatus;
  progress: number;
  currentStep: number;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  progressLabel?: string;
  onExport?: () => void;
  onVersions?: () => void;
  onPublish?: () => void;
  canExport?: boolean;
  canPublish?: boolean;
}) {
  const { locale, dict } = useI18n();
  const totalSteps = getDemoData(locale).generation.steps.length;
  const isRunning = status === "running";
  const isError = status === "error";
  const stepNumber = Math.min(currentStep + 1, totalSteps);
  const stepLabel = dict.editor.step
    .replace("{current}", String(stepNumber))
    .replace("{total}", String(totalSteps));
  const displayLabel =
    progressLabel ??
    (isRunning
      ? stepLabel
      : isError
        ? dict.editor.failed
        : dict.editor.complete);

  function handleExport() {
    if (isRunning) {
      toast(dict.editor.exportRunning, {
        description: dict.editor.exportRunningDescription,
      });
      return;
    }

    if (onExport) {
      onExport();
      return;
    }

    toast(dict.editor.exportComingSoon);
  }

  function handlePublish() {
    if (isRunning) {
      toast(dict.editor.exportRunning, {
        description: dict.editor.publishRunningDescription,
      });
      return;
    }

    if (onPublish) {
      onPublish();
      return;
    }

    toast(dict.editor.publishComingSoon);
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#0a1015]/85 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <Link
        href="/"
        aria-label={dict.editor.backAria}
        className="rounded-lg p-2 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-[14px] font-semibold text-white sm:text-[15px]">
            {projectName}
          </h1>
          {isError ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
              <CircleAlert className="h-2.5 w-2.5" />
              {dict.editor.failed}
            </span>
          ) : isRunning ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {dict.editor.generating}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1be67a]">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {dict.editor.ready}
            </span>
          )}
        </div>
        <p className="hidden text-[11px] text-slate-500 sm:block">
          {dict.editor.generatedBy}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-[11px] text-slate-400">
            {displayLabel}
          </span>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label={dict.editor.progressAria}
            className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isError ? "bg-red-500" : "bg-[#1be67a]",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span
            className={cn(
              "w-8 text-[11px] font-medium",
              isError ? "text-red-300" : "text-[#1be67a]",
            )}
          >
            {progress}%
          </span>
        </div>

        <div className="hidden items-center rounded-lg border border-white/10 bg-[#11191f] p-0.5 sm:flex">
          <button
            type="button"
            aria-label={dict.editor.desktopPreview}
            aria-pressed={device === "desktop"}
            onClick={() => onDeviceChange("desktop")}
            className={cn(
              "rounded-md p-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]",
              device === "desktop"
                ? "bg-white/10 text-white"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={dict.editor.mobilePreview}
            aria-pressed={device === "mobile"}
            onClick={() => onDeviceChange("mobile")}
            className={cn(
              "rounded-md p-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]",
              device === "mobile"
                ? "bg-white/10 text-white"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>

        {onVersions && (
          <button
            type="button"
            onClick={onVersions}
            className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-[#141d24] px-3 py-2 text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] sm:flex"
          >
            <History className="h-3.5 w-3.5" />
            {dict.editor.versions}
          </button>
        )}

        {canExport && (
          <button
            type="button"
            onClick={handleExport}
            className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-[#141d24] px-3 py-2 text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] sm:flex"
          >
            <Download className="h-3.5 w-3.5" />
            {dict.editor.export}
          </button>
        )}

        {canPublish && (
          <button
            type="button"
            onClick={handlePublish}
            className="flex items-center gap-1.5 rounded-lg bg-[#1be67a] px-3 py-2 text-[12px] font-semibold text-slate-950 shadow-[0_0_14px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
          >
            <Upload className="h-3.5 w-3.5" />
            {dict.editor.publish}
          </button>
        )}
      </div>
    </header>
  );
}
