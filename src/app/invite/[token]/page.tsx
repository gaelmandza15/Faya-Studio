import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { AcceptInvitationButton } from "@/components/auth/accept-invitation-button";
import { LogoMark } from "@/components/brand/logo";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashInvitationToken } from "@/lib/invitations";

export const instant = false;

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { dict } = await getI18n();
  const session = await getSession();

  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { organization: true, invitedBy: true },
  });

  const roleLabel = invitation
    ? dict.settingsPage.roles[
        invitation.role as keyof typeof dict.settingsPage.roles
      ] ?? invitation.role
    : "";
  const inviter =
    invitation?.invitedBy?.firstName ||
    invitation?.organization.name ||
    "";
  const next = `/invite/${token}`;

  // The page is request-bound (instant = false); the check runs once per
  // server render and must use the real current time.
  /* eslint-disable react-hooks/purity */
  const expired =
    invitation && invitation.expiresAt.getTime() <= Date.now();
  /* eslint-enable react-hooks/purity */
  const invalid =
    !invitation || Boolean(invitation.acceptedAt) || expired;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#090e12] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1be67a]">
              {dict.invitePage.eyebrow}
            </p>
            <p className="text-[12px] text-slate-400">
              {dict.common.appName}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.4)]">
          {!invitation ? (
            <>
              <h1 className="text-[20px] font-semibold text-white">
                {dict.invitePage.invalid}
              </h1>
              <Link
                href="/"
                className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-[12px] text-slate-300 transition hover:bg-white/5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {dict.invitePage.back}
              </Link>
            </>
          ) : invalid ? (
            <>
              <h1 className="text-[20px] font-semibold text-white">
                {invitation.acceptedAt
                  ? dict.invitePage.already
                  : expired
                    ? dict.invitePage.expired
                    : dict.invitePage.invalid}
              </h1>
              <Link
                href="/"
                className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-[12px] text-slate-300 transition hover:bg-white/5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {dict.invitePage.back}
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#1be67a]">
                <Mail className="h-3.5 w-3.5" />
                {dict.invitePage.eyebrow}
              </div>
              <h1 className="mt-2 text-[22px] font-bold tracking-tight text-white">
                {dict.invitePage.title.replace(
                  "{organization}",
                  invitation.organization.name,
                )}
              </h1>
              <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">
                {dict.invitePage.description
                  .replace("{inviter}", inviter)
                  .replace(
                    "{organization}",
                    invitation.organization.name,
                  )
                  .replace("{role}", roleLabel)}
              </p>

              {session ? (
                session.user.email.toLowerCase() ===
                invitation.email.toLowerCase() ? (
                  <div className="mt-5">
                    <p className="mb-3 text-[11px] text-slate-500">
                      {dict.invitePage.loggedAs.replace(
                        "{email}",
                        session.user.email,
                      )}
                    </p>
                    <AcceptInvitationButton token={token} />
                  </div>
                ) : (
                  <p className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-[11.5px] leading-relaxed text-red-300">
                    {dict.invitePage.mismatch
                      .replace("{email}", invitation.email)
                      .replace("{current}", session.user.email)}
                  </p>
                )
              ) : (
                <div className="mt-5 grid gap-2">
                  <Link
                    href={`/login?next=${encodeURIComponent(next)}`}
                    className="flex h-11 items-center justify-center rounded-xl bg-[#1be67a] text-[13px] font-semibold text-slate-950 transition hover:bg-[#16cf6c]"
                  >
                    {dict.invitePage.login}
                  </Link>
                  <Link
                    href={`/register?next=${encodeURIComponent(next)}`}
                    className="flex h-11 items-center justify-center rounded-xl border border-white/10 text-[12.5px] font-medium text-slate-300 transition hover:bg-white/5"
                  >
                    {dict.invitePage.register}
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
