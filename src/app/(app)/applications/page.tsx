import type { Metadata } from "next";
import { ApplicationsView } from "@/components/applications/applications-view";
import { formatRelativeTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import {
  appCan,
  effectiveAppRole,
  projectVisibilityWhere,
} from "@/lib/project-access";
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
    where: projectVisibilityWhere(
      workspace.user.id,
      workspace.organization.id,
      workspace.organization.role,
    ),
    include: {
      members: {
        where: { userId: workspace.user.id },
        select: { role: true },
        take: 1,
      },
    },
    orderBy: { lastActivityAt: "desc" },
  });

  const applications: Project[] = dbProjects.map((project) => {
    const role = effectiveAppRole(
      workspace.organization.role,
      project.accessMode,
      project.members[0]?.role,
    );

    return {
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
      syncEnabled: project.syncEnabled,
      modified: `${dict.common.modified} ${formatRelativeTime(locale, project.lastActivityAt)}`,
      href: appCan(role, "write")
        ? `/creer?project=${project.id}`
        : `/applications/${project.id}`,
    };
  });

  return <ApplicationsView applications={applications} />;
}
