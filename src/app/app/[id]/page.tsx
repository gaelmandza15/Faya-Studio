import { stat } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Sparkles, Wrench } from "lucide-react";
import { AppRunner } from "@/components/applications/app-runner";
import { getWorkspacesRoot } from "@/engine/workspace";
import { getI18n } from "@/i18n/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { toProjectIcon } from "@/lib/project-utils";
import { getWorkspaceContext } from "@/lib/workspace";

type AppRunnerPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: AppRunnerPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: project ? `${project.name} · App` : "Application",
  };
}

async function hasGeneratedPreview(projectId: string): Promise<boolean> {
  try {
    const info = await stat(
      path.join(getWorkspacesRoot(), projectId, "index.html"),
    );
    return info.isFile();
  } catch {
    return false;
  }
}

export default async function AppRunnerPage({ params }: AppRunnerPageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const workspace = await getWorkspaceContext();
  const { dict } = await getI18n();

  const project = await db.project.findFirst({
    where: {
      id,
      organizationId: workspace.organization.id,
    },
    select: {
      id: true,
      name: true,
      icon: true,
      status: true,
      syncEnabled: true,
    },
  });

  if (!project) {
    notFound();
  }

  const ready = project.status === "ready";
  const hasFiles = await hasGeneratedPreview(project.id);

  if (!ready || !hasFiles) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-[#090e12] px-4 text-center text-slate-100">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
          <Wrench className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {dict.appRunner.notReadyTitle}
        </h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-slate-400">
          {dict.appRunner.notReadyDescription}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/applications/${project.id}`}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[12.5px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {dict.appRunner.backToApp}
          </Link>
          <Link
            href={`/creer?project=${project.id}`}
            className="flex items-center gap-2 rounded-xl bg-[#1be67a] px-4 py-2.5 text-[12.5px] font-semibold text-slate-950 transition hover:bg-[#16cf6c]"
          >
            <Sparkles className="h-4 w-4" />
            {dict.appRunner.goToEditor}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AppRunner
      project={{
        id: project.id,
        name: project.name,
        icon: toProjectIcon(project.icon),
        status: project.status,
        syncEnabled: project.syncEnabled,
      }}
      src={`/api/workspaces/${project.id}/index.html`}
    />
  );
}
