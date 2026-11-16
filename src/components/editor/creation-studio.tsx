"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, MessageSquare } from "lucide-react";
import { markProjectReadyAction } from "@/app/actions/projects";
import { ConversationPanel } from "@/components/editor/conversation-panel";
import { EditorTopbar } from "@/components/editor/editor-topbar";
import { PreviewPanel } from "@/components/editor/preview-panel";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useI18n } from "@/i18n/provider";
import { getDemoData } from "@/lib/mock-data";
import type {
  ChatMessage,
  GenerationStatus,
  PreviewDevice,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type MobileTab = "conversation" | "preview";

export function CreationStudio({
  initialPrompt,
  projectName,
  projectId,
  initiallyReady = false,
}: {
  initialPrompt: string;
  projectName: string;
  projectId?: string;
  initiallyReady?: boolean;
}) {
  const { locale, dict } = useI18n();
  const { intro, steps, replies, defaultReply } = getDemoData(locale).generation;

  const initialMessages = useMemo<ChatMessage[]>(() => {
    const messages: ChatMessage[] = [
      { id: "initial-prompt", role: "user", content: initialPrompt },
      { id: "agent-intro", role: "agent", content: intro },
    ];

    if (initiallyReady) {
      const lastStep = steps[steps.length - 1];
      if (lastStep) {
        messages.push({
          id: "agent-ready",
          role: "agent",
          content: lastStep.message,
        });
      }
    }

    return messages;
  }, [initialPrompt, intro, initiallyReady, steps]);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<GenerationStatus>(
    initiallyReady ? "done" : "running",
  );
  const [currentStep, setCurrentStep] = useState(
    initiallyReady ? steps.length : 0,
  );
  const [completedSteps, setCompletedSteps] = useState<number[]>(
    initiallyReady ? steps.map((_, index) => index) : [],
  );
  const [progress, setProgress] = useState(initiallyReady ? 100 : 0);
  const [typing, setTyping] = useState(!initiallyReady);
  const isSmallScreen = useMediaQuery("(max-width: 1023px)");
  const [deviceOverride, setDeviceOverride] =
    useState<PreviewDevice | null>(null);
  const device: PreviewDevice =
    deviceOverride ?? (isSmallScreen ? "mobile" : "desktop");
  const [mobileTab, setMobileTab] = useState<MobileTab>("conversation");
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initiallyReady) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        timers.push(timer);
      });

    async function run() {
      setMessages(initialMessages);
      setStatus("running");
      setCurrentStep(0);
      setCompletedSteps([]);
      setProgress(0);
      setTyping(true);

      await wait(900);

      for (let index = 0; index < steps.length; index += 1) {
        if (cancelled) return;

        const step = steps[index];
        setCurrentStep(index);
        setTyping(true);

        await wait(step.duration);
        if (cancelled) return;

        setTyping(false);
        setCompletedSteps((current) => [...current, index]);
        setMessages((current) => [
          ...current,
          { id: `step-${step.id}`, role: "agent", content: step.message },
        ]);
        setProgress(Math.round(((index + 1) / steps.length) * 100));
      }

      if (cancelled) return;
      setCurrentStep(steps.length);
      setStatus("done");

      if (projectId) {
        void markProjectReadyAction(projectId);
      }
    }

    void run();

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [initialMessages, steps, initiallyReady, projectId]);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  function handleSend(content: string) {
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content },
    ]);
    setTyping(true);

    const lower = content.toLowerCase();
    const match = replies.find((entry) =>
      entry.keywords.some((keyword) => lower.includes(keyword)),
    );
    const reply = match?.reply ?? defaultReply;

    replyTimer.current = setTimeout(() => {
      setTyping(false);
      setMessages((current) => [
        ...current,
        { id: `agent-${Date.now()}`, role: "agent", content: reply },
      ]);
    }, 1100);
  }

  const canSend = status === "done" && !typing;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorTopbar
        projectName={projectName}
        status={status}
        progress={progress}
        currentStep={currentStep}
        device={device}
        onDeviceChange={setDeviceOverride}
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
          <ConversationPanel
            messages={messages}
            currentStep={currentStep}
            completedSteps={completedSteps}
            progress={progress}
            status={status}
            typing={typing}
            canSend={canSend}
            onSend={handleSend}
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
            currentStep={currentStep}
            progress={progress}
            device={device}
          />
        </div>
      </div>
    </div>
  );
}
