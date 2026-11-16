"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  CircleCheck,
  Coins,
  LogOut,
  Menu,
  Plus,
  Settings,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { selectOrganizationAction } from "@/app/actions/organization";
import { useWorkspace } from "@/components/shell/workspace-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { getDemoData } from "@/lib/mock-data";

export function Topbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const router = useRouter();
  const { locale, dict } = useI18n();
  const workspace = useWorkspace();
  const notifications = getDemoData(locale).notifications;
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((item) => item.unread).length;
  const creditsLabel = formatNumber(locale, workspace.organization.credits);

  function handleSelectOrganization(organizationId: string, name: string) {
    if (
      organizationId === workspace.organization.id ||
      isPending
    ) {
      return;
    }

    startTransition(async () => {
      const result = await selectOrganizationAction(organizationId);
      if ("ok" in result) {
        toast(dict.toasts.organizationSelected.replace("{name}", name));
        router.refresh();
      }
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <header className="relative z-20 flex h-[72px] shrink-0 items-center gap-3 border-b border-white/[0.08] px-4 sm:px-7">
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label={dict.common.openMenu}
          className="rounded-lg p-2 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-white sm:hidden">
          {dict.common.appName}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2.5 sm:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="hidden items-center gap-2.5 rounded-full border border-white/10 bg-[#131b22] px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] md:flex">
            <Building2 className="h-4 w-4 text-slate-300" strokeWidth={1.8} />
            <span className="font-medium">{workspace.organization.name}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 border border-white/10 bg-[#0e151b] p-2 text-slate-200 shadow-2xl"
          >
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {dict.topbar.organizations}
            </div>
            {workspace.organizations.map((org) => {
              const isActive = org.id === workspace.organization.id;
              const planLabel =
                dict.topbar.plans[org.plan as "pro" | "starter"] ??
                org.plan;

              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSelectOrganization(org.id, org.name)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                    <Building2 className="h-4 w-4 text-slate-300" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {org.name}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {planLabel}
                    </span>
                  </span>
                  {isActive && <Check className="h-4 w-4 text-[#1be67a]" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => toast(dict.toasts.organizationComingSoon)}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-slate-300"
            >
              <Plus className="h-4 w-4" />
              {dict.topbar.createOrganization}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden h-5 w-px bg-white/10 md:block" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-white/10 bg-[#131b22] px-4 py-2 text-sm transition hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="font-bold text-amber-400">{creditsLabel}</span>
            <span className="hidden font-medium text-slate-200 sm:inline">
              {dict.common.credits}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 border border-white/10 bg-[#0e151b] p-2 text-slate-200 shadow-2xl"
          >
            <div className="rounded-lg border border-[#1be67a]/20 bg-[#1be67a]/5 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                {dict.topbar.availableBalance}
              </p>
              <p className="mt-0.5 text-xl font-bold text-amber-400">
                {creditsLabel}{" "}
                <span className="text-sm font-medium text-slate-300">
                  {dict.common.credits}
                </span>
              </p>
            </div>
            <DropdownMenuItem
              onClick={() => toast(dict.toasts.rechargeComingSoon)}
              className="mt-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm"
            >
              <Plus className="h-4 w-4 text-[#1be67a]" />
              {dict.topbar.rechargeCredits}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/credits")}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm"
            >
              <Coins className="h-4 w-4 text-slate-400" />
              {dict.topbar.usageHistory}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="hidden h-5 w-px bg-white/10 sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={dict.topbar.notifications}
            className="relative rounded-full p-2 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
          >
            <Bell className="h-5 w-5" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
                {unreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 border border-white/10 bg-[#0e151b] p-2 text-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold text-white">
                {dict.topbar.notifications}
              </span>
              <span className="text-[11px] font-medium text-[#1be67a]">
                {unreadCount} {dict.topbar.unread}
              </span>
            </div>
            <div className="space-y-1">
              {notifications.map((notification) => {
                const Icon =
                  notification.icon === "success" ? CircleCheck : Coins;
                const iconColor =
                  notification.icon === "success"
                    ? "text-[#1be67a]"
                    : "text-amber-400";

                return (
                  <div
                    key={notification.id}
                    className="flex gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.04]"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-white">
                          {notification.title}
                        </span>
                        {notification.unread && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1be67a]" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-slate-400">
                        {notification.description}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        {notification.time}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => toast(dict.toasts.allRead)}
              className="flex cursor-pointer items-center justify-center rounded-lg px-2 py-2 text-[12px] font-medium text-slate-300"
            >
              {dict.topbar.markAllRead}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={dict.topbar.userMenu}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#19c765] text-sm font-bold text-white shadow-[0_0_12px_rgba(25,199,101,0.4)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
          >
            {workspace.user.initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 border border-white/10 bg-[#0e151b] p-2 text-slate-200 shadow-2xl"
          >
            <div className="flex items-center gap-3 px-2 py-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#19c765] text-sm font-bold text-white">
                {workspace.user.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">
                  {workspace.user.firstName} {workspace.user.lastName}
                </span>
                <span className="block truncate text-[11px] text-slate-500">
                  {workspace.user.email}
                </span>
              </span>
            </div>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={() => router.push("/parametres")}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm"
            >
              <UserRound className="h-4 w-4 text-slate-400" />
              {dict.topbar.profile}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => router.push("/parametres")}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              {dict.topbar.settings}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              onClick={handleLogout}
              variant="destructive"
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm"
            >
              <LogOut className="h-4 w-4" />
              {dict.topbar.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
