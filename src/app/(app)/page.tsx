import { DashboardHero } from "@/components/dashboard/hero";
import { FeaturesGrid } from "@/components/dashboard/features-grid";
import { ProjectsAndTemplates } from "@/components/dashboard/projects-and-templates";

export default function HomePage() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1680px] space-y-6 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <DashboardHero />
        <ProjectsAndTemplates />
        <FeaturesGrid />
      </div>
    </main>
  );
}
