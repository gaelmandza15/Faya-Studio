"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Loader2,
  MoreVertical,
  PencilLine,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteProjectAction,
  duplicateProjectAction,
  renameProjectAction,
} from "@/app/actions/projects";
import { ProjectGlyph } from "@/components/dashboard/glyphs";
import { Modal } from "@/components/ui/modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/provider";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { can } from "@/lib/roles";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProjectCard({
  project,
  showStatus = false,
}: {
  project: Project;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const workspace = useWorkspace();
  const canManage = can(
    workspace.organization.role,
    "project.update",
  );
  const canDelete = can(
    workspace.organization.role,
    "project.delete",
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [isPending, startTransition] = useTransition();

  const href =
    project.href ??
    `/creer?prompt=${encodeURIComponent(project.prompt)}&name=${encodeURIComponent(project.name)}`;
  const optionsLabel = dict.projectMenu.optionsAria.replace(
    "{name}",
    project.name,
  );

  function openRename() {
    setName(project.name);
    setRenameOpen(true);
  }

  function handleRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();

    if (!nextName) return;

    startTransition(async () => {
      const result = await renameProjectAction(project.id, nextName);

      if ("ok" in result) {
        setRenameOpen(false);
        toast(dict.projectsPage.renamed);
        router.refresh();
      } else {
        toast(dict.toasts.actionFailed);
      }
    });
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateProjectAction(project.id);

      if ("projectId" in result) {
        toast(dict.projectsPage.duplicated);
        router.push(`/creer?project=${result.projectId}`);
      } else {
        toast(dict.toasts.actionFailed);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProjectAction(project.id);

      if ("ok" in result) {
        setDeleteOpen(false);
        toast(dict.projectsPage.deleted);
        router.refresh();
      } else {
        toast(dict.toasts.actionFailed);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#141d25] p-3.5 transition hover:border-white/15">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <ProjectGlyph icon={project.icon} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[13.5px] font-semibold text-white">
                {project.name}
              </h3>
              {showStatus && project.status && (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold",
                    project.status === "ready"
                      ? "border-[#1be67a]/25 bg-[#1be67a]/10 text-[#1be67a]"
                      : project.status === "error"
                        ? "border-red-500/25 bg-red-500/10 text-red-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-300",
                  )}
                >
                  {project.status === "ready"
                    ? dict.editor.ready
                    : project.status === "error"
                      ? dict.editor.failed
                      : dict.editor.generating}
                </span>
              )}
            </div>
            <p className="whitespace-nowrap text-[11.5px] text-slate-400">
              {project.modified}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {project.status === "ready" ? (
            <>
              <Link
                href={`/app/${project.id}`}
                className="flex items-center gap-1 rounded-lg bg-[#1be67a] px-2.5 py-1 text-[11.5px] font-semibold text-slate-950 shadow-[0_0_10px_rgba(27,230,122,0.25)] transition hover:bg-[#16cf6c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
              >
                <Play className="h-3 w-3 fill-slate-950" />
                {dict.applicationsPage.launch}
              </Link>
              <Link
                href={href}
                className="rounded-lg border border-white/15 bg-[#1a242d] px-2 py-1 text-[11.5px] font-medium text-slate-300 transition hover:bg-[#22303c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
                title={dict.applicationsPage.openInEditor}
              >
                {dict.common.open}
              </Link>
            </>
          ) : (
            <Link
              href={href}
              className="rounded-lg border border-white/15 bg-[#1a242d] px-2.5 py-1 text-[11.5px] font-medium text-slate-200 transition hover:bg-[#22303c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a]"
            >
              {dict.common.open}
            </Link>
          )}

          <DropdownMenu>
            {canManage && (
              <DropdownMenuTrigger
                aria-label={optionsLabel}
                className="hidden rounded-md p-0.5 text-slate-400 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1be67a] sm:block"
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
            )}
            <DropdownMenuContent
              align="end"
              className="w-48 border border-white/10 bg-[#0e151b] p-1 text-slate-200 shadow-2xl"
            >
              {project.status === "ready" && (
                <DropdownMenuItem
                  onClick={() => router.push(`/app/${project.id}`)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#1be67a] hover:text-[#1be67a]"
                >
                  <Play className="h-4 w-4 fill-[#1be67a]" />
                  {dict.applicationsPage.launchApp}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => router.push(href)}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm"
              >
                <ExternalLink className="h-4 w-4 text-slate-400" />
                {dict.projectMenu.open}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={openRename}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm"
              >
                <PencilLine className="h-4 w-4 text-slate-400" />
                {dict.projectMenu.rename}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDuplicate}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm"
              >
                <Copy className="h-4 w-4 text-slate-400" />
                {dict.projectMenu.duplicate}
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    {dict.projectMenu.delete}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title={dict.projectsPage.renameTitle}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRenameOpen(false)}
              className="rounded-lg border border-white/15 bg-[#141d24] px-3.5 py-2 text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
            >
              {dict.common.cancel}
            </button>
            <button
              type="submit"
              form="rename-project-form"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-[#1be67a] px-3.5 py-2 text-[12px] font-semibold text-slate-950 transition hover:bg-[#16cf6c] disabled:cursor-wait disabled:opacity-70"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isPending ? dict.common.saving : dict.common.save}
            </button>
          </>
        }
      >
        <form id="rename-project-form" onSubmit={handleRename}>
          <label
            htmlFor="project-name"
            className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-400"
          >
            {dict.projectsPage.renameLabel}
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={80}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1116] px-3.5 text-[13.5px] text-white outline-none transition focus:border-[#1be67a]/60 focus:ring-2 focus:ring-[#1be67a]/10"
          />
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={dict.projectsPage.deleteTitle}
        description={dict.projectsPage.deleteDescription}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded-lg border border-white/15 bg-[#141d24] px-3.5 py-2 text-[12px] font-medium text-slate-200 transition hover:bg-[#1a242d]"
            >
              {dict.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-red-500 disabled:cursor-wait disabled:opacity-70"
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isPending ? dict.common.saving : dict.common.delete}
            </button>
          </>
        }
      >
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[12px] font-medium text-red-300">
          {project.name}
        </div>
      </Modal>
    </>
  );
}
