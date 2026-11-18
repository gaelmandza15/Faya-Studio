import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Cloud,
  Coins,
  Download,
  Globe,
  HardDrive,
  History,
  Package,
  Play,
  Sparkles,
  Users,
} from "lucide-react";
import { AppLinkCard } from "@/components/applications/app-link-card";
import { BackupsCard } from "@/components/applications/backups-card";
import { ConnectionsCard } from "@/components/applications/connections-card";
import { QualityCard } from "@/components/applications/quality-card";
import { ProjectGlyph } from "@/components/dashboard/glyphs";
import { parseStoredAcceptanceReport } from "@/engine/acceptance";
import { formatDate, formatRelativeTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { toProjectIcon } from "@/lib/project-utils";
import { can } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";

type ApplicationPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.applications };
}

function buildStatusLabel(
  status: string,
  dict: Awaited<ReturnType<typeof getI18n>>["dict"],
): string {
  if (status === "done") return dict.applicationsPage.buildStatusDone;
  if (status === "running") return dict.applicationsPage.buildStatusRunning;
  if (status === "error") return dict.applicationsPage.buildStatusError;
  return dict.applicationsPage.buildStatusQueued;
}

function buildStatusClass(status: string): string {
  if (status === "done") {
    return "border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]";
  }
  if (status === "error") {
    return "border-red-500/25 bg-red-500/10 text-red-300";
  }
  return "border-amber-400/20 bg-amber-400/10 text-amber-300";
}

