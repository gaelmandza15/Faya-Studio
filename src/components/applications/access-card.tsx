"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import {
  addProjectMemberAction,
  removeProjectMemberAction,
  setProjectAccessModeAction,
  updateProjectMemberRoleAction,
  type ProjectAccessMutationResult,
} from "@/app/actions/project-access";
import { useI18n } from "@/i18n/provider";
import type { AppRole } from "@/lib/project-access";

export interface ProjectAccessRow {
  userId: string;
  name: string;
  email: string;
  organizationRole: string;
  appRole: AppRole | null;
  explicitRole: AppRole | null;
  isOrganizationAdmin: boolean;
  isSelf: boolean;
}

interface AccessCardProps {
  projectId: string;
  accessMode: "organization" | "restricted";
  canManage: boolean;
  members: ProjectAccessRow[];
}

const APP_ROLE_LABELS: AppRole[] = ["viewer", "editor", "admin"];

export function AccessCard({
  projectId,
  accessMode,
  canManage,
  members,
}: AccessCardProps) {
  const { dict } = useI18n();
  const labels = dict.applicationsPage.access;
  const roles = dict.settingsPage.roles;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, AppRole>>({});

  function roleLabel(role: AppRole): string {
    return roles[role] ?? role;
  }

  function organizationRoleLabel(role: string): string {
    return (roles as Record<string, string>)[role] ?? role;
  }

  function handle(result: ProjectAccessMutationResult) {
    if ("error" in result) {
      setError(labels.error);
      return;
    }

    setError(null);
    router.refresh();
  }

  function changeMode(mode: "organization" | "restricted") {
    if (mode === accessMode) return;
    setError(null);
    startTransition(async () => {
      handle(await setProjectAccessModeAction(projectId, mode));
    });
  }

  function addMember(userId: string) {
    setError(null);
    startTransition(async () => {
      handle(
        await addProjectMemberAction(
          projectId,
          userId,
          draftRoles[userId] ?? "viewer",
        ),
      );
    });
  }

  function changeRole(userId: string, role: AppRole) {
    setError(null);
    startTransition(async () => {
      handle(await updateProjectMemberRoleAction(projectId, userId, role));
    });
  }

  function removeMember(userId: string) {
    setError(null);
    startTransition(async () => {
      handle(await removeProjectMemberAction(projectId, userId));
    });
  }

  const modeBadge =
    accessMode === "organization"
      ? labels.modeOrganization
      : labels.modeRestricted;

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <Users className="h-4 w-4 text-[#1be67a]" />
            {labels.section}
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold text-slate-400">
              {modeBadge}
            </span>
          </h2>
          <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-slate-400">
            {labels.hint}
          </p>
        </div>

        {canManage && (
          <div className="flex shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <button
              type="button"
              onClick={() => changeMode("organization")}
              disabled={pending}
              className={
                accessMode === "organization"
                  ? "rounded-md bg-[#1be67a]/15 px-2.5 py-1 text-[10px] font-semibold text-[#1be67a]"
                  : "rounded-md px-2.5 py-1 text-[10px] font-medium text-slate-400 transition hover:text-white disabled:opacity-60"
              }
            >
              {labels.modeOrganization}
            </button>
            <button
              type="button"
              onClick={() => changeMode("restricted")}
              disabled={pending}
              className={
                accessMode === "restricted"
                  ? "rounded-md bg-[#1be67a]/15 px-2.5 py-1 text-[10px] font-semibold text-[#1be67a]"
                  : "rounded-md px-2.5 py-1 text-[10px] font-medium text-slate-400 transition hover:text-white disabled:opacity-60"
              }
            >
              {labels.modeRestricted}
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10.5px] leading-relaxed text-slate-400">
        {accessMode === "organization"
          ? labels.organizationHint
          : labels.restrictedHint}
      </p>

      <ul className="mt-3 divide-y divide-white/[0.05]">
        {members.map((member) => {
          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[9.5px] font-semibold text-slate-300">
                  {member.name
                    .split(" ")
                    .map((part) => part.charAt(0))
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11.5px] font-medium text-slate-200">
                    {member.name}
                    {member.isSelf && (
                      <span className="ml-1.5 text-[9px] text-slate-500">
                        ({dict.settingsPage.you})
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[9.5px] text-slate-500">
                    {member.email} · {organizationRoleLabel(member.organizationRole)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {accessMode === "organization" ? (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-medium text-slate-300">
                    {member.isOrganizationAdmin && (
                      <ShieldCheck className="h-2.5 w-2.5 text-[#1be67a]" />
                    )}
                    {member.appRole ? roleLabel(member.appRole) : "—"}
                  </span>
                ) : member.isOrganizationAdmin ? (
                  <span className="flex items-center gap-1 rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 px-2 py-0.5 text-[9.5px] font-medium text-[#1be67a]">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    {roleLabel("admin")}
                  </span>
                ) : canManage ? (
                  <>
                    {!member.explicitRole && (
                      <select
                        value={draftRoles[member.userId] ?? "viewer"}
                        onChange={(event) =>
                          setDraftRoles((current) => ({
                            ...current,
                            [member.userId]: event.target.value as AppRole,
                          }))
                        }
                        disabled={pending}
                        className="rounded-md border border-white/10 bg-[#0e151b] px-2 py-1 text-[10px] text-slate-200"
                      >
                        {APP_ROLE_LABELS.map((role) => (
                          <option key={role} value={role}>
                            {roleLabel(role)}
                          </option>
                        ))}
                      </select>
                    )}

                    {member.explicitRole ? (
                      <>
                        <select
                          value={member.explicitRole}
                          onChange={(event) =>
                            changeRole(
                              member.userId,
                              event.target.value as AppRole,
                            )
                          }
                          disabled={pending}
                          className="rounded-md border border-white/10 bg-[#0e151b] px-2 py-1 text-[10px] text-slate-200"
                        >
                          {APP_ROLE_LABELS.map((role) => (
                            <option key={role} value={role}>
                              {roleLabel(role)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(member.userId)}
                          disabled={pending}
                          aria-label={labels.remove}
                          title={labels.remove}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:border-red-500/30 hover:text-red-300 disabled:opacity-50"
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addMember(member.userId)}
                        disabled={pending}
                        className="flex items-center gap-1 rounded-md border border-[#1be67a]/25 bg-[#1be67a]/10 px-2 py-1 text-[9.5px] font-medium text-[#1be67a] transition hover:bg-[#1be67a]/15 disabled:opacity-50"
                      >
                        {pending ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-2.5 w-2.5" />
                        )}
                        {labels.add}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[9.5px] text-slate-500">
                    {labels.noAccess}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!canManage && (
        <p className="mt-2 text-[10.5px] text-slate-500">
          {labels.viewerHint}
        </p>
      )}

      {error && <p className="mt-2 text-[10.5px] text-red-300">{error}</p>}
    </section>
  );
}
