"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startProjectAction } from "@/app/actions/projects";
import { TemplateGlyph } from "@/components/dashboard/glyphs";
import { useI18n } from "@/i18n/provider";
import type { AppTemplate, ProjectIcon } from "@/lib/types";
import { cn } from "@/lib/utils";

const TEMPLATE_TONES: Record<AppTemplate["icon"], string> = {
  project: "bg-sky-500",
  invoice: "bg-orange-500",
  crm: "bg-amber-500",
  dashboard: "bg-purple-600",
};

const TEMPLATE_PROJECT_ICONS: Record<AppTemplate["icon"], ProjectIcon> = {
  project: "calendar",
  invoice: "chart",
  crm: "users",
  dashboard: "chart",
};

export function TemplateCard({
  template,
  useLabel,
}: {
  template: AppTemplate;
  useLabel: string;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const [isPending, startTransition] = useTransition();

  function handleUse() {
    if (isPending) return;

    startTransition(async () => {
      const result = await startProjectAction({
        prompt: template.prompt,
        name: template.name,
        icon: TEMPLATE_PROJECT_ICONS[template.icon],
      });

      if ("projectId" in result) {
        router.push(`/creer?project=${result.projectId}`);
      } else {
        toast(dict.toasts.actionFailed);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#141d25] p-2.5 transition hover:border-white/15">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
            TEMPLATE_TONES[template.icon],
          )}
        >
          <TemplateGlyph icon={template.icon} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-white">
            {template.name}
          </h3>
          <p className="truncate text-[12px] text-slate-400">
            {template.description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleUse}
        disabled={isPending}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-[#1a242d] px-3.5 py-1.5 text-[12px] font-medium text-slate-200 transition hover:bg-[#22303c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] disabled:cursor-wait disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        {useLabel}
      </button>
    </div>
  );
}