function plainSummary(value: string | null): string {
  return (value ?? "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
    include: {
      createdBy: {
        select: { firstName: true, lastName: true, email: true },
      },
      versions: {
        orderBy: { number: "desc" },
        take: 5,
      },
      builds: {
        orderBy: { createdAt: "desc" },
        take: 6,
      },
      publication: true,
      syncDevices: {
        orderBy: { lastSeenAt: "desc" },
        take: 6,
      },
      webhooks: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          url: true,
          enabled: true,
          secret: true,
          lastStatus: true,
          lastDeliveryAt: true,
        },
      },
      backups: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: {
        select: { versions: true, builds: true },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const [memberCount, generationCharges, buildCharges] =
    await Promise.all([
      db.membership.count({
        where: { organizationId: workspace.organization.id },
      }),
      db.generationJob.findMany({
        where: { projectId: id, creditTransactionId: { not: null } },
        select: { creditTransactionId: true },
      }),
      db.buildJob.findMany({
        where: { projectId: id, creditTransactionId: { not: null } },
        select: { creditTransactionId: true },
      }),
    ]);

  const chargeIds = [
    ...generationCharges.map((job) => job.creditTransactionId),
    ...buildCharges.map((job) => job.creditTransactionId),
  ].filter((value): value is string => Boolean(value));

  const creditRows = chargeIds.length
    ? await db.creditTransaction.findMany({
        where: {
          OR: [{ id: { in: chargeIds } }, { refId: { in: chargeIds } }],
        },
        select: { amount: true },
      })
    : [];

  const creditsUsed = Math.max(
    0,
    creditRows.reduce((total, transaction) => total - transaction.amount, 0),
  );

  const isReady = project.status === "ready";
  const isError = project.status === "error";
  const canManage = can(workspace.organization.role, "project.update");
  const headerList = await headers();
  const platformUrl = (
    process.env.FAYA_PLATFORM_URL ??
    `${headerList.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http")}://${headerList.get("host") ?? "localhost:3000"}`
  ).replace(/\/+$/, "");
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
  const latestBuild = project.builds.find(
    (build) => build.status === "done" && build.artifactName,
  );
  const latestVersion = project.versions[0];
  const targetLabel =
    project.target === "web" ? "Web" : dict.common.desktop;
  const acceptanceReport = parseStoredAcceptanceReport(
    project.acceptanceReport,
  );

  const stats = [
    {
      label: dict.applicationsPage.statsVersions,
      value: String(project._count.versions),
      icon: History,
      tone: "border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]",
    },
    {
      label: dict.applicationsPage.statsBuilds,
      value: String(project._count.builds),
      icon: Package,
      tone: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    },
    {
      label: dict.applicationsPage.statsPublication,
      value: project.publication
        ? dict.applicationsPage.publicationLive
        : dict.applicationsPage.publicationNone,
      icon: Globe,
      tone: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    },
    {
      label: dict.applicationsPage.statsCredits,
      value: String(creditsUsed),
      icon: Coins,
      tone: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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
                <span
                  className={
                    project.syncEnabled
                      ? "flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[9.5px] font-semibold text-sky-300"
                      : "flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-semibold text-slate-400"
                  }
                >
                  {project.syncEnabled ? (
                    <Cloud className="h-2.5 w-2.5" />
                  ) : (
                    <HardDrive className="h-2.5 w-2.5" />
                  )}
                  {project.syncEnabled
                    ? dict.applicationsPage.modeSynced
                    : dict.applicationsPage.modeLocal}
                </span>
              </div>
              <p className="mt-1.5 text-[12px] text-slate-400">
                {dict.applicationsPage.lastActivityLabel} {lastActivity}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isReady && (
              <Link
                href={`/app/${project.id}`}
                className="flex items-center gap-1.5 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.35)] transition hover:bg-[#16cf6c]"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                {dict.applicationsPage.launchApp}
              </Link>
            )}
            {latestBuild && (
              <a
                href={`/api/builds/${latestBuild.id}/download`}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#141d24] px-3.5 py-2.5 text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
              >
                <Download className="h-3.5 w-3.5" />
                {dict.applicationsPage.downloadExe}
              </a>
            )}
            <Link
              href={`/creer?project=${project.id}`}
              className={
                isReady
                  ? "flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#141d24] px-3.5 py-2.5 text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
                  : "flex items-center gap-1.5 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c]"
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              {dict.applicationsPage.openInEditor}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-4"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border ${stat.tone}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-1 truncate text-[18px] font-bold text-white">
                  {stat.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-white">
                    {dict.applicationsPage.versionsSection}
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-slate-400">
                    {dict.applicationsPage.versionsHint}
                  </p>
                </div>
                <Link
                  href={`/creer?project=${project.id}`}
                  className="text-[11px] font-medium text-[#1be67a] transition hover:underline"
                >
                  {dict.applicationsPage.viewVersions}
                </Link>
              </div>

              {project.versions.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11.5px] text-slate-500">
                  {dict.applicationsPage.versionsEmpty}
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-white/[0.05]">
                  {project.versions.map((version, index) => (
                    <li
                      key={version.id}
                      className="flex items-start gap-3 py-3"
                    >
                      <span className="flex h-7 shrink-0 items-center rounded-lg bg-white/[0.06] px-2 font-mono text-[10.5px] font-semibold text-slate-300">
                        v{version.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11.5px] font-semibold text-slate-200">
                            {dict.editor.versionKinds[
                              version.kind as keyof typeof dict.editor.versionKinds
                            ] ?? version.kind}
                          </span>
                          {index === 0 && (
                            <span className="rounded-full bg-[#1be67a]/15 px-2 py-0.5 text-[9px] font-medium text-[#1be67a]">
                              {dict.editor.versionCurrent}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            {formatDate(locale, version.createdAt)}
                          </span>
                        </div>
                        {version.summary && (
                          <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-slate-400">
                            {plainSummary(version.summary)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <div>
                <h2 className="text-[14px] font-semibold text-white">
                  {dict.applicationsPage.buildsSection}
                </h2>
                <p className="mt-0.5 text-[11.5px] text-slate-400">
                  {dict.applicationsPage.buildsHint}
                </p>
              </div>

              {project.builds.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11.5px] text-slate-500">
                  {dict.applicationsPage.buildsEmpty}
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-white/[0.05]">
                  {project.builds.map((build) => (
                    <li
                      key={build.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[11.5px] font-medium text-slate-200">
                            {build.artifactName ?? "Application.exe"}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${buildStatusClass(build.status)}`}
                          >
                            {buildStatusLabel(build.status, dict)}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                          <span>
                            {build.versionNumber
                              ? dict.applicationsPage.buildVersion.replace(
                                  "{number}",
                                  String(build.versionNumber),
                                )
                              : "—"}
                          </span>
                          {build.artifactSize ? (
                            <span>
                              {dict.applicationsPage.buildSize.replace(
                                "{size}",
                                (build.artifactSize / (1024 * 1024)).toFixed(1),
                              )}
                            </span>
                          ) : null}
                          {build.durationMs ? (
                            <span>
                              {dict.applicationsPage.buildDuration.replace(
                                "{seconds}",
                                String(Math.round(build.durationMs / 1000)),
                              )}
                            </span>
                          ) : null}
                          <span>{formatDate(locale, build.createdAt)}</span>
                        </p>
                        {build.status === "error" && build.error && (
                          <p className="mt-1 line-clamp-1 text-[10px] text-red-300">
                            {build.error}
                          </p>
                        )}
                      </div>

                      {build.status === "done" && build.artifactName && (
                        <a
                          href={`/api/builds/${build.id}/download`}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10.5px] font-medium text-slate-300 transition hover:bg-white/5"
                        >
                          <Download className="h-3 w-3" />
                          {dict.applicationsPage.downloadExe}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <AppLinkCard
              projectId={project.id}
              syncEnabled={project.syncEnabled}
              appKey={canManage ? project.appKey : null}
              appKeyPrefix={project.appKeyPrefix}
              lastSyncAt={project.lastSyncAt?.toISOString() ?? null}
              devices={project.syncDevices.map((device) => ({
                id: device.id,
                name: device.name,
                platform: device.platform,
                lastSeenAt: device.lastSeenAt.toISOString(),
              }))}
              canManage={canManage}
            />

            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <h2 className="text-[14px] font-semibold text-white">
                {dict.applicationsPage.publicationSection}
              </h2>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">
                {dict.applicationsPage.publicationHint}
              </p>

              {project.publication ? (
                <div className="mt-4 rounded-xl border border-[#1be67a]/25 bg-[#1be67a]/[0.06] p-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#1be67a]/15 px-2 py-0.5 text-[9px] font-semibold text-[#1be67a]">
                      {dict.applicationsPage.publicationLive}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {dict.applicationsPage.publicationVersion.replace(
                        "{number}",
                        String(project.publication.versionNumber),
                      )}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-[11px] text-slate-300">
                    /p/{project.publication.slug}
                  </p>
                  <a
                    href={`/p/${project.publication.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-[10.5px] font-medium text-slate-300 transition hover:bg-white/5"
                  >
                    <Globe className="h-3 w-3" />
                    {dict.applicationsPage.publicationOpen}
                  </a>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[11px] text-slate-500">
                  {dict.applicationsPage.publicationNone}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5">
              <h2 className="text-[14px] font-semibold text-white">
                {dict.applicationsPage.detailsSection}
              </h2>

              <div className="mt-3 space-y-2.5 text-[11px]">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-slate-500">
                    {dict.applicationsPage.promptLabel}
                  </span>
                  <span className="max-w-[60%] text-right text-slate-300">
                    {project.prompt}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">
                    {dict.applicationsPage.createdByLabel}
                  </span>
                  <span className="text-slate-200">
                    {project.createdBy
                      ? `${project.createdBy.firstName} ${project.createdBy.lastName}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">
                    {dict.applicationsPage.organizationLabel}
                  </span>
                  <span className="text-slate-200">
                    {workspace.organization.name}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">
                    {dict.applicationsPage.statsVersions}
                  </span>
                  <span className="text-slate-200">
                    {latestVersion
                      ? `v${latestVersion.number}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">
                    {dict.applicationsPage.targetLabel}
                  </span>
                  <span className="text-slate-200">{targetLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">
                    {dict.settingsPage.members}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <Users className="h-3 w-3" />
                    {memberCount}
                  </span>
                </div>
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
                <div className="border-t border-white/[0.05] pt-2.5">
                  <p className="text-[9.5px] uppercase tracking-[0.12em] text-slate-500">
                    {dict.applicationsPage.appIdLabel}
                  </p>
                  <p className="mt-1 break-all font-mono text-[10px] text-slate-400">
                    {project.id}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <QualityCard
            projectId={project.id}
            canManage={canManage}
            appStatus={project.status}
            status={project.acceptanceStatus}
            passed={project.acceptancePassed}
            total={project.acceptanceTotal}
            failed={project.acceptanceFailed}
            runAt={project.acceptanceRunAt?.toISOString() ?? null}
            error={project.acceptanceError}
            mode={acceptanceReport?.mode ?? null}
            flows={
              acceptanceReport?.flows.map((flow) => ({
                name: flow.name,
                ok: flow.ok,
                failedStep: flow.failedStep,
                error: flow.error,
              })) ?? []
            }
            consoleErrors={acceptanceReport?.consoleErrors ?? []}
          />

          <BackupsCard
            projectId={project.id}
            syncEnabled={project.syncEnabled}
            canManage={canManage}
            backups={project.backups.map((backup) => ({
              id: backup.id,
              kind: backup.kind,
              size: backup.size,
              versionNumber: backup.versionNumber,
              createdAt: backup.createdAt.toISOString(),
            }))}
          />

          <ConnectionsCard
            projectId={project.id}
            canManage={canManage}
            platformUrl={platformUrl}
            endpoints={project.webhooks.map((endpoint) => ({
              id: endpoint.id,
              name: endpoint.name,
              url: endpoint.url,
              enabled: endpoint.enabled,
              secret: canManage ? endpoint.secret : null,
              lastStatus: endpoint.lastStatus,
              lastDeliveryAt: endpoint.lastDeliveryAt?.toISOString() ?? null,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
