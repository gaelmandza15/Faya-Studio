import { Clock, FolderKanban, LayoutGrid } from "lucide-react";
import { ProjectCard } from "@/components/dashboard/project-card";
import { SectionHeading } from "@/components/dashboard/section-heading";
import { TemplateCard } from "@/components/dashboard/template-card";
import { formatRelativeTime } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { getDemoData } from "@/lib/mock-data";
import { toProjectIcon } from "@/lib/project-utils";
import type { Project } from "@/lib/types";
import { getWorkspaceContext } from "@/lib/workspace";

export async function ProjectsAndTemplates() {
  const { locale, dict } = await getI18n();
  const demo = getDemoData(locale);
  const workspace = await getWorkspaceContext();

  const dbProjects = await db.project.findMany({
    where: { organizationId: workspace.organization.id },
    orderBy: { lastActivityAt: "desc" },
    take: 4,
  });

  const projects: Project[] = dbProjects.map((project) => ({
    id: project.id,
    name: project.name,
    prompt: project.prompt,
    icon: toProjectIcon(project.icon),
    modified: `${dict.common.modified} ${formatRelativeTime(locale, project.lastActivityAt)}`,
    href: `/creer?project=${project.id}`,
  }));

  return (
    <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5 xl:col-span-7">
        <SectionHeading
          icon={<Clock className="h-5 w-5 text-amber-400" />}
          title={dict.dashboard.recentProjects}
          href="/projets"
          linkLabel={dict.common.viewAll}
        />
        {projects.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3.5 min-[1650px]:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-white/10 bg-[#141d25]/50 px-6 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1be67a]/20 bg-[#1be67a]/10 text-[#1be67a]">
              <FolderKanban className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-white">
              {dict.dashboard.emptyProjectsTitle}
            </p>
            <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-slate-400">
              {dict.dashboard.emptyProjectsDescription}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0e151b]/90 p-5 xl:col-span-5">
        <SectionHeading
          icon={<LayoutGrid className="h-5 w-5 text-slate-200" />}
          title={dict.dashboard.appTemplates}
          href="/modeles"
          linkLabel={dict.common.viewAll}
        />
        <div className="mt-4 space-y-2.5">
          {demo.templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              useLabel={dict.common.use}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
