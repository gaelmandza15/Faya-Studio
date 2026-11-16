"use client";

import { Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/provider";

export function CreditsActions() {
  const { dict } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => toast(dict.toasts.rechargeComingSoon)}
        className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#141d24] px-4 py-2.5 text-[12.5px] font-medium text-slate-200 transition hover:bg-[#1a242d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
      >
        <Coins className="h-4 w-4 text-amber-400" />
        {dict.creditsPage.recharge}
      </button>
      <button
        type="button"
        onClick={() =>
          toast(dict.toasts.proOffer, {
            description: dict.toasts.proOfferDescription,
          })
        }
        className="flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[12.5px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
      >
        <Sparkles className="h-4 w-4" />
        {dict.creditsPage.upgrade}
      </button>
    </div>
  );
}
