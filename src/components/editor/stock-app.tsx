"use client";

import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bell,
  CircleAlert,
  LayoutDashboard,
  Package,
  Plus,
  Search,
  Truck,
  Wallet,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/i18n/format";
import { useI18n } from "@/i18n/provider";
import { getDemoData } from "@/lib/mock-data";
import type { StockAlert, StockStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<StockStatus, string> = {
  inStock: "border-emerald-100 bg-emerald-50 text-emerald-700",
  lowStock: "border-amber-100 bg-amber-50 text-amber-700",
  outOfStock: "border-red-100 bg-red-50 text-red-600",
};

export function StockApp({ compact = false }: { compact?: boolean }) {
  const { locale, dict } = useI18n();
  const demo = getDemoData(locale);
  const { products, alerts, chart } = demo.stock;
  const stockValue = chart[chart.length - 1]?.value ?? 0;

  const navItems = [
    {
      label: dict.stock.nav.dashboard,
      icon: LayoutDashboard,
      active: true,
    },
    { label: dict.stock.nav.products, icon: Package, active: false },
    { label: dict.stock.nav.movements, icon: ArrowLeftRight, active: false },
    { label: dict.stock.nav.suppliers, icon: Truck, active: false },
    { label: dict.stock.nav.reports, icon: BarChart3, active: false },
  ];

  const kpis = [
    {
      label: dict.stock.kpis.activeProducts,
      value: formatNumber(locale, 248),
      trend: dict.stock.kpis.trendActive,
      note: dict.stock.kpis.thisMonth,
      icon: Package,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: dict.stock.kpis.stockValue,
      value: formatCurrency(locale, stockValue),
      trend: dict.stock.kpis.trendStockValue,
      note: dict.stock.kpis.vsMay,
      icon: Wallet,
      tone: "bg-blue-50 text-blue-600",
    },
    {
      label: dict.stock.kpis.stockAlerts,
      value: formatNumber(locale, alerts.length),
      trend: dict.stock.kpis.trendAlerts,
      note: dict.stock.kpis.sinceYesterday,
      icon: CircleAlert,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      label: dict.stock.kpis.movementsToday,
      value: formatNumber(locale, 27),
      trend: dict.stock.kpis.trendMovements,
      note: dict.stock.kpis.inOut,
      icon: ArrowLeftRight,
      tone: "bg-violet-50 text-violet-600",
    },
  ];

  function alertDetail(alert: StockAlert): string {
    if (alert.level === "out") return dict.stock.detail.outOfStock;
    return dict.stock.detail.unitsLeft.replace(
      "{count}",
      formatNumber(locale, alert.count),
    );
  }

  return (
    <div className="flex min-h-full bg-[#f6f7f9] text-slate-900">
      {!compact && (
        <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4">
          <div className="flex items-center gap-2 px-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
              <Package className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-bold leading-none tracking-tight">
                {dict.stock.appName}
              </p>
              <p className="mt-1 text-[8.5px] font-medium uppercase tracking-wider text-slate-400">
                {dict.stock.tagline}
              </p>
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11.5px]",
                    item.active
                      ? "bg-emerald-50 font-semibold text-emerald-700"
                      : "font-medium text-slate-600",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
              <span>{dict.stock.storage}</span>
              <span>{dict.stock.storagePercent}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[68%] rounded-full bg-emerald-500" />
            </div>
            <p className="mt-2 text-[9.5px] text-slate-500">
              {dict.stock.productsTracked}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
              JD
            </span>
            <div>
              <p className="text-[10.5px] font-semibold leading-none">
                Jean Dupont
              </p>
              <p className="mt-1 text-[9px] text-slate-500">
                {dict.common.administrator}
              </p>
            </div>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-slate-400">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-[11px]">
              {dict.stock.searchPlaceholder}
            </span>
            {!compact && (
              <span className="ml-auto hidden rounded border border-slate-200 bg-white px-1 py-0.5 text-[9px] text-slate-400 sm:inline">
                ⌘K
              </span>
            )}
          </div>
          <span className="relative rounded-lg p-1.5 text-slate-500">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
            JD
          </span>
        </div>

        <div className={cn("space-y-4", compact ? "p-4" : "p-6")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                {dict.stock.overview}
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">
                {dict.stock.dashboardTitle}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {dict.stock.greeting}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10.5px] font-semibold text-white shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              {compact
                ? dict.stock.newProductShort
                : dict.stock.newProduct}
            </span>
          </div>

          <div
            className={cn(
              "grid gap-3",
              compact ? "grid-cols-2" : "grid-cols-2 xl:grid-cols-4",
            )}
          >
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        kpi.tone,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[9.5px] font-semibold text-emerald-600">
                      {kpi.trend}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[9.5px] font-medium uppercase tracking-wider text-slate-400">
                    {kpi.label}
                  </p>
                  <p className="mt-0.5 text-[17px] font-bold tracking-tight text-slate-900">
                    {kpi.value}
                  </p>
                  <p className="mt-0.5 text-[9px] text-slate-400">
                    {kpi.note}
                  </p>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "grid gap-4",
              compact ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-3",
            )}
          >
            <div
              className={cn(
                "rounded-xl border border-slate-200 bg-white p-4",
                !compact && "xl:col-span-2",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[12px] font-semibold text-slate-800">
                    {dict.stock.chart.title}
                  </h3>
                  <p className="mt-0.5 text-[9.5px] text-slate-400">
                    {dict.stock.chart.subtitle}
                  </p>
                </div>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-medium text-slate-500">
                  {dict.stock.chart.period}
                </span>
              </div>

              <div className="mt-4 flex h-32 items-end gap-2 sm:gap-3">
                {chart.map((item) => (
                  <div
                    key={item.month}
                    className="flex flex-1 flex-col items-center gap-1.5"
                  >
                    <div className="flex h-28 w-full items-end justify-center">
                      <div
                        className="w-full max-w-9 rounded-t-md bg-linear-to-t from-emerald-500 to-emerald-300"
                        style={{ height: `${item.height}%` }}
                        title={`${item.month} · ${formatCurrency(locale, item.value)}`}
                      />
                    </div>
                    <span className="text-[8.5px] text-slate-400">
                      {item.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[12px] font-semibold text-slate-800">
                  {dict.stock.alerts.title}
                </h3>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-600">
                  {formatNumber(locale, alerts.length)}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.name}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                        alert.level === "out"
                          ? "bg-red-50 text-red-500"
                          : "bg-amber-50 text-amber-500",
                      )}
                    >
                      <CircleAlert className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[10.5px] font-medium leading-snug text-slate-700">
                        {alert.name}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[9.5px]",
                          alert.level === "out"
                            ? "text-red-500"
                            : "text-amber-600",
                        )}
                      >
                        {alertDetail(alert)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div>
                <h3 className="text-[12px] font-semibold text-slate-800">
                  {dict.stock.table.title}
                </h3>
                <p className="mt-0.5 text-[9.5px] text-slate-400">
                  {dict.stock.table.subtitle}
                </p>
              </div>
              <span className="flex items-center gap-1 text-[9.5px] font-medium text-emerald-600">
                {dict.common.viewAll}
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70 text-[8.5px] uppercase tracking-wider text-slate-400">
                    <th className="px-4 py-2 font-medium">
                      {dict.stock.table.product}
                    </th>
                    {!compact && (
                      <th className="px-3 py-2 font-medium">
                        {dict.stock.table.sku}
                      </th>
                    )}
                    {!compact && (
                      <th className="px-3 py-2 font-medium">
                        {dict.stock.table.category}
                      </th>
                    )}
                    <th className="px-3 py-2 font-medium">
                      {dict.stock.table.stock}
                    </th>
                    {!compact && (
                      <th className="px-3 py-2 font-medium">
                        {dict.stock.table.threshold}
                      </th>
                    )}
                    <th className="px-3 py-2 font-medium">
                      {dict.stock.table.price}
                    </th>
                    <th className="px-3 py-2 pr-4 font-medium">
                      {dict.stock.table.status}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.id} className="text-[10.5px]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                            <Package className="h-3 w-3" />
                          </span>
                          <span className="block max-w-[130px] truncate font-medium text-slate-700">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      {!compact && (
                        <td className="px-3 py-2.5 text-slate-400">
                          {product.id}
                        </td>
                      )}
                      {!compact && (
                        <td className="px-3 py-2.5 text-slate-500">
                          {product.category}
                        </td>
                      )}
                      <td className="px-3 py-2.5 font-medium text-slate-700">
                        {formatNumber(locale, product.stock)}
                      </td>
                      {!compact && (
                        <td className="px-3 py-2.5 text-slate-400">
                          {formatNumber(locale, product.threshold)}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-700">
                        {formatCurrency(locale, product.price, 2)}
                      </td>
                      <td className="px-3 py-2.5 pr-4">
                        <span
                          className={cn(
                            "inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[8.5px] font-semibold",
                            STATUS_STYLES[product.status],
                          )}
                        >
                          {dict.stock.status[product.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="pb-1 text-center text-[8.5px] text-slate-400">
            {dict.stock.footer}
          </p>
        </div>
      </div>
    </div>
  );
}
