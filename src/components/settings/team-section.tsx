"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Loader2,
  Trash2,
  UserRoundPlus,
  Users,
} from "lucide-react";
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/actions/members";
import { useI18n } from "@/i18n/provider";
import {
  assignableRoles,
  can,
  canAssignRole,
  type Role,
} from "@/lib/roles";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export function TeamSection({
  members,
  currentRole,
  currentUserId,
}: {
  members: TeamMember[];
  currentRole: string;
  currentUserId: string;
}) {
  const { dict } = useI18n();
  const router = useRouter();
  const canManage = can(currentRole, "member.manage");
  const roleOptions = assignableRoles(currentRole);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(
    roleOptions.includes("editor")
      ? "editor"
      : roleOptions[0] ?? "viewer",
  );
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(
    null,
  );

  function roleLabel(memberRole: string): string {
    return (
      dict.settingsPage.roles[
        memberRole as keyof typeof dict.settingsPage.roles
      ] ?? memberRole
    );
  }

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviting || !canManage) return;

    setInviting(true);
    setError(null);
    setInviteLink(null);
    setCopied(false);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("role", role);

    const result = await inviteMemberAction(formData);

    if ("ok" in result) {
      setInviteLink(
        `${window.location.origin}${result.inviteUrl}`,
      );
      setInviteEmail(result.email);
      setEmail("");
      router.refresh();
    } else if (result.error === "alreadyMember") {
      setError(dict.settingsPage.alreadyMember);
    } else if (result.error === "forbidden") {
      setError(dict.settingsPage.inviteForbidden);
    } else if (result.error === "invalid") {
      setError(dict.settingsPage.inviteError);
    } else {
      setError(dict.settingsPage.inviteError);
    }

    setInviting(false);
  }

  async function changeRole(memberId: string, nextRole: string) {
    setUpdatingId(memberId);
    setError(null);

    const result = await updateMemberRoleAction(memberId, nextRole);

    if (!("ok" in result)) {
      setError(dict.settingsPage.roleError);
    }

    setUpdatingId(null);
    router.refresh();
  }

  async function remove(memberId: string) {
    setRemovingId(memberId);
    setError(null);

    const result = await removeMemberAction(memberId);

    if (!("ok" in result)) {
      setError(dict.settingsPage.memberError);
    }

    setRemovingId(null);
    setConfirmRemoveId(null);
    router.refresh();
  }

  async function copyInvite() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(dict.settingsPage.inviteError);
    }
  }

  return (
    <div className="mt-6 border-t border-white/[0.06] pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-400" />
          <h3 className="text-[12.5px] font-semibold text-white">
            {dict.settingsPage.members}
          </h3>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setInviteOpen((open) => !open);
              setError(null);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#141d24] px-3 py-1.5 text-[11.5px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
          >
            <UserRoundPlus className="h-3.5 w-3.5" />
            {dict.settingsPage.invite}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {dict.settingsPage.membersDescription}
      </p>

      {inviteOpen && canManage && (
        <div className="mt-4 rounded-xl border border-[#1be67a]/20 bg-[#1be67a]/[0.04] p-3.5">
          <p className="text-[12px] font-semibold text-white">
            {dict.settingsPage.inviteTitle}
          </p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-slate-400">
            {dict.settingsPage.inviteDescription}
          </p>

          <form onSubmit={invite} className="mt-3 flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={dict.settingsPage.inviteEmail}
              required
              className="h-9 min-w-[180px] flex-1 rounded-lg border border-white/10 bg-[#0b1116] px-2.5 text-[11.5px] text-white outline-none focus:border-[#1be67a]/50"
            />
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as Role)
              }
              className="h-9 rounded-lg border border-white/10 bg-[#0b1116] px-2 text-[11.5px] text-slate-200 outline-none"
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {roleLabel(option)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1be67a] px-3 text-[11.5px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inviting && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {dict.settingsPage.createInvite}
            </button>
          </form>

          {inviteLink && (
            <div className="mt-3 rounded-lg border border-white/10 bg-[#0b1116] p-2.5">
              <p className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-500">
                {dict.settingsPage.inviteLinkLabel} · {inviteEmail}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="h-8 min-w-0 flex-1 bg-transparent text-[10.5px] text-slate-300 outline-none"
                />
                <button
                  type="button"
                  onClick={() => void copyInvite()}
                  className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 transition hover:bg-white/5"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-[#1be67a]" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied
                    ? dict.settingsPage.inviteCopied
                    : dict.settingsPage.copyInvite}
                </button>
              </div>
              <p className="mt-1 text-[9.5px] text-slate-500">
                {dict.settingsPage.inviteExpires}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[10.5px] text-red-300">
          {error}
        </p>
      )}

      <ul className="mt-3 divide-y divide-white/[0.05]">
        {members.map((member) => {
          const isSelf = member.id === currentUserId;
          const editable =
            canManage &&
            !isSelf &&
            member.role !== "owner" &&
            canAssignRole(currentRole, member.role);
          const removable =
            canManage &&
            !isSelf &&
            member.role !== "owner" &&
            canAssignRole(currentRole, member.role);

          return (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#19c765] text-[10px] font-bold text-white">
                  {member.firstName.charAt(0)}
                  {member.lastName.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-white">
                    {member.firstName} {member.lastName}
                    {isSelf && (
                      <span className="ml-1.5 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-400">
                        {dict.settingsPage.you}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[10.5px] text-slate-500">
                    {member.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editable ? (
                  <select
                    value={member.role}
                    onChange={(event) =>
                      void changeRole(
                        member.id,
                        event.target.value,
                      )
                    }
                    disabled={updatingId === member.id}
                    className="h-7 rounded-lg border border-white/10 bg-[#0b1116] px-2 text-[10.5px] text-slate-200 outline-none disabled:opacity-60"
                  >
                    <option value={member.role}>
                      {roleLabel(member.role)}
                    </option>
                    {roleOptions
                      .filter((option) => option !== member.role)
                      .map((option) => (
                        <option key={option} value={option}>
                          {roleLabel(option)}
                        </option>
                      ))}
                  </select>
                ) : (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                    {roleLabel(member.role)}
                  </span>
                )}

                {removable &&
                  (confirmRemoveId === member.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(null)}
                        className="rounded-md border border-white/10 px-1.5 py-1 text-[9.5px] text-slate-400"
                      >
                        {dict.settingsPage.removeCancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(member.id)}
                        disabled={removingId === member.id}
                        className="rounded-md bg-red-500/90 px-1.5 py-1 text-[9.5px] font-semibold text-white disabled:opacity-60"
                      >
                        {dict.settingsPage.removeConfirm}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(member.id)}
                      aria-label={dict.settingsPage.removeMember}
                      className="rounded-md border border-red-500/20 p-1 text-red-300 transition hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
