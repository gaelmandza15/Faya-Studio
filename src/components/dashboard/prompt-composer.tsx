"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  Factory,
  FileText,
  Loader2,
  Mic,
  Plus,
  Receipt,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { startProjectAction } from "@/app/actions/projects";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { getDemoData } from "@/lib/mock-data";
import { can } from "@/lib/roles";
import type { SuggestionIcon } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTION_ICONS: Record<SuggestionIcon, LucideIcon> = {
  stock: BarChart3,
  invoice: FileText,
  crm: Users,
  planning: CalendarDays,
  project: Briefcase,
  booking: CalendarCheck,
  production: Factory,
  expenses: Receipt,
};

export function PromptComposer() {
  const router = useRouter();
  const { locale, dict } = useI18n();
  const workspace = useWorkspace();
  const canCreate = can(
    workspace.organization.role,
    "project.create",
  );
  const demo = getDemoData(locale);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [isPending, startTransition] = useTransition();

  const showPlaceholder = value.length === 0 && !focused;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  function goToEditor(prompt?: string) {
    if (isPending || !canCreate) return;

    const text = (prompt ?? value).trim() || demo.defaultPrompt;

    startTransition(async () => {
      const result = await startProjectAction({ prompt: text });

      if ("projectId" in result) {
        router.push(`/creer?project=${result.projectId}`);
      } else if (result.error === "insufficientCredits") {
        toast(dict.toasts.insufficientCredits);
      } else {
        toast(dict.toasts.actionFailed);
      }
    });
  }

  function pickSuggestion(prompt: string) {
    setValue(prompt);
    setFocused(true);
    textareaRef.current?.focus();
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          goToEditor();
        }}
        className="rounded-2xl border border-[#1be67a]/65 bg-[#11191f]/85 p-4 pb-3.5 shadow-[0_0_28px_rgba(27,230,122,0.12)] backdrop-blur-md transition focus-within:border-[#1be67a] focus-within:shadow-[0_0_32px_rgba(27,230,122,0.2)]"
      >
        <div className="flex items-start gap-3.5">
          <div className="shrink-0 pt-1 text-[#1be67a]">
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
              <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
            </svg>
          </div>

          <div className="relative min-h-[68px] flex-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={!canCreate}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  goToEditor();
                }
              }}
              rows={2}
              aria-label={dict.dashboard.promptAria}
              className="relative z-10 max-h-40 min-h-[54px] w-full resize-none overflow-y-auto bg-transparent text-[15px] leading-relaxed text-slate-100 placeholder-transparent focus:outline-none"
            />
            {showPlaceholder && (
              <div className="pointer-events-none absolute inset-0 text-[15px] leading-relaxed text-slate-400">
                <span className="fake-cursor mr-0.5 inline-block h-4 w-[1.5px] bg-slate-200 align-middle" />
                {dict.dashboard.promptPlaceholderLine1}
                <br />
                {dict.dashboard.promptPlaceholderLine2}
              </div>
            )}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-end gap-3">
          <Tooltip>
            <TooltipTrigger
              type="button"
              aria-label={dict.dashboard.voiceInput}
              onClick={() => toast(dict.toasts.voiceComingSoon)}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
            >
              <Mic className="h-5 w-5" strokeWidth={1.8} />
            </TooltipTrigger>
            <TooltipContent>{dict.dashboard.voiceInput}</TooltipContent>
          </Tooltip>

          <span className="hidden text-[11px] text-slate-500 sm:inline">
            {dict.dashboard.creditCost.replace(
              "{count}",
              String(CREDIT_COSTS.generation),
            )}
          </span>

          <button
            type="submit"
            disabled={isPending || !canCreate}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#1be67a] px-5 py-2.5 text-[14.5px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.3)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2.2} />
            )}
            <span>{dict.dashboard.createApp}</span>
          </button>
        </div>
      </form>

      {!canCreate && (
        <p className="mt-2.5 px-1 text-[11.5px] text-slate-500">
          {dict.common.readOnlyRole}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {demo.baseSuggestions.map((suggestion) => (
          <SuggestionPill
            key={suggestion.label}
            label={suggestion.label}
            prompt={suggestion.prompt}
            icon={suggestion.icon}
            onPick={pickSuggestion}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowExtra((current) => !current)}
          aria-expanded={showExtra}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-[#131c23] px-3.5 py-1.5 text-[13px] text-slate-200 transition hover:border-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
        >
          <Plus
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              showExtra && "rotate-45",
            )}
          />
          <span>
            {showExtra
              ? dict.dashboard.fewerExamples
              : dict.dashboard.moreExamples}
          </span>
        </button>
      </div>

      {showExtra && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {demo.extraSuggestions.map((suggestion) => (
            <SuggestionPill
              key={suggestion.label}
              label={suggestion.label}
              prompt={suggestion.prompt}
              icon={suggestion.icon}
              onPick={pickSuggestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionPill({
  label,
  prompt,
  icon,
  onPick,
}: {
  label: string;
  prompt: string;
  icon: SuggestionIcon;
  onPick: (prompt: string) => void;
}) {
  const Icon = SUGGESTION_ICONS[icon];

  return (
    <button
      type="button"
      onClick={() => onPick(prompt)}
      className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-[#131c23] px-3.5 py-1.5 text-[13px] text-slate-200 transition hover:border-[#1be67a]/50 hover:bg-[#17222b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
    >
      <Icon className="h-3.5 w-3.5 text-slate-300" strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}
