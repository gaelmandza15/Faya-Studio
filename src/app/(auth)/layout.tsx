import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth/session";

// The auth layout checks for an existing session, so it is request-bound.
export const instant = false;

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  const { dict } = await getI18n();
  const bullets = [
    dict.auth.brandBullet1,
    dict.auth.brandBullet2,
    dict.auth.brandBullet3,
  ];

  return (
    <div className="flex min-h-dvh bg-[#090e12] text-slate-100">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-[#0b1116] p-10 lg:flex xl:p-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-20 h-[420px] w-[520px] bg-[radial-gradient(ellipse_at_center,rgba(27,230,122,0.16)_0%,rgba(16,185,129,0.05)_45%,transparent_75%)]"
        />
        <div className="relative">
          <Logo />
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
            {dict.auth.brandTitle}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            {dict.auth.brandSubtitle}
          </p>
          <ul className="mt-8 space-y-3">
            {bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-center gap-3 text-[13px] text-slate-300"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]">
                  <Check className="h-3 w-3" />
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-slate-600">
          © {dict.common.appName}
        </p>
      </div>

      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 p-5 sm:p-6 lg:justify-end">
          <span className="lg:hidden">
            <LogoMark className="h-9 w-9" />
          </span>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}
