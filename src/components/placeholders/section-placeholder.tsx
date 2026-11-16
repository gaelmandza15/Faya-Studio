import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { SECTION_ICONS, type SectionKey } from "@/lib/sections";

export async function SectionPlaceholder({
  sectionKey,
}: {
  sectionKey: SectionKey;
}) {
  const { dict } = await getI18n();
  const section = dict.sections[sectionKey];
  const Icon = SECTION_ICONS[sectionKey];
  const stats = "stats" in section ? section.stats : undefined;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e151b]/90 p-6 sm:p-10 lg:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 h-72 w-[420px] bg-[radial-gradient(ellipse_at_center,rgba(27,230,122,0.16)_0%,rgba(16,185,129,0.05)_45%,transparent_75%)]"
          />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a] shadow-[0_0_24px_rgba(27,230,122,0.12)]">
                <Icon className="h-6 w-6" />
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1be67a]" />
                {section.eyebrow} · {dict.sections.inPreparation}
              </span>
            </div>

            <h1 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {section.title}
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-slate-400 sm:text-[15px]">
              {section.description}
            </p>

            {stats && (
              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/[0.07] bg-[#141d25]/80 px-4 py-3"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-xl font-bold text-white">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
              {section.bullets.map((bullet) => (
                <div
                  key={bullet.title}
                  className="rounded-2xl border border-white/[0.07] bg-[#141d25]/80 p-4"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <h2 className="mt-3 text-[13px] font-semibold text-white">
                    {bullet.title}
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                    {bullet.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/creer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
              >
                {dict.common.createApp}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#141d24] px-4 py-2.5 text-[13px] font-medium text-slate-200 transition hover:bg-[#1a242d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
              >
                <ArrowLeft className="h-4 w-4" />
                {dict.common.backToDashboard}
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-600">
          {dict.sections.prototypeNote}
        </p>
      </div>
    </main>
  );
}
