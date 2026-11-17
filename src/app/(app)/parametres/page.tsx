import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { getWorkspaceContext } from "@/lib/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.meta.settings };
}

export default async function ParametresPage() {
  const workspace = await getWorkspaceContext();

  const memberships = await db.membership.findMany({
    where: { organizationId: workspace.organization.id },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const currentMembership = memberships.find(
    (membership) => membership.userId === workspace.user.id,
  );

  const members = memberships.map((membership) => ({
    id: membership.user.id,
    firstName: membership.user.firstName,
    lastName: membership.user.lastName,
    email: membership.user.email,
    role: membership.role,
  }));

  return (
    <SettingsView
      user={workspace.user}
      organization={workspace.organization}
      members={members}
      currentRole={currentMembership?.role ?? "member"}
      currentUserId={workspace.user.id}
    />
  );
}
