"use server";

import { revalidatePath } from "next/cache";
import {
  removePublicationFiles,
  writePublicationFiles,
} from "@/engine/publications";
import { createProjectVersion } from "@/engine/versions";
import { db } from "@/lib/db";
import { isValidPublicationSlug, slugify } from "@/lib/publication-utils";
import { can } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";

export type PublishProjectResult =
  | {
      ok: true;
      slug: string;
      url: string;
      versionNumber: number;
    }
  | {
      error:
        | "notFound"
        | "notReady"
        | "busy"
        | "invalidSlug"
        | "slugTaken"
        | "forbidden"
        | "generic";
    };

export type UnpublishProjectResult =
  | { ok: true }
  | { error: "notFound" | "forbidden" | "generic" };

function revalidatePublicationViews() {
  revalidatePath("/");
  revalidatePath("/projets");
  revalidatePath("/applications");
  revalidatePath("/creer");
}

export async function publishProjectAction(
  projectId: string,
  slugInput?: string,
): Promise<PublishProjectResult> {
  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "publication.manage")) {
      return { error: "forbidden" };
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        organizationId: workspace.organization.id,
      },
    });

    if (!project) {
      return { error: "notFound" };
    }

    if (project.status !== "ready") {
      return { error: "notReady" };
    }

    const activeJob = await db.generationJob.findFirst({
      where: {
        projectId,
        status: { in: ["queued", "running"] },
      },
    });

    if (activeJob) {
      return { error: "busy" };
    }

    const slug = slugify(slugInput?.trim() || project.name);

    if (!isValidPublicationSlug(slug)) {
      return { error: "invalidSlug" };
    }

    const conflicting = await db.publication.findUnique({
      where: { slug },
    });

    if (conflicting && conflicting.projectId !== projectId) {
      return { error: "slugTaken" };
    }

    let version = await db.projectVersion.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
    });

    if (!version) {
      version = await createProjectVersion(db, projectId, {
        kind: "baseline",
        summary: "Version publiée",
      });
    }

    const previous = await db.publication.findUnique({
      where: { projectId },
    });

    await writePublicationFiles(projectId, slug);

    if (previous && previous.slug !== slug) {
      await removePublicationFiles(previous.slug).catch(
        () => undefined,
      );
    }

    await db.publication.upsert({
      where: { projectId },
      create: {
        projectId,
        slug,
        versionNumber: version.number,
      },
      update: {
        slug,
        versionNumber: version.number,
      },
    });

    revalidatePublicationViews();
    return {
      ok: true,
      slug,
      url: `/p/${slug}`,
      versionNumber: version.number,
    };
  } catch (error) {
    console.error("Publication failed", error);
    return { error: "generic" };
  }
}

export async function unpublishProjectAction(
  projectId: string,
): Promise<UnpublishProjectResult> {
  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "publication.manage")) {
      return { error: "forbidden" };
    }

    const publication = await db.publication.findFirst({
      where: {
        projectId,
        project: { organizationId: workspace.organization.id },
      },
    });

    if (!publication) {
      return { error: "notFound" };
    }

    await removePublicationFiles(publication.slug);
    await db.publication.delete({
      where: { id: publication.id },
    });

    revalidatePublicationViews();
    return { ok: true };
  } catch (error) {
    console.error("Unpublish failed", error);
    return { error: "generic" };
  }
}
