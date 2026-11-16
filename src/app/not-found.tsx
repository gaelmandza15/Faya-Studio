import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { dict } = await getI18n();

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center overflow-y-auto px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1be67a]/25 bg-[#1be67a]/10 shadow-[0_0_40px_rgba(27,230,122,0.15)]">
          <LogoMark className="h-10 w-10" />
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1be67a]">
          {dict.notFound.code}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          {dict.notFound.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {dict.notFound.description}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#141d24] px-4 py-2.5 text-[13px] font-medium text-slate-200 transition hover:bg-[#1a242d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
          >
            <ArrowLeft className="h-4 w-4" />
            {dict.notFound.backHome}
          </Link>
          <Link
            href="/creer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
          >
            <Sparkles className="h-4 w-4" />
            {dict.common.createApp}
          </Link>
        </div>
      </div>
    </main>
  );
}
