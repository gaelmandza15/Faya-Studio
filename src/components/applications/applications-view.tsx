"use client";

import { useState } from "react";
import Link from "next/link";
import { Cloud, HardDrive, LayoutGrid, Play, Plus, Search, Sparkles } from "lucide-react";
import { ProjectGlyph } from "@/components/dashboard/glyphs";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { useI18n } from "@/i18n/provider";
import { can } from "@/lib/roles";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ApplicationsView({
  applications,
}: {
  applications: Project[];
}) {
  const { dict } = useI18n();
  const workspace = useWorkspace();
  const canCreate = can(
    workspace.organization.role,
    "project.create",
  );
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? applications.filter((application) =>
        `${application.name} ${application.prompt}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : applications;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#1be67a]">
              {dict.applicationsPage.eyebrow}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
              {dict.applicationsPage.title}
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-slate-400">
              {dict.applicationsPage.description}
            </p>
          </div>
          {canCreate && (
            <Link
              href="/projets"
              className="flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
            >
              <Plus className="h-4 w-4" />
              {dict.projectsPage.newProject}
            </Link>
          )}
        </div>

        {applications.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-[#0e151b]/60 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]">
              <LayoutGrid className="h-6 w-6" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-white">
              {dict.applicationsPage.emptyTitle}
            </p>
            <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-400">
              {dict.applicationsPage.emptyDescription}
            </p>
            {canCreate && (
              <Link
                href="/projets"
                className="mt-5 flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 transition hover:bg-[#16cf6c]"
              >
                <Plus className="h-4 w-4" />
                {dict.projectsPage.newProject}
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0e151b] px-3 py-2.5 text-slate-400 focus-within:border-[#1be67a]/50">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={dict.projectsPage.searchPlaceholder}
                aria-label={dict.common.search}
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-slate-500"
              />
            </div>

            {filtered.length === 0 ? (
              <p className="mt-8 text-center text-[13px] text-slate-500">
                {dict.projectsPage.noResults}
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {filtered.map((application) => (
                  <div
                    key={application.id}
                    className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-4 transition hover:border-white/15"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                          <ProjectGlyph icon={application.icon} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-[14px] font-semibold text-white">
                            {application.name}
                          </h2>
                          <p className="text-[11.5px] text-slate-400">
                            {application.modified}
                          </p>
                        </div>
                      </div>
                      {application.status && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold",
                            application.status === "ready"
                              ? "border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]"
                              : application.status === "error"
                                ? "border-red-500/25 bg-red-500/10 text-red-300"
                                : "border-amber-400/20 bg-amber-400/10 text-amber-300",
                          )}
                        >
                          {application.status === "ready"
                            ? dict.editor.ready
                            : application.status === "error"
                              ? dict.editor.failed
                              : dict.editor.generating}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-[34px] text-[12px] leading-relaxed text-slate-400">
                      {application.prompt}
                    </p>

                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                      {application.syncEnabled ? (
                        <Cloud className="h-3 w-3 text-sky-300" />
                      ) : (
                        <HardDrive className="h-3 w-3" />
                      )}
                      {application.syncEnabled
                        ? dict.applicationsPage.modeSynced
                        : dict.applicationsPage.modeLocal}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {application.status === "ready" ? (
                        <>
                          <Link
                            href={`/app/${application.id}`}
                            className="flex items-center gap-1.5 rounded-lg bg-[#1be67a] px-3 py-1.5 text-[11.5px] font-semibold text-slate-950 shadow-[0_0_12px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c]"
                          >
                            <Play className="h-3 w-3 fill-slate-950" />
                            {dict.applicationsPage.launch}
                          </Link>
                          <Link
                            href={`/applications/${application.id}`}
                            className="rounded-lg border border-white/15 bg-[#141d24] px-3 py-1.5 text-[11.5px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
                          >
                            {dict.applicationsPage.details}
                          </Link>
                          <Link
                            href={`/creer?project=${application.id}`}
                            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
                            title={dict.applicationsPage.openInEditor}
                          >
                            <Sparkles className="h-3 w-3" />
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link
                            href={
                              application.href ??
                              `/creer?project=${application.id}`
                            }
                            className="rounded-lg bg-[#1be67a] px-3 py-1.5 text-[11.5px] font-semibold text-slate-950 transition hover:bg-[#16cf6c]"
                          >
                            {dict.common.open}
                          </Link>
                          <Link
                            href={`/applications/${application.id}`}
                            className="rounded-lg border border-white/15 bg-[#141d24] px-3 py-1.5 text-[11.5px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
                          >
                            {dict.applicationsPage.details}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
