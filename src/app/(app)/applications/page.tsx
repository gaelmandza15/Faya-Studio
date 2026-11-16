import type { Metadata } from "next";
import { ApplicationsView } from "@/components/applications/applications-view";
import { formatRelativeTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { toProjectIcon } from "@/lib/project-utils";
import type { Project } from "@/lib/types";
import { getWorkspaceContext } from "@/lib/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.applications };
}

export default async function ApplicationsPage() {
  const { locale, dict } = await getI18n();
  const workspace = await getWorkspaceContext();

  const dbProjects = await db.project.findMany({
    where: { organizationId: workspace.organization.id },
    orderBy: { lastActivityAt: "desc" },
  });

  const applications: Project[] = dbProjects.map((project) => ({
    id: project.id,
    name: project.name,
    prompt: project.prompt,
    icon: toProjectIcon(project.icon),
    status:
      project.status === "ready"
        ? "ready"
        : project.status === "error"
          ? "error"
          : "generating",
    modified: `${dict.common.modified} ${formatRelativeTime(locale, project.lastActivityAt)}`,
    href: `/creer?project=${project.id}`,
  }));

  return <ApplicationsView applications={applications} />;
}
