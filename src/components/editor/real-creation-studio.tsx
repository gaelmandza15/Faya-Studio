"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, MessageSquare } from "lucide-react";
import { retryGenerationAction } from "@/app/actions/projects";
import { EditorTopbar } from "@/components/editor/editor-topbar";
import { ExportDialog } from "@/components/editor/export-dialog";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { RealConversationPanel } from "@/components/editor/real-conversation-panel";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { EngineEvent } from "@/engine/pi-engine";
import { useI18n } from "@/i18n/provider";
import type {
  GenerationStatus,
  PreviewDevice,
  ProjectStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type MobileTab = "conversation" | "preview";

interface GenerationPayload {
  projectStatus: ProjectStatus;
  job: { id: string; status: string; error: string | null } | null;
  events: EngineEvent[];
  nextCursor: number;
  previewReady: boolean;
  summary: string;
}

export function RealCreationStudio({
  projectId,
  projectName,
  initialPrompt,
  initialProjectStatus,
  initialPreviewReady,
}: {
  projectId: string;
  projectName: string;
  initialPrompt: string;
  initialProjectStatus: ProjectStatus;
  initialPreviewReady: boolean;
}) {
  const { dict } = useI18n();
  const [events, setEvents] = useState<EngineEvent[]>([]);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] =
    useState<ProjectStatus>(initialProjectStatus);
  const [summary, setSummary] = useState("");
  const [jobError, setJobError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(initialPreviewReady);
  const [noJob, setNoJob] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [retrying, startRetry] = useTransition();
  const isSmallScreen = useMediaQuery("(max-width: 1023px)");
  const [deviceOverride, setDeviceOverride] =
    useState<PreviewDevice | null>(null);
  const device: PreviewDevice =
    deviceOverride ?? (isSmallScreen ? "mobile" : "desktop");
  const [mobileTab, setMobileTab] = useState<MobileTab>("conversation");
  const finalPollRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cursor = 0;
    finalPollRef.current = false;

    async function poll() {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/generation?after=${cursor}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Generation status request failed (${response.status}).`);
        }

        const data = (await response.json()) as GenerationPayload;
        if (cancelled) return;

        if (data.events.length > 0) {
          setEvents((current) => [...current, ...data.events]);
        }

        cursor = data.nextCursor;
        setJobStatus(data.job?.status ?? null);
        setJobId(data.job?.id ?? null);
        setProjectStatus(data.projectStatus);
        setJobError(data.job?.error ?? null);
        setSummary(data.summary ?? "");
        setPreviewReady(Boolean(data.previewReady));
        setPollError(null);

        const waitingWithoutJob =
          !data.job && data.projectStatus === "generating";
        setNoJob(waitingWithoutJob);

        const done = data.job?.status === "done";
        const terminal =
          data.job?.status === "error" ||
          data.projectStatus === "ready" ||
          data.projectStatus === "error" ||
          waitingWithoutJob;

        if (done && !finalPollRef.current) {
          // The worker closes its event stream just after marking the job done.
          finalPollRef.current = true;
          timer = setTimeout(poll, 900);
          return;
        }

        if (!terminal) {
          timer = setTimeout(poll, 1000);
        }
      } catch (error) {
        if (cancelled) return;
        setPollError(
          error instanceof Error
            ? error.message
            : "Unable to read generation status.",
        );
        timer = setTimeout(poll, 2000);
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, refreshKey]);

  const status: GenerationStatus =
    jobStatus === "error" || projectStatus === "error"
      ? "error"
      : jobStatus === "done" || projectStatus === "ready"
        ? "done"
        : "running";

  const writtenPaths = new Set(
    events
      .filter(
        (event) => event.type === "tool_start" && event.tool === "write_file",
      )
      .map((event) => {
        if (event.type !== "tool_start") return "";
        const args = event.args as { path?: unknown } | undefined;
        return typeof args?.path === "string" ? args.path : "";
      })
      .filter(Boolean),
  );
  const checksStarted = events.some(
    (event) => event.type === "tool_start" && event.tool === "run_checks",
  );

  const progress =
    status === "done"
      ? 100
      : status === "error"
        ? 0
        : jobStatus === "queued" || noJob
          ? 5
          : Math.min(90, 10 + writtenPaths.size * 15 + (checksStarted ? 15 : 0));

  const progressLabel =
    status === "error"
      ? dict.editor.failed
      : status === "done"
        ? dict.editor.complete
        : jobStatus === "queued" || noJob
          ? dict.editor.queued
          : dict.editor.realProgress;

  const lastToolStart = [...events]
    .reverse()
    .find((event) => event.type === "tool_start");
  const activityLabel =
    lastToolStart?.type === "tool_start"
      ? `${dict.editor.tools[lastToolStart.tool as keyof typeof dict.editor.tools] ?? lastToolStart.tool}${
          (lastToolStart.args as { path?: unknown } | undefined)?.path
            ? ` · ${(lastToolStart.args as { path?: string }).path}`
            : ""
        }`
      : dict.editor.buildingApp;

  function handleRetry() {
    if (retrying) return;

    startRetry(async () => {
      const result = await retryGenerationAction(projectId);

      if ("ok" in result) {
        setEvents([]);
        setJobStatus("queued");
        setJobId(null);
        setProjectStatus("generating");
        setSummary("");
        setJobError(null);
        setPollError(null);
        setPreviewReady(false);
        setNoJob(false);
        setRefreshKey((key) => key + 1);
      } else {
        setPollError(dict.toasts.actionFailed);
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorTopbar
        projectName={projectName}
        status={status}
        progress={progress}
        currentStep={0}
        device={device}
        onDeviceChange={setDeviceOverride}
        progressLabel={progressLabel}
        onExport={() => setExportOpen(true)}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        projectId={projectId}
        projectName={projectName}
      />

      <div className="shrink-0 border-b border-white/[0.08] bg-[#0b1116] p-2 lg:hidden">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setMobileTab("conversation")}
            aria-pressed={mobileTab === "conversation"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition",
              mobileTab === "conversation"
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {dict.editor.conversation}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            aria-pressed={mobileTab === "preview"}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition",
              mobileTab === "preview"
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            {dict.editor.preview}
            {status === "running" && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            )}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "min-h-0 w-full shrink-0 flex-col border-r border-white/10 bg-[#0b1116] lg:flex lg:w-[400px]",
            mobileTab === "conversation" ? "flex" : "hidden",
          )}
        >
          <RealConversationPanel
            projectPrompt={initialPrompt}
            events={events}
            status={status}
            summary={summary}
            error={jobError || pollError}
            noJob={noJob}
            previewReady={previewReady}
            onRetry={handleRetry}
            retrying={retrying}
          />
        </aside>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col lg:flex",
            mobileTab === "preview" ? "flex" : "hidden",
          )}
        >
          <PreviewPanel
            status={status}
            currentStep={0}
            progress={progress}
            device={device}
            previewUrl={`/api/workspaces/${projectId}/index.html`}
            previewReady={previewReady}
            previewVersion={jobId ?? projectId}
            activityLabel={activityLabel}
            projectName={projectName}
          />
        </div>
      </div>
    </div>
  );
}
