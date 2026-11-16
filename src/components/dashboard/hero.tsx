import { getI18n } from "@/i18n/server";
import { PromptComposer } from "@/components/dashboard/prompt-composer";
import { WandDecoration } from "@/components/dashboard/wand-decoration";

export async function DashboardHero() {
  const { dict } = await getI18n();

  return (
    <section className="relative">
      <WandDecoration />

      <div className="relative z-10 max-w-3xl">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-white sm:text-[32px] lg:text-[36px]">
          {dict.dashboard.greetingPrefix}{" "}
          <span className="whitespace-nowrap text-[#1be67a]">
            {dict.dashboard.appNameExclamation}
          </span>
        </h1>
        <p className="mt-1.5 text-[15px] text-slate-300 sm:text-[16px]">
          {dict.dashboard.subtitle}
        </p>
      </div>

      <div className="relative z-10 mt-5 max-w-[820px]">
        <PromptComposer />
      </div>
    </section>
  );
}
