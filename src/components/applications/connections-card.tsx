"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  Loader2,
  Plus,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import {
  addWebhookAction,
  removeWebhookAction,
  testWebhookAction,
  toggleWebhookAction,
} from "@/app/actions/app-link";
import { useI18n } from "@/i18n/provider";
import { formatRelativeTime } from "@/i18n/format";

interface EndpointView {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  secret: string | null;
  lastStatus: number | null;
  lastDeliveryAt: string | null;
}

interface ConnectionsCardProps {
  projectId: string;
  endpoints: EndpointView[];
  canManage: boolean;
  platformUrl: string;
}

export function ConnectionsCard({
  projectId,
  endpoints,
  canManage,
  platformUrl,
}: ConnectionsCardProps) {
  const { locale, dict } = useI18n();
  const labels = dict.applicationsPage.connections;
  const linkLabels = dict.applicationsPage.link;
  const [items, setItems] = useState(endpoints);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    setMessage(null);

    if (!url.trim()) {
      setError(labels.invalidUrl);
      return;
    }

    startTransition(async () => {
      const result = await addWebhookAction(projectId, { name, url });

      if ("error" in result) {
        setError(
          result.error === "invalidUrl"
            ? labels.invalidUrl
            : result.error === "limit"
              ? labels.limit
              : labels.genericError,
        );
        return;
      }

      setItems((current) => [
        ...current,
        {
          ...result.endpoint,
          enabled: true,
          lastStatus: null,
          lastDeliveryAt: null,
        },
      ]);
      setNewSecret(result.endpoint.secret);
      setRevealed(result.endpoint.id);
      setName("");
      setUrl("");
      setMessage(labels.add);
    });
  }

  function remove(endpoint: EndpointView) {
    if (!window.confirm(labels.removeConfirm)) return;

    startTransition(async () => {
      const result = await removeWebhookAction(projectId, endpoint.id);

      if ("error" in result) {
        setError(labels.genericError);
        return;
      }

      setItems((current) => current.filter((item) => item.id !== endpoint.id));
    });
  }

  function toggle(endpoint: EndpointView) {
    startTransition(async () => {
      const result = await toggleWebhookAction(
        projectId,
        endpoint.id,
        !endpoint.enabled,
      );

      if ("error" in result) {
        setError(labels.genericError);
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === endpoint.id ? { ...item, enabled: !item.enabled } : item,
        ),
      );
    });
  }

  function test() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await testWebhookAction(projectId);

      if ("error" in result) {
        setError(
          result.error === "none" ? labels.testNone : labels.genericError,
        );
        return;
      }

      setMessage(
        result.delivered > 0
          ? labels.testDone
              .replace("{delivered}", String(result.delivered))
              .replace("{endpoints}", String(result.endpoints))
          : labels.testFailed,
      );
    });
  }

  function copySecret(endpoint: EndpointView) {
    if (!endpoint.secret) return;
    void navigator.clipboard.writeText(endpoint.secret).then(() => {
      setCopiedId(endpoint.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    });
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <Webhook className="h-4 w-4 text-[#1be67a]" />
            {labels.section}
          </h2>
          <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-slate-400">
            {labels.hint}
          </p>
        </div>
        {canManage && items.length > 0 && (
          <button
            type="button"
            onClick={test}
            disabled={pending}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10.5px] font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {labels.test}
          </button>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.06] bg-[#090e12] px-3 py-2">
        <p className="text-[9.5px] uppercase tracking-wider text-slate-500">
          {labels.endpoint}
        </p>
        <code className="mt-0.5 block truncate font-mono text-[10px] text-slate-300">
          {platformUrl}/api/hooks/events
        </code>
        <p className="mt-1 text-[9.5px] text-slate-500">{labels.emitHint}</p>
      </div>

      <div className="mt-2 rounded-lg border border-white/[0.06] bg-[#090e12] px-3 py-2">
        <p className="text-[9.5px] uppercase tracking-wider text-slate-500">
          {labels.inboundEndpoint}
        </p>
        <code className="mt-0.5 block truncate font-mono text-[10px] text-slate-300">
          POST {platformUrl}/api/hooks/in
        </code>
        <code className="mt-1 block truncate font-mono text-[9.5px] text-slate-500">
          {labels.inboundAuth}
        </code>
        <code className="mt-1 block break-all font-mono text-[9.5px] text-slate-400">
          {labels.inboundExample}
        </code>
        <p className="mt-1 text-[9.5px] text-slate-500">{labels.inboundHint}</p>
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
        <ul className="mt-3 space-y-2">
          {items.map((endpoint) => (
            <li
              key={endpoint.id}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[11px] font-semibold text-slate-200">
                      {endpoint.name}
                    </p>
                    <span
                      className={
                        endpoint.enabled
                          ? "rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 px-1.5 py-0.5 text-[8.5px] font-semibold text-[#1be67a]"
                          : "rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] font-semibold text-slate-500"
                      }
                    >
                      {endpoint.enabled ? labels.enabled : labels.disabled}
                    </span>
                    {endpoint.lastDeliveryAt && (
                      <span
                        className={
                          endpoint.lastStatus && endpoint.lastStatus >= 200 && endpoint.lastStatus < 300
                            ? "text-[9px] text-[#1be67a]"
                            : "text-[9px] text-red-300"
                        }
                      >
                        {endpoint.lastStatus && endpoint.lastStatus >= 200 && endpoint.lastStatus < 300
                          ? labels.deliveryOk
                          : labels.deliveryFailed}{" "}
                        · HTTP {endpoint.lastStatus ?? "—"} ·{" "}
                        {formatRelativeTime(locale, new Date(endpoint.lastDeliveryAt))}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 break-all font-mono text-[9.5px] text-slate-500">
                    {endpoint.url}
                  </p>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggle(endpoint)}
                      disabled={pending}
                      className="rounded-lg border border-white/10 px-2 py-1 text-[9.5px] text-slate-400 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
                    >
                      {endpoint.enabled ? labels.toggleDisable : labels.toggleEnable}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(endpoint)}
                      disabled={pending}
                      aria-label={labels.remove}
                      title={labels.remove}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-red-500/30 hover:text-red-300 disabled:opacity-60"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {canManage && endpoint.secret && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">
                    {labels.signingSecret}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-white/[0.07] bg-[#090e12] px-2 py-1.5 font-mono text-[9.5px] text-slate-400">
                      {revealed === endpoint.id
                        ? endpoint.secret
                        : `${endpoint.secret.slice(0, 10)}${"•".repeat(16)}`}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((current) =>
                          current === endpoint.id ? null : endpoint.id,
                        )
                      }
                      className="rounded-md border border-white/10 px-2 py-1.5 text-[9px] text-slate-400 transition hover:bg-white/5"
                    >
                      {revealed === endpoint.id ? linkLabels.hideKey : linkLabels.showKey}
                    </button>
                    <button
                      type="button"
                      onClick={() => copySecret(endpoint)}
                      aria-label={linkLabels.copyKey}
                      title={copiedId === endpoint.id ? linkLabels.copied : linkLabels.copyKey}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:bg-white/5"
                    >
                      {copiedId === endpoint.id ? (
                        <Check className="h-3 w-3 text-[#1be67a]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  {newSecret === endpoint.secret && (
                    <p className="mt-1 text-[9px] text-amber-300">{labels.secretOnce}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={labels.namePlaceholder}
            maxLength={60}
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#090e12] px-2.5 text-[10.5px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#1be67a]/40 sm:max-w-[180px]"
          />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={labels.urlPlaceholder}
            inputMode="url"
            className="h-9 min-w-0 flex-[2] rounded-lg border border-white/[0.08] bg-[#090e12] px-2.5 text-[10.5px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#1be67a]/40"
          />
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1be67a] px-3 text-[10.5px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {labels.add}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-[10px] text-slate-500">{labels.managerOnly}</p>
      )}

      <p className="mt-2 text-[9.5px] leading-relaxed text-slate-500">
        {labels.signatureHint}
      </p>
    </section>
  );
}
