"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  FolderClosed,
  Loader2,
  PencilLine,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { EngineEvent } from "@/engine/pi-engine";
import { useI18n } from "@/i18n/provider";
import type {
  GenerationStatus,
  ProjectMessageView,
} from "@/lib/types";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { cn } from "@/lib/utils";

type TranscriptItem =
  | { kind: "text"; text: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      path?: string;
      done: boolean;
      isError?: boolean;
      summary?: string;
    };

const TOOL_ICONS: Record<string, LucideIcon> = {
  list_files: FolderClosed,
  read_file: FileText,
  write_file: PencilLine,
  run_checks: ShieldCheck,
  finish: CheckCircle2,
};

export function RealConversationPanel({
  projectPrompt,
  messages,
  events,
  status,
  summary,
  error,
  noJob,
  previewReady,
  currentJobId,
  onRetry,
  onSend,
  retrying,
  sending,
}: {
  projectPrompt: string;
  messages: ProjectMessageView[];
  events: EngineEvent[];
  status: GenerationStatus;
  summary: string;
  error: string | null;
  noJob: boolean;
  previewReady: boolean;
  currentJobId: string | null;
  onRetry: () => void;
  onSend: (message: string) => Promise<boolean>;
  retrying: boolean;
  sending: boolean;
}) {
  const { dict } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const transcript = useMemo<TranscriptItem[]>(() => {
    const items: TranscriptItem[] = [];
    const tools = new Map<string, Extract<TranscriptItem, { kind: "tool" }>>();

    for (const event of events) {
      if (event.type === "text") {
        if (!event.text) continue;
        const last = items[items.length - 1];
        if (last?.kind === "text") {
          last.text += event.text;
        } else {
          items.push({ kind: "text", text: event.text });
        }
        continue;
      }

      if (event.type === "tool_start") {
        const args = event.args as
          | { path?: unknown; summary?: unknown }
          | undefined;
        const item: TranscriptItem = {
          kind: "tool",
          id: event.id,
          name: event.tool,
          path: typeof args?.path === "string" ? args.path : undefined,
          done: false,
        };
        items.push(item);
        tools.set(event.id, item);
        continue;
      }

      if (event.type === "tool_end") {
        const item = tools.get(event.id);
        if (item) {
          item.done = true;
          item.isError = event.isError;
          item.summary = event.summary;
        }
      }
    }

    return items;
  }, [events]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages.length, events.length, status, noJob]);

  const currentAgentMessage = currentJobId
    ? messages.find(
        (message) =>
          message.role === "agent" && message.jobId === currentJobId,
      )
    : undefined;
  const showLive = status === "running" || !currentAgentMessage;
  const canCompose = previewReady && status === "done";
  const agentStatus =
    status === "error"
      ? dict.editor.failed
      : status === "running"
        ? dict.editor.agentWorking
        : dict.editor.agentAvailable;
  const canRetry =
    status === "error" ||
    noJob ||
    (status === "done" && !previewReady);

  async function submit() {
    const value = draft.trim();
    if (!value || !canCompose || sending) return;
    const started = await onSend(value);
    if (started) setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
          <Sparkles className="h-4 w-4" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1116]",
              status === "error"
                ? "bg-red-500"
                : status === "running"
                  ? "bg-amber-400"
                  : "bg-[#1be67a]",
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white">
            {dict.editor.agentName}
          </p>
          <p className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
            {status === "running" && (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            )}
            {agentStatus}
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-medium text-slate-400">
          Faya-1
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <UserBubble text={projectPrompt} />
          )}

          {messages.map((message) =>
            message.role === "agent" ? (
              <AgentBubble key={message.id} text={message.content} />
            ) : (
              <UserBubble key={message.id} text={message.content} />
            ),
          )}

          {showLive &&
            transcript.map((item, index) =>
              item.kind === "text" ? (
                <AgentBubble key={`text-${index}`} text={item.text} />
              ) : (
                <ToolItem key={item.id} item={item} />
              ),
            )}

          {status === "running" && transcript.length === 0 && !noJob && (
            <div className="flex items-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-white/[0.08] bg-[#141d25] px-3 py-3">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: `${index * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {noJob && (
            <StatusCard
              tone="neutral"
              title={dict.editor.queued}
              description={dict.editor.previewNotReady}
            />
          )}

          {status === "error" && (
            <StatusCard
              tone="error"
              title={dict.editor.errorTitle}
              description={error || dict.editor.errorHint}
            />
          )}

          {error && status !== "error" && (
            <StatusCard
              tone="error"
              title={dict.editor.requestError}
              description={error}
            />
          )}

          {status === "done" &&
            summary &&
            !currentAgentMessage && (
              <div className="rounded-xl border border-[#1be67a]/20 bg-[#1be67a]/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1be67a]">
                  {dict.editor.generatedSummary}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-300">
                  {summary}
                </p>
              </div>
            )}

          {canRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/10 px-3 py-2.5 text-[12px] font-semibold text-[#1be67a] transition hover:bg-[#1be67a]/15 disabled:cursor-wait disabled:opacity-60"
            >
              {retrying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : noJob || (status === "done" && !previewReady) ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {noJob || (status === "done" && !previewReady)
                ? dict.editor.generateNow
                : dict.editor.retry}
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.08] bg-[#0b1116] p-3">
        {canCompose ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <div className="rounded-xl border border-white/[0.08] bg-[#11191f] focus-within:border-[#1be67a]/40">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submit();
                  }
                }}
                rows={2}
                disabled={sending}
                placeholder={dict.editor.composerPlaceholder}
                aria-label={dict.editor.messageAria}
                className="w-full resize-none bg-transparent px-3 pt-2.5 text-[12px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-500 disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-2 px-2 pb-2">
                <span className="px-1 text-[9.5px] text-slate-500">
                  {dict.editor.sendHint}
                </span>
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label={dict.editor.sendAria}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1be67a] text-slate-950 transition hover:bg-[#16cf6c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <p className="mt-1.5 px-1 text-[9.5px] text-slate-500">
              {dict.editor.composerHint}
              {" · "}
              {dict.editor.composerCost.replace(
                "{count}",
                String(CREDIT_COSTS.modification),
              )}
            </p>
          </form>
        ) : (
          <div className="rounded-xl border border-white/[0.06] bg-[#11191f] px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
            {status === "running"
              ? dict.editor.composerBusy
              : dict.editor.previewNotReady}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-tr-md border border-[#1be67a]/20 bg-[#1be67a]/10 px-3 py-2 text-[12.5px] leading-relaxed text-slate-100">
        {text}
      </div>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#19c765] text-[10px] font-bold text-white">
        JD
      </span>
    </div>
  );
}

function AgentBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-white/[0.08] bg-[#141d25] px-3 py-2 text-[12.5px] leading-relaxed text-slate-200">
        {text}
      </div>
    </div>
  );
}

function ToolItem({
  item,
}: {
  item: Extract<TranscriptItem, { kind: "tool" }>;
}) {
  const { dict } = useI18n();
  const Icon = TOOL_ICONS[item.name] ?? FileText;
  const label =
    dict.editor.tools[item.name as keyof typeof dict.editor.tools] ??
    item.name;
  const path = item.path ? ` · ${item.path}` : "";

  return (
    <div
      className={cn(
        "ml-9 rounded-xl border px-3 py-2",
        item.isError
          ? "border-red-500/20 bg-red-500/5"
          : "border-white/[0.07] bg-[#11191f]",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            item.isError ? "text-red-400" : "text-slate-400",
          )}
        />
        <span
          className={cn(
            "truncate text-[11.5px]",
            item.isError ? "text-red-300" : "text-slate-300",
          )}
        >
          {label}
          {path}
        </span>
        <span className="ml-auto shrink-0">
          {!item.done ? (
            <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
          ) : item.isError ? (
            <CircleAlert className="h-3.5 w-3.5 text-red-400" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1be67a]" />
          )}
        </span>
      </div>

      {item.isError && item.summary && (
        <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 px-2 py-1.5 text-[10px] leading-relaxed text-red-200">
          {item.summary.slice(0, 800)}
        </pre>
      )}
    </div>
  );
}

function StatusCard({
  tone,
  title,
  description,
}: {
  tone: "neutral" | "error";
  title: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "ml-9 rounded-xl border p-3",
        tone === "error"
          ? "border-red-500/20 bg-red-500/5"
          : "border-white/[0.07] bg-[#11191f]",
      )}
    >
      <div className="flex items-start gap-2">
        {tone === "error" ? (
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        ) : (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-400" />
        )}
        <div>
          <p
            className={cn(
              "text-[12px] font-medium",
              tone === "error" ? "text-red-200" : "text-slate-200",
            )}
          >
            {title}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
