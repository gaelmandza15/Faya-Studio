"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Loader2,
  LogOut,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import {
  updateOrganizationAction,
  updateProfileAction,
} from "@/app/actions/settings";
import { FormField } from "@/components/auth/form-field";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { formatNumber } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import type {
  WorkspaceOrganization,
  WorkspaceUser,
} from "@/lib/types";

interface SettingsMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export function SettingsView({
  user,
  organization,
  members,
  currentRole,
}: {
  user: WorkspaceUser;
  organization: WorkspaceOrganization;
  members: SettingsMember[];
  currentRole: string;
}) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [organizationName, setOrganizationName] = useState(
    organization.name,
  );
  const [profileMessage, setProfileMessage] = useState<string | null>(
    null,
  );
  const [organizationMessage, setOrganizationMessage] = useState<
    string | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const planLabel =
    dict.topbar.plans[organization.plan as "pro" | "starter"] ??
    organization.plan;
  const canEditOrganization =
    currentRole === "owner" || currentRole === "admin";

  function roleLabel(role: string): string {
    return (
      dict.settingsPage.roles[
        role as keyof typeof dict.settingsPage.roles
      ] ?? role
    );
  }

  function handleProfileSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setProfileMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateProfileAction(formData);

      if ("ok" in result) {
        setProfileMessage(dict.settingsPage.saved);
        router.refresh();
      } else {
        setProfileMessage(dict.settingsPage.error);
      }
    });
  }

  function handleOrganizationSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setOrganizationMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateOrganizationAction(formData);

      if ("ok" in result) {
        setOrganizationMessage(dict.settingsPage.saved);
        router.refresh();
      } else {
        setOrganizationMessage(dict.settingsPage.error);
      }
    });
  }

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#1be67a]">
            {dict.settingsPage.eyebrow}
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
            {dict.settingsPage.title}
          </h1>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-slate-400">
            {dict.settingsPage.description}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-[#1be67a]" />
                <h2 className="text-[14px] font-semibold text-white">
                  {dict.settingsPage.profile}
                </h2>
              </div>
              <p className="mt-1 text-[11.5px] text-slate-400">
                {dict.settingsPage.profileDescription}
              </p>

              <form
                onSubmit={handleProfileSubmit}
                className="mt-4 space-y-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label={dict.auth.firstName}
                    name="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                  <FormField
                    label={dict.auth.lastName}
                    name="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>
                <FormField
                  label={dict.auth.email}
                  name="email"
                  type="email"
                  value={user.email}
                  disabled
                  hint={dict.settingsPage.emailReadonlyHint}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1be67a] px-3.5 py-2 text-[12px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:cursor-wait disabled:opacity-70"
                  >
                    {isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {isPending ? dict.common.saving : dict.common.save}
                  </button>
                  {profileMessage && (
                    <span className="text-[11.5px] text-[#1be67a]">
                      {profileMessage}
                    </span>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#1be67a]" />
                <h2 className="text-[14px] font-semibold text-white">
                  {dict.settingsPage.organization}
                </h2>
              </div>
              <p className="mt-1 text-[11.5px] text-slate-400">
                {dict.settingsPage.organizationDescription}
              </p>

              <form
                onSubmit={handleOrganizationSubmit}
                className="mt-4 space-y-4"
              >
                <FormField
                  label={dict.settingsPage.organizationName}
                  name="name"
                  value={organizationName}
                  onChange={(event) =>
                    setOrganizationName(event.target.value)
                  }
                  disabled={!canEditOrganization}
                  required
                />
                <div className="flex flex-wrap items-center gap-3">
                  {canEditOrganization && (
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex items-center gap-1.5 rounded-lg bg-[#1be67a] px-3.5 py-2 text-[12px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:cursor-wait disabled:opacity-70"
                    >
                      {isPending && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {isPending ? dict.common.saving : dict.common.save}
                    </button>
                  )}
                  <span className="text-[11.5px] text-slate-500">
                    {dict.settingsPage.plan}: {planLabel} ·{" "}
                    {formatNumber(locale, organization.credits)}{" "}
                    {dict.common.credits}
                  </span>
                  {organizationMessage && (
                    <span className="text-[11.5px] text-[#1be67a]">
                      {organizationMessage}
                    </span>
                  )}
                </div>
              </form>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <h3 className="text-[12.5px] font-semibold text-white">
                      {dict.settingsPage.members}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      toast(dict.settingsPage.inviteComingSoon)
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#141d24] px-3 py-1.5 text-[11.5px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
                  >
                    <UserRoundPlus className="h-3.5 w-3.5" />
                    {dict.settingsPage.invite}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {dict.settingsPage.membersDescription}
                </p>

                <ul className="mt-3 divide-y divide-white/[0.05]">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#19c765] text-[10px] font-bold text-white">
                          {member.firstName.charAt(0)}
                          {member.lastName.charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-white">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="truncate text-[10.5px] text-slate-500">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {roleLabel(member.role)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <h2 className="text-[14px] font-semibold text-white">
                {dict.settingsPage.language}
              </h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                {dict.settingsPage.languageDescription}
              </p>
              <div className="mt-4">
                <LanguageSwitcher />
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#1be67a]" />
                <h2 className="text-[14px] font-semibold text-white">
                  {dict.settingsPage.security}
                </h2>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                {dict.settingsPage.securityDescription}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white">
                    {dict.settingsPage.currentSession}
                  </p>
                  <p className="truncate text-[10.5px] text-slate-500">
                    {user.email}
                  </p>
                </div>
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#1be67a]" />
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] font-medium text-red-300 transition hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-70"
              >
                <LogOut className="h-3.5 w-3.5" />
                {dict.settingsPage.logout}
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
