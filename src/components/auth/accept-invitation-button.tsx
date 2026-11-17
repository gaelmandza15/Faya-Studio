"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserRoundPlus } from "lucide-react";
import { acceptInvitationAction } from "@/app/actions/members";
import { useI18n } from "@/i18n/provider";

export function AcceptInvitationButton({ token }: { token: string }) {
  const { dict } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    if (pending) return;

    startTransition(async () => {
      const result = await acceptInvitationAction(token);

      if ("ok" in result) {
        router.push("/");
        router.refresh();
        return;
      }

      if (result.error === "emailMismatch") {
        setError(dict.invitePage.error);
      } else if (result.error === "alreadyAccepted") {
        setError(dict.invitePage.already);
      } else if (result.error === "expired") {
        setError(dict.invitePage.expired);
      } else {
        setError(dict.invitePage.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={accept}
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1be67a] text-[13.5px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserRoundPlus className="h-4 w-4" />
        )}
        {pending ? dict.invitePage.accepting : dict.invitePage.accept}
      </button>
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
