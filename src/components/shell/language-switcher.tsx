"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { setLocaleAction } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(nextLocale: Locale) {
    if (nextLocale === locale || isPending) return;

    const formData = new FormData();
    formData.set("locale", nextLocale);

    startTransition(async () => {
      await setLocaleAction(formData);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={dict.language.switchTo}
      className={cn(
        "flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 transition",
        isPending && "opacity-60",
      )}
    >
      <span className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
        <Globe className="h-3.5 w-3.5" />
        {dict.language.label}
      </span>
      <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#11191f] p-0.5">
        {locales.map((item) => (
          <button
            key={item}
            type="button"
            disabled={isPending}
            onClick={() => switchTo(item)}
            aria-pressed={locale === item}
            aria-label={item === "fr" ? dict.language.fr : dict.language.en}
            className={cn(
              "rounded-md px-2 py-1 text-[10.5px] font-semibold uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] disabled:cursor-wait",
              locale === item
                ? "bg-[#1be67a] text-slate-950"
                : "text-slate-400 hover:text-white",
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
