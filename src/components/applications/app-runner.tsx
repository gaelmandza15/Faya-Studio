"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cloud,
  Database,
  ExternalLink,
  HardDrive,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { ProjectGlyph } from "@/components/dashboard/glyphs";
import { useI18n } from "@/i18n/provider";
import type { ProjectIcon } from "@/lib/types";

interface AppRunnerProps {
  project: {
    id: string;
    name: string;
    icon: ProjectIcon;
    status: string;
    syncEnabled: boolean;
  };
  src: string;
}

export function AppRunner({ project, src }: AppRunnerProps) {
  const { dict } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [updatePending, setUpdatePending] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const clientId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reloadTimer = useRef<number | null>(null);

  // Real-time synchronization via SSE
  useEffect(() => {
    let eventSource: EventSource | null = null;

    function scheduleReload() {
      if (reloadTimer.current) {
        window.clearTimeout(reloadTimer.current);
      }

      reloadTimer.current = window.setTimeout(() => {
        // Never wipe a form the user is currently filling in.
        const active = iframeRef.current?.contentDocument?.activeElement as
          | HTMLElement
          | null
          | undefined;
        const editing = Boolean(
          active &&
            (active.tagName === "INPUT" ||
              active.tagName === "TEXTAREA" ||
              active.tagName === "SELECT" ||
              active.isContentEditable),
        );

        if (editing) {
          setUpdatePending(true);
          return;
        }

        setUpdatePending(false);
        setIsLoading(true);
        setReloadKey((prev) => prev + 1);
      }, 700);
    }

    try {
      eventSource = new EventSource(`/api/projects/${project.id}/events`);
      eventSource.onopen = () => setSseConnected(true);
      eventSource.onerror = () => setSseConnected(false);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Desktop changes always refresh this tab. Web changes refresh other
          // tabs, but not the one that performed the write.
          if (data.type === "desktop_push") {
            scheduleReload();
          } else if (
            data.type === "web_write" &&
            data.clientId &&
            data.clientId !== clientId
          ) {
            scheduleReload();
          }
        } catch {
          // Ignore parse errors on keepalive pings
        }
      };
    } catch {
      // EventSource not supported or failed
    }

    return () => {
      eventSource?.close();

      if (reloadTimer.current) {
        window.clearTimeout(reloadTimer.current);
      }
    };
  }, [project.id, clientId]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  // The iframe can finish loading before React attaches onLoad (especially on
  // hydration). Poll readyState so the loading overlay never stays stuck.
  useEffect(() => {
    if (!isLoading) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const doc = iframeRef.current?.contentDocument;

      if (doc?.readyState === "complete" || Date.now() - startedAt > 10_000) {
        setIsLoading(false);
        window.clearInterval(timer);
      }
    }, 300);

    return () => window.clearInterval(timer);
  }, [isLoading, reloadKey]);

  function handleReload() {
    setUpdatePending(false);
    setIsLoading(true);
    setReloadKey((prev) => prev + 1);
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  }

  const iframeUrl = `${src}${src.includes("?") ? "&" : "?"}_r=${reloadKey}&_client=${encodeURIComponent(clientId)}`;

  return (
    <div
      ref={containerRef}
      data-sse={sseConnected ? "connected" : "connecting"}
      className="flex h-dvh w-full flex-col overflow-hidden bg-[#090e12] text-slate-100"
    >
      {/* Runner Topbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#0c1218] px-3 sm:px-4">
        {/* Left: Navigation & Project identity */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/applications/${project.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            title={dict.appRunner.backToApp}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{dict.appRunner.backToApp}</span>
          </Link>

          <div className="h-4 w-[1px] bg-white/10" aria-hidden="true" />

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#141d25]">
              <ProjectGlyph icon={project.icon} className="h-4 w-4" />
            </div>
            <h1 className="truncate text-[13.5px] font-semibold text-white">
              {project.name}
            </h1>

            <span className="hidden items-center gap-1 rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 px-2 py-0.5 text-[9.5px] font-semibold text-[#1be67a] md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1be67a]" />
              {dict.appRunner.statusReady}
            </span>

            <span className="hidden items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-0.5 text-[9.5px] font-semibold text-violet-300 lg:flex">
              <Database className="h-2.5 w-2.5" />
              {dict.appRunner.sharedDataBadge}
            </span>

            <span
              className={
                project.syncEnabled
                  ? "hidden items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[9.5px] font-semibold text-sky-300 sm:flex"
                  : "hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-semibold text-slate-400 sm:flex"
              }
            >
              {project.syncEnabled ? (
                <Cloud className="h-2.5 w-2.5" />
              ) : (
                <HardDrive className="h-2.5 w-2.5" />
              )}
              {project.syncEnabled
                ? dict.appRunner.syncedBadge
                : dict.appRunner.localBadge}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {updatePending && (
            <button
              type="button"
              onClick={handleReload}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 text-[10.5px] font-semibold text-amber-300 transition hover:bg-amber-400/20"
            >
              <RefreshCw className="h-3 w-3" />
              <span className="hidden sm:inline">
                {dict.appRunner.updateAvailable}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleReload}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
            title={dict.appRunner.reload}
            aria-label={dict.appRunner.reload}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
            title={
              isFullscreen
                ? dict.appRunner.exitFullscreen
                : dict.appRunner.fullscreen
            }
            aria-label={
              isFullscreen
                ? dict.appRunner.exitFullscreen
                : dict.appRunner.fullscreen
            }
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white sm:flex"
            title={dict.appRunner.openNewTab}
            aria-label={dict.appRunner.openNewTab}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <Link
            href={`/creer?project=${project.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1be67a] transition hover:bg-emerald-500/20"
            title={dict.appRunner.editWithAi}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{dict.appRunner.editWithAi}</span>
          </Link>
        </div>
      </header>

      {/* Main app viewport */}
      <main className="relative flex-1 bg-white">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#090e12]/30 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e151b] px-4 py-2 text-[12px] text-slate-300 shadow-xl">
              <span className="h-2 w-2 animate-ping rounded-full bg-[#1be67a]" />
              <span>{dict.appRunner.loadingApp}</span>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={reloadKey}
          src={iframeUrl}
          title={project.name}
          onLoad={() => setIsLoading(false)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          className="h-full w-full border-0 bg-white"
        />
      </main>
    </div>
  );
}
