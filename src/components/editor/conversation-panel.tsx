"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { getDemoData } from "@/lib/mock-data";
import type {
  ChatMessage,
  GenerationStatus,
  GenerationStep,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function ConversationPanel({
  messages,
  currentStep,
  completedSteps,
  progress,
  status,
  typing,
  canSend,
  onSend,
}: {
  messages: ChatMessage[];
  currentStep: number;
  completedSteps: number[];
  progress: number;
  status: GenerationStatus;
  typing: boolean;
  canSend: boolean;
  onSend: (content: string) => void;
}) {
  const { locale, dict } = useI18n();
  const steps = getDemoData(locale).generation.steps;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages.length, typing, completedSteps.length]);

  function submitMessage() {
    const value = input.trim();
    if (!value || !canSend) return;
    onSend(value);
    setInput("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
          <Sparkles className="h-4 w-4" />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1116]",
              status === "running" ? "bg-amber-400" : "bg-[#1be67a]",
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white">
            {dict.editor.agentName}
          </p>
          <p className="flex items-center gap-1.5 text-[10.5px] text-slate-400">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "running"
                  ? "animate-pulse bg-amber-400"
                  : "bg-[#1be67a]",
              )}
            />
            {status === "running"
              ? dict.editor.agentWorking
              : dict.editor.agentAvailable}
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-medium text-slate-400">
          Faya-1
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <Fragment key={message.id}>
              <MessageBubble message={message} />
              {index === 1 && (
                <StepsCard
                  steps={steps}
                  currentStep={currentStep}
                  completedSteps={completedSteps}
                  progress={progress}
                  status={status}
                />
              )}
            </Fragment>
          ))}

          {typing && <TypingBubble />}
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitMessage();
        }}
        className="shrink-0 border-t border-white/[0.08] bg-[#0b1116] p-3"
      >
        <div
          className={cn(
            "rounded-xl border bg-[#11191f] p-2 transition",
            canSend
              ? "border-white/10 focus-within:border-[#1be67a]/50"
              : "border-white/[0.06] opacity-80",
          )}
        >
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            rows={2}
            disabled={!canSend}
            aria-label={dict.editor.messageAria}
            placeholder={
              canSend
                ? dict.editor.composerPlaceholder
                : dict.editor.composerBusy
            }
            className="w-full resize-none bg-transparent px-1 py-1 text-[12.5px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-0.5">
            <span className="text-[10px] text-slate-500">
              {canSend ? dict.editor.sendHint : dict.editor.sendHintBusy}
            </span>
            <button
              type="submit"
              disabled={!canSend || input.trim().length === 0}
              aria-label={dict.editor.sendAria}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1be67a] text-slate-950 transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AgentAvatar() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]">
      <Sparkles className="h-3.5 w-3.5" />
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex items-start gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && <AgentAvatar />}
      <div
        className={cn(
          "max-w-[86%] rounded-2xl border px-3 py-2 text-[12.5px] leading-relaxed",
          isUser
            ? "rounded-tr-md border-[#1be67a]/20 bg-[#1be67a]/10 text-slate-100"
            : "rounded-tl-md border-white/[0.08] bg-[#141d25] text-slate-200",
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#19c765] text-[10px] font-bold text-white">
          JD
        </span>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-start gap-2">
      <AgentAvatar />
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
  );
}

function StepsCard({
  steps,
  currentStep,
  completedSteps,
  progress,
  status,
}: {
  steps: GenerationStep[];
  currentStep: number;
  completedSteps: number[];
  progress: number;
  status: GenerationStatus;
}) {
  const { dict } = useI18n();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0f171d] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {dict.editor.agentProgress}
        </span>
        <span className="text-[10px] font-semibold text-[#1be67a]">
          {progress}%
        </span>
      </div>

      <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#1be67a] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="space-y-1.5">
        {steps.map((step, index) => {
          const done = completedSteps.includes(index);
          const active = status === "running" && currentStep === index && !done;

          return (
            <li key={step.id} className="flex items-center gap-2 text-[11px]">
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#1be67a]" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              )}
              <span
                className={cn(
                  done
                    ? "text-slate-300"
                    : active
                      ? "font-medium text-white"
                      : "text-slate-500",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
