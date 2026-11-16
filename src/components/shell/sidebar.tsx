"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  FolderClosed,
  Gauge,
  HelpCircle,
  Home,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { formatNumber } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import type { Dictionary } from "@/i18n/types";
import { cn } from "@/lib/utils";

interface NavItem {
  key: keyof Dictionary["nav"];
  href: string;
  icon: LucideIcon;
  badge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/", icon: Home },
  { key: "projects", href: "/projets", icon: FolderClosed },
  { key: "applications", href: "/applications", icon: LayoutGrid },
  { key: "templates", href: "/modeles", icon: Box },
  { key: "credits", href: "/credits", icon: Gauge, badge: true },
  { key: "settings", href: "/parametres", icon: Settings },
  { key: "help", href: "/aide", icon: HelpCircle },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const workspace = useWorkspace();

  return (
    <div className="flex h-full min-h-0 flex-col justify-between bg-[#0b1116]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 pb-7 pt-6">
          <Logo onNavigate={onNavigate} />
        </div>

        <nav
          aria-label={dict.common.mainNavigation}
          className="space-y-1 pr-3"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            const label = dict.nav[item.key];

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3.5 rounded-r-xl py-3 pl-6 pr-4 text-[15px] transition",
                  isActive
                    ? "bg-linear-to-r from-[#1be67a]/35 via-[#1be67a]/10 to-transparent font-semibold text-white"
                    : "font-medium text-slate-300 hover:bg-white/[0.04] hover:text-white",
                )}
              >
                {isActive && (
                  <span className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-[#1be67a] shadow-[0_0_12px_#1be67a]" />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-white" : "text-slate-300",
                  )}
                  strokeWidth={isActive ? 2 : 1.8}
                />
                <span className="flex-1">{label}</span>
                {item.badge && (
                  <span className="rounded-full bg-[#1be67a] px-2.5 py-0.5 text-[12px] font-bold leading-tight text-slate-950">
                    {formatNumber(locale, workspace.organization.credits)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 space-y-3 p-4">
        <LanguageSwitcher />

        <div className="relative overflow-hidden rounded-2xl border border-[#1be67a]/30 bg-[#0c161a] p-5 text-center shadow-[0_0_25px_rgba(27,230,122,0.06)]">
          <div className="pointer-events-none absolute -top-10 left-1/2 h-20 w-28 -translate-x-1/2 bg-[#1be67a]/20 blur-2xl" />
          <div className="relative">
            <div className="mb-3 flex justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="h-8 w-8 text-[#1be67a]"
              >
                <path d="M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19ZM5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5ZM21.61 2.39C21.61 2.39 16.66 .269 11 5.93C8.81 8.12 7.5 10.53 6.65 12.64C6.37 13.39 6.56 14.21 7.11 14.77L9.24 16.89C9.79 17.45 10.61 17.63 11.36 17.35C13.5 16.53 15.88 15.19 18.07 13C23.73 7.34 21.61 2.39 21.61 2.39ZM14.54 9.46C13.76 8.68 13.76 7.41 14.54 6.63C15.32 5.85 16.59 5.85 17.37 6.63C18.14 7.41 18.15 8.68 17.37 9.46C16.59 10.24 15.32 10.24 14.54 9.46Z" />
              </svg>
            </div>
            <h2 className="text-[15.5px] font-bold leading-snug text-white">
              {dict.sidebar.proTitleLine1}
              <br />
              {dict.sidebar.proTitleLine2}
            </h2>
            <p className="mb-4 mt-1.5 text-[12.5px] leading-snug text-slate-400">
              {dict.sidebar.proSubtitleLine1}
              <br />
              {dict.sidebar.proSubtitleLine2}
            </p>
            <button
              type="button"
              onClick={() =>
                toast(dict.toasts.proOffer, {
                  description: dict.toasts.proOfferDescription,
                })
              }
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1be67a] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_15px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
            >
              <span>{dict.sidebar.discover}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/[0.07] lg:flex lg:flex-col">
      <SidebarContent />
    </aside>
  );
}
