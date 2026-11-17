"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Cloud,
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Laptop,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  rotateAppKeyAction,
  setProjectSyncAction,
} from "@/app/actions/app-link";
import { useI18n } from "@/i18n/provider";
import { formatRelativeTime } from "@/i18n/format";

interface DeviceView {
  id: string;
  name: string;
  platform: string;
  lastSeenAt: string;
}

interface AppLinkCardProps {
  projectId: string;
  syncEnabled: boolean;
  appKey: string | null;
  appKeyPrefix: string | null;
  lastSyncAt: string | null;
  devices: DeviceView[];
  canManage: boolean;
}

export function AppLinkCard({
  projectId,
  syncEnabled,
  appKey,
  appKeyPrefix,
  lastSyncAt,
  devices,
  canManage,
}: AppLinkCardProps) {
  const { locale, dict } = useI18n();
  const labels = dict.applicationsPage.link;
  const [enabled, setEnabled] = useState(syncEnabled);
  const [key, setKey] = useState(appKey);
  const [prefix, setPrefix] = useState(appKeyPrefix);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function copyKey() {
    if (!key) return;
    void navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  function toggle(next: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setProjectSyncAction(projectId, next);

      if ("error" in result) {
        setError(labels.error);
        return;
      }

      setEnabled(result.syncEnabled);
      setKey(result.appKey);
      setPrefix(result.appKey.slice(0, 12));
      setRevealed(result.syncEnabled);
      setMessage(result.syncEnabled ? labels.keyGenerated : null);
    });
  }

  function rotate() {
    if (!window.confirm(labels.rotateConfirm)) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await rotateAppKeyAction(projectId);

      if ("error" in result) {
        setError(labels.error);
        return;
      }

      setKey(result.appKey);
      setPrefix(result.prefix);
      setRevealed(true);
      setMessage(labels.rotateDone);
    });
  }

  const maskedKey = prefix
    ? `${prefix}${"•".repeat(18)}`
    : key
      ? `${key.slice(0, 12)}${"•".repeat(18)}`
      : labels.appKeyNone;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-white">
            {labels.section}
          </h2>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">
            {labels.hint}
          </p>
        </div>
        <span
          className={
            enabled
              ? "shrink-0 rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 px-2 py-0.5 text-[9px] font-semibold text-[#1be67a]"
              : "shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold text-slate-400"
          }
        >
          {enabled ? dict.applicationsPage.modeSynced : dict.applicationsPage.modeLocal}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <span
          className={
            enabled
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400"
          }
        >
          {enabled ? <Cloud className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-[11.5px] font-semibold text-slate-200">
            {enabled ? labels.modeSyncedTitle : labels.modeLocalTitle}
          </p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-400">
            {enabled ? labels.modeSyncedHint : labels.modeLocalHint}
          </p>
        </div>
      </div>

      {canManage ? (
        <button
          type="button"
          onClick={() => toggle(!enabled)}
          disabled={pending}
          className={
            enabled
              ? "mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-[11px] font-medium text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
              : "mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#1be67a] text-[11px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:opacity-60"
          }
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Cloud className="h-3.5 w-3.5" />
          )}
          {enabled ? labels.disable : labels.enable}
        </button>
      ) : (
        <p className="mt-3 rounded-lg border border-white/[0.06] px-3 py-2 text-[10.5px] text-slate-500">
          {labels.viewerHint}
        </p>
      )}

      {message && (
        <p className="mt-3 rounded-lg border border-[#1be67a]/20 bg-[#1be67a]/[0.07] px-3 py-2 text-[10.5px] leading-relaxed text-[#8af3b8]">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[10.5px] text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <KeyRound className="h-3 w-3" />
            {labels.appKeyLabel}
          </p>
          {canManage && key && (
            <button
              type="button"
              onClick={rotate}
              disabled={pending}
              className="flex items-center gap-1 text-[10px] font-medium text-slate-400 transition hover:text-white disabled:opacity-60"
            >
              <RefreshCw className="h-3 w-3" />
              {labels.rotate}
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-white/[0.08] bg-[#090e12] px-2.5 py-2 font-mono text-[10px] text-slate-300">
            {canManage && revealed && key ? key : maskedKey}
          </code>
          {canManage && key && (
            <>
              <button
                type="button"
                onClick={() => setRevealed((value) => !value)}
                aria-label={revealed ? labels.hideKey : labels.showKey}
                title={revealed ? labels.hideKey : labels.showKey}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={copyKey}
                aria-label={labels.copyKey}
                title={copied ? labels.copied : labels.copyKey}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#1be67a]" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </>
          )}
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          {labels.rebuildHint}
        </p>
      </div>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {labels.devices}
          </p>
          <span className="text-[10px] text-slate-500">
            {labels.lastSync}:{" "}
            {lastSyncAt
              ? formatRelativeTime(locale, new Date(lastSyncAt))
              : labels.never}
          </span>
        </div>

        {devices.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[10.5px] text-slate-500">
            {labels.devicesEmpty}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] px-2.5 py-2"
              >
                <Laptop className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10.5px] font-medium text-slate-200">
                    {device.name}
                  </p>
                  <p className="text-[9.5px] text-slate-500">
                    {labels.deviceSeen.replace(
                      "{time}",
                      formatRelativeTime(locale, new Date(device.lastSeenAt)),
                    )}
                  </p>
                </div>
                <span className="h-1.5 w-1.5 rounded-full bg-[#1be67a]" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
