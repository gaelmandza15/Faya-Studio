"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={cn("h-9 w-9", className)}
    >
      <path
        d="M9 9.5C9 7.567 10.567 6 12.5 6H31.5L26.5 13H16V18.5H27L22.5 25H16V33.5L9 36V9.5Z"
        fill="#1be67a"
      />
      <path d="M16 18.5H27L22.5 25H16V18.5Z" fill="#0d9f54" />
    </svg>
  );
}

export function Logo({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { dict } = useI18n();

  return (
    <Link
      href="/"
      onClick={onNavigate}
      className={cn("flex items-center gap-3", className)}
      aria-label={`${dict.common.appName} — ${dict.nav.home}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <LogoMark className="h-9 w-9 drop-shadow-[0_0_10px_rgba(27,230,122,0.35)]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[19px] font-bold leading-tight tracking-tight text-white">
          {dict.common.appName}
        </span>
        <span className="block text-[10.5px] font-medium tracking-wide text-slate-400">
          {dict.common.tagline}
        </span>
      </span>
    </Link>
  );
}
