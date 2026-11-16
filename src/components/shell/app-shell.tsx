"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import { Sidebar, SidebarContent } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dict } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#090e12] text-slate-100">
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {pathname === "/" && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 right-0 h-[480px] w-[680px] bg-[radial-gradient(ellipse_at_center,rgba(27,230,122,0.18)_0%,rgba(16,185,129,0.06)_45%,transparent_75%)]"
          />
        )}

        <Topbar onMenuOpen={() => setMobileMenuOpen(true)} />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={dict.common.navigationMenu}
        >
          <button
            type="button"
            aria-label={dict.common.closeMenu}
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm animate-in fade-in"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-white/10 shadow-2xl animate-in slide-in-from-left duration-200">
            <SidebarContent onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
