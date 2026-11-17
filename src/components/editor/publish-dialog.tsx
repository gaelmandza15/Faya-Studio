"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  X,
} from "lucide-react";
import {
  publishProjectAction,
  unpublishProjectAction,
} from "@/app/actions/publications";
import { useI18n } from "@/i18n/provider";
import { slugify } from "@/lib/publication-utils";

interface PublicationView {
  slug: string;
  url: string;
  versionNumber: number;
  publishedAt: string;
  updatedAt: string;
}

interface PublicationPayload {
  publication: PublicationView | null;
}

export function PublishDialog({
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
  const labels = dict.editor;
  const [publication, setPublication] =
    useState<PublicationView | null>(null);
  const [slug, setSlug] = useState(slugify(projectName));
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setCopied(false);
      setConfirmUnpublish(false);
      setSlug(slugify(projectName));

      try {
        const response = await fetch(
          `/api/projects/${projectId}/publication`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Publication request failed (${response.status}).`);
        }

        const data = (await response.json()) as PublicationPayload;
        if (cancelled) return;

        setPublication(data.publication);

        if (data.publication) {
          setSlug(data.publication.slug);
        }
      } catch {
        if (!cancelled) setError(labels.publishError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, projectName, labels.publishError]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  const absoluteUrl =
    publication && typeof window !== "undefined"
      ? `${window.location.origin}${publication.url}`
      : publication?.url ?? "";

  async function publish() {
    if (publishing || unpublishing || !slug.trim()) return;

    setPublishing(true);
    setError(null);

    const result = await publishProjectAction(projectId, slug);

    if ("ok" in result) {
      setPublication({
        slug: result.slug,
        url: result.url,
        versionNumber: result.versionNumber,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSlug(result.slug);
      setConfirmUnpublish(false);
    } else if (result.error === "slugTaken") {
      setError(labels.publishSlugTaken);
    } else if (result.error === "invalidSlug") {
      setError(labels.publishSlugInvalid);
    } else if (result.error === "notReady") {
      setError(labels.publishNotReady);
    } else if (result.error === "busy") {
      setError(labels.publishBusy);
    } else {
      setError(labels.publishError);
    }

    setPublishing(false);
  }

  async function unpublish() {
    if (publishing || unpublishing) return;

    setUnpublishing(true);
    setError(null);

    const result = await unpublishProjectAction(projectId);

    if ("ok" in result) {
      setPublication(null);
      setConfirmUnpublish(false);
      setSlug(slugify(projectName));
    } else {
      setError(labels.publishError);
    }

    setUnpublishing(false);
  }

  async function copyLink() {
    if (!publication) return;

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${publication.url}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(labels.publishError);
    }
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
        aria-labelledby="publish-dialog-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e151b] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
              <Globe className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="publish-dialog-title"
                className="text-[15px] font-semibold text-white"
              >
                {labels.publishTitle}
              </h2>
              <p className="mt-1 text-[11.5px] text-slate-400">
                {projectName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={labels.publishClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-slate-400">
          {labels.publishDescription}
        </p>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {labels.versionsLoading}
          </div>
        ) : (
          <>
            <div className="mt-4">
              <label
                htmlFor="publish-slug"
                className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-500"
              >
                {labels.publishSlugLabel}
              </label>
              <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#11191f] focus-within:border-[#1be67a]/40">
                <span className="pl-3 text-[11.5px] text-slate-500">
                  /p/
                </span>
                <input
                  id="publish-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  disabled={publishing || unpublishing}
                  className="h-10 w-full bg-transparent px-1 pr-3 text-[12.5px] text-slate-200 outline-none disabled:opacity-60"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">
                {labels.publishSlugHint}
              </p>
            </div>

            {publication && (
              <div className="mt-4 rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/[0.06] p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#1be67a]/15 px-2 py-0.5 text-[9.5px] font-semibold text-[#1be67a]">
                    {labels.publishLive}
                  </span>
                  <span className="text-[10.5px] text-slate-400">
                    {labels.publishVersion.replace(
                      "{number}",
                      String(publication.versionNumber),
                    )}
                  </span>
                </div>
                <p className="mt-2 break-all text-[11.5px] text-slate-300">
                  {absoluteUrl}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10.5px] font-medium text-slate-300 transition hover:bg-white/5"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-[#1be67a]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied ? labels.publishCopied : labels.publishCopy}
                  </button>
                  <a
                    href={publication.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10.5px] font-medium text-slate-300 transition hover:bg-white/5"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {labels.publishOpen}
                  </a>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void publish()}
              disabled={publishing || unpublishing || !slug.trim()}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1be67a] text-[12.5px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.2)] transition hover:bg-[#16cf6c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              {publication
                ? labels.publishUpdate
                : labels.publishAction}
            </button>

            {publication && (
              <div className="mt-3">
                {confirmUnpublish ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmUnpublish(false)}
                      disabled={unpublishing}
                      className="h-9 flex-1 rounded-lg border border-white/10 text-[10.5px] text-slate-400 transition hover:bg-white/5"
                    >
                      {labels.publishCancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => void unpublish()}
                      disabled={unpublishing}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/90 text-[10.5px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                    >
                      {unpublishing && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {labels.publishConfirmUnpublish}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmUnpublish(true)}
                    className="h-9 w-full rounded-lg border border-red-500/20 text-[10.5px] font-medium text-red-300 transition hover:bg-red-500/10"
                  >
                    {labels.publishUnpublish}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[10.5px] text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mt-4 w-full rounded-lg border border-white/10 py-2 text-[11.5px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          {labels.publishClose}
        </button>
      </div>
    </div>
  );
}
