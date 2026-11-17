"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { startProjectAction } from "@/app/actions/projects";
import { ProjectCard } from "@/components/dashboard/project-card";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/i18n/provider";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { can } from "@/lib/roles";
import type { Project } from "@/lib/types";

export function ProjectsView({ projects }: { projects: Project[] }) {
  const { dict } = useI18n();
  const workspace = useWorkspace();
  const canCreate = can(
    workspace.organization.role,
    "project.create",
  );
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isPending, startTransition] = useTransition();

  const readyCount = projects.filter(
    (project) => project.status === "ready",
  ).length;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? projects.filter((project) =>
        `${project.name} ${project.prompt}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : projects;

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();

    if (value.length < 3 || isPending || !canCreate) return;

    startTransition(async () => {
      const result = await startProjectAction({ prompt: value });

      if ("projectId" in result) {
        setCreateOpen(false);
        router.push(`/creer?project=${result.projectId}`);
      } else {
        toast(dict.toasts.actionFailed);
      }
    });
  }

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#1be67a]">
              {dict.projectsPage.eyebrow}
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
              {dict.projectsPage.title}
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-slate-400">
              {dict.projectsPage.description}
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setPrompt("");
                setCreateOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
            >
              <Plus className="h-4 w-4" />
              {dict.projectsPage.newProject}
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-300">
            {dict.projectsPage.total.replace(
              "{count}",
              String(projects.length),
            )}
          </span>
          <span className="rounded-full border border-[#1be67a]/25 bg-[#1be67a]/10 px-3 py-1 text-[11px] font-medium text-[#1be67a]">
            {dict.projectsPage.ready.replace(
              "{count}",
              String(readyCount),
            )}
          </span>
        </div>

        {projects.length > 0 && (
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
        )}

        {projects.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-[#0e151b]/60 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]">
              <FolderKanban className="h-6 w-6" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-white">
              {dict.projectsPage.emptyTitle}
            </p>
            <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-400">
              {dict.projectsPage.emptyDescription}
            </p>
            {canCreate && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-5 flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[13px] font-semibold text-slate-950 transition hover:bg-[#16cf6c]"
              >
                <Plus className="h-4 w-4" />
                {dict.projectsPage.newProject}
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <p className="mt-8 text-center text-[13px] text-slate-500">
            {dict.projectsPage.noResults}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3.5 min-[1500px]:grid-cols-2">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                showStatus
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={dict.projectsPage.createTitle}
        description={dict.projectsPage.createDescription}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-white/15 bg-[#141d24] px-3.5 py-2 text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
            >
              {dict.common.cancel}
            </button>
            <button
              type="submit"
              form="create-project-form"
              disabled={isPending || prompt.trim().length < 3}
              className="flex items-center gap-1.5 rounded-lg bg-[#1be67a] px-3.5 py-2 text-[12px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isPending
                ? dict.projectsPage.creating
                : dict.projectsPage.newProject}
            </button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={handleCreate}>
          <label
            htmlFor="create-project-prompt"
            className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400"
          >
            {dict.projectsPage.promptLabel}
          </label>
          <textarea
            id="create-project-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            autoFocus
            placeholder={dict.projectsPage.promptPlaceholder}
            className="w-full resize-none rounded-xl border border-white/10 bg-[#0b1116] px-3.5 py-2.5 text-[13px] leading-relaxed text-white outline-none transition placeholder:text-slate-600 focus:border-[#1be67a]/60 focus:ring-2 focus:ring-[#1be67a]/10"
          />
        </form>
      </Modal>
    </main>
  );
}
