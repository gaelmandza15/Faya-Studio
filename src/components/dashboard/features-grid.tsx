import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { FeatureGlyph } from "@/components/dashboard/glyphs";
import { getI18n } from "@/i18n/server";
import { getDemoData } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export async function FeaturesGrid() {
  const { locale } = await getI18n();
  const demo = getDemoData(locale);

  return (
    <section className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2 xl:grid-cols-4">
      {demo.features.map((feature) => (
        <Link
          key={feature.title}
          href={feature.href}
          className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#10181f] px-4 py-4 transition hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <FeatureGlyph
              icon={feature.icon}
              className={cn(
                feature.accent === "amber" ? "text-amber-400" : "text-[#1be67a]",
              )}
            />
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold leading-snug text-white">
                {feature.title}
              </h3>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-400">
                {feature.description}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
        </Link>
      ))}
    </section>
  );
}
