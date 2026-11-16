import { Suspense } from "react";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorLoading } from "@/components/editor/editor-loading";
import { CreationStudio } from "@/components/editor/creation-studio";
import { RealCreationStudio } from "@/components/editor/real-creation-studio";
import { getWorkspacesRoot } from "@/engine/workspace";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { getDemoData } from "@/lib/mock-data";
import type { ProjectStatus } from "@/lib/types";
import { getWorkspaceContext } from "@/lib/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.create };
}

type CreerPageProps = {
  searchParams: Promise<{
    project?: string | string[];
    prompt?: string | string[];
    name?: string | string[];
  }>;
};

export default function CreerPage({ searchParams }: CreerPageProps) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<EditorLoading />}>
        <EditorFromParams searchParams={searchParams} />
      </Suspense>
    </main>
  );
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

async function EditorFromParams({
  searchParams,
}: {
  searchParams: CreerPageProps["searchParams"];
}) {
  const { locale, dict } = await getI18n();
  const params = await searchParams;
  const projectParam = Array.isArray(params.project)
    ? params.project[0]
    : params.project;
  const promptParam = Array.isArray(params.prompt)
    ? params.prompt[0]
    : params.prompt;
  const nameParam = Array.isArray(params.name) ? params.name[0] : params.name;

  if (projectParam) {
    const workspace = await getWorkspaceContext();
    const project = await db.project.findFirst({
      where: {
        id: projectParam,
        organizationId: workspace.organization.id,
      },
    });

    if (!project) {
      notFound();
    }

    const initialProjectStatus: ProjectStatus =
      project.status === "ready"
        ? "ready"
        : project.status === "error"
          ? "error"
          : "generating";

    const previewReady = await hasGeneratedPreview(project.id);

    return (
      <RealCreationStudio
        key={`${locale}-${project.id}`}
        projectId={project.id}
        projectName={project.name}
        initialPrompt={project.prompt}
        initialProjectStatus={initialProjectStatus}
        initialPreviewReady={previewReady}
      />
    );
  }

  const initialPrompt =
    promptParam?.trim() || getDemoData(locale).defaultPrompt;
  const projectName = nameParam?.trim() || dict.editor.defaultProjectName;

  return (
    <CreationStudio
      key={`${locale}-new`}
      initialPrompt={initialPrompt}
      projectName={projectName}
    />
  );
}
