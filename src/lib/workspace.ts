import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { WorkspaceData } from "@/lib/types";

export const ORG_COOKIE = "faya_org";

export const getWorkspaceContext = cache(async (): Promise<WorkspaceData> => {
  const user = await requireUser();

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const preferredOrganizationId = cookieStore.get(ORG_COOKIE)?.value;
  const activeMembership =
    memberships.find(
      (membership) =>
        membership.organizationId === preferredOrganizationId,
    ) ?? memberships[0];

  if (!activeMembership) {
    redirect("/login");
  }

  const organizations = memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    plan: membership.organization.plan,
    credits: membership.organization.credits,
  }));

  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() ||
    user.email.slice(0, 2).toUpperCase();

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      initials,
      email: user.email,
    },
    organization: {
      id: activeMembership.organization.id,
      name: activeMembership.organization.name,
      plan: activeMembership.organization.plan,
      credits: activeMembership.organization.credits,
    },
    organizations,
  };
});
