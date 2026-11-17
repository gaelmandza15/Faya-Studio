import type { Metadata } from "next";
import {
  Coins,
  History,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { CreditsActions } from "@/components/credits/credits-actions";
import { formatDate, formatNumber } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.credits };
}

export default async function CreditsPage() {
  const { locale, dict } = await getI18n();
  const workspace = await getWorkspaceContext();

  const transactions = await db.creditTransaction.findMany({
    where: { organizationId: workspace.organization.id },
    orderBy: { createdAt: "desc" },
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usedThisMonth = Math.max(
    0,
    transactions
      .filter(
        (transaction) =>
          transaction.createdAt >= startOfMonth &&
          (transaction.amount < 0 ||
            transaction.reason.startsWith("refund_")),
      )
      .reduce((total, transaction) => total - transaction.amount, 0),
  );

  const planLabel =
    dict.topbar.plans[
      workspace.organization.plan as "pro" | "starter"
    ] ?? workspace.organization.plan;

  const kpis = [
    {
      label: dict.creditsPage.available,
      value: formatNumber(locale, workspace.organization.credits),
      icon: Coins,
      tone: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    },
    {
      label: dict.creditsPage.usedThisMonth,
      value: formatNumber(locale, usedThisMonth),
      icon: TrendingDown,
      tone: "border-red-500/20 bg-red-500/10 text-red-300",
    },
    {
      label: dict.creditsPage.plan,
      value: planLabel,
      icon: Sparkles,
      tone: "border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]",
    },
    {
      label: dict.creditsPage.transactions,
      value: formatNumber(locale, transactions.length),
      icon: History,
      tone: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#1be67a]">
              {dict.creditsPage.eyebrow}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
              {dict.creditsPage.title}
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-slate-400">
              {dict.creditsPage.description}
            </p>
          </div>
          <CreditsActions />
        </div>

        <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-[11.5px] text-slate-400">
          {dict.creditsPage.note}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["generation", "modification", "build"] as const).map(
            (action) => (
              <div
                key={action}
                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5"
              >
                <span className="text-[11.5px] text-slate-400">
                  {dict.creditReasons[action]}
                </span>
                <span className="text-[11.5px] font-semibold text-slate-200">
                  {dict.creditsPage.cost.replace(
                    "{count}",
                    formatNumber(locale, CREDIT_COSTS[action]),
                  )}
                </span>
              </div>
            ),
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-4"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${kpi.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {kpi.label}
                </p>
                <p className="mt-1 text-xl font-bold text-white">
                  {kpi.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e151b]/90">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14px] font-semibold text-white">
              {dict.creditsPage.transactions}
            </h2>
            <p className="mt-0.5 text-[11.5px] text-slate-400">
              {dict.creditsPage.transactionsDescription}
            </p>
          </div>

          {transactions.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12.5px] text-slate-500">
              {dict.creditsPage.empty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[9.5px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5 font-medium">
                      {dict.creditsPage.date}
                    </th>
                    <th className="px-5 py-2.5 font-medium">
                      {dict.creditsPage.reason}
                    </th>
                    <th className="px-5 py-2.5 text-right font-medium">
                      {dict.creditsPage.amount}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {transactions.map((transaction) => {
                    const reasonKey =
                      transaction.reason as keyof typeof dict.creditReasons;
                    const reasonLabel =
                      dict.creditReasons[reasonKey] ?? transaction.reason;
                    const isPositive = transaction.amount > 0;

                    return (
                      <tr
                        key={transaction.id}
                        className="text-[12px] text-slate-300"
                      >
                        <td className="whitespace-nowrap px-5 py-3 text-slate-400">
                          {formatDate(locale, transaction.createdAt)}
                        </td>
                        <td className="px-5 py-3">{reasonLabel}</td>
                        <td
                          className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                            isPositive ? "text-[#1be67a]" : "text-red-300"
                          }`}
                        >
                          {isPositive ? "+" : "−"}
                          {formatNumber(locale, Math.abs(transaction.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
