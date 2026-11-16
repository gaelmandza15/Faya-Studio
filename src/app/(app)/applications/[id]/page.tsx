import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  History,
  Share2,
  Users,
} from "lucide-react";
import { ProjectGlyph } from "@/components/dashboard/glyphs";
import {
  formatDate,
  formatRelativeTime,
} from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { toProjectIcon } from "@/lib/project-utils";
import { getWorkspaceContext } from "@/lib/workspace";

type ApplicationPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.applications };
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationPageProps) {
  const { id } = await params;
  const { locale, dict } = await getI18n();
  const workspace = await getWorkspaceContext();

  const project = await db.project.findFirst({
    where: {
      id,
      organizationId: workspace.organization.id,
    },
  });

  if (!project) {
    notFound();
  }

  const isReady = project.status === "ready";
  const isError = project.status === "error";
  const statusLabel = isReady
    ? dict.editor.ready
    : isError
      ? dict.editor.failed
      : dict.editor.generating;
  const icon = toProjectIcon(project.icon);
  const lastActivity = formatRelativeTime(
    locale,
    project.lastActivityAt,
  );

  const comingSoon = [
    {
      icon: History,
      title: dict.applicationsPage.versionsTitle,
      description: dict.applicationsPage.versionsDescription,
    },
    {
      icon: Users,
      title: dict.applicationsPage.usersTitle,
      description: dict.applicationsPage.usersDescription,
    },
    {
      icon: Share2,
      title: dict.applicationsPage.connectionsTitle,
      description: dict.applicationsPage.connectionsDescription,
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/applications"
          className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.applicationsPage.backToApplications}
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#141d25]">
              <ProjectGlyph icon={icon} className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {project.name}
                </h1>
                <span
                  className={
                    isReady
                      ? "rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 px-2 py-0.5 text-[9.5px] font-semibold text-[#1be67a]"
                      : isError
                        ? "rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-red-300"
                        : "rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[9.5px] font-semibold text-amber-300"
                  }
                >
                  {statusLabel}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-slate-400">
                {dict.applicationsPage.lastActivityLabel}{" "}
                {lastActivity}
              </p>
            </div>
          </div>

          <Link
            href={`/creer?project=${project.id}`}
            className="rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c]"
          >
            {dict.common.open}
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5 lg:col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {dict.applicationsPage.promptLabel}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
              {project.prompt}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
            <div className="space-y-3 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">
                  {dict.applicationsPage.createdLabel}
                </span>
                <span className="text-slate-200">
                  {formatDate(locale, project.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">
                  {dict.common.lastActivity}
                </span>
                <span className="text-slate-200">{lastActivity}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">
                  {dict.common.status}
                </span>
                <span className="text-slate-200">{statusLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {comingSoon.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/[0.07] bg-[#141d25]/70 p-4"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="mt-3 text-[13px] font-semibold text-white">
                  {item.title}
                </h2>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
