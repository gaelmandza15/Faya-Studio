import type { Prisma, PrismaClient } from "@prisma/client";
import { asRole, type Role } from "@/lib/roles";

export const APP_ROLES = ["viewer", "editor", "admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type AppPermission = "view" | "write" | "manage";
export type ProjectAccessMode = "organization" | "restricted";

const APP_ROLE_PERMISSIONS: Record<AppRole, AppPermission[]> = {
  viewer: ["view"],
  editor: ["view", "write"],
  admin: ["view", "write", "manage"],
};

export function asAppRole(value: string | null | undefined): AppRole | null {
  return APP_ROLES.includes(value as AppRole) ? (value as AppRole) : null;
}

export function appCan(
  role: AppRole | null,
  permission: AppPermission,
): boolean {
  return role ? APP_ROLE_PERMISSIONS[role].includes(permission) : false;
}

export function appRoleFromOrganizationRole(
  role: string | null | undefined,
): AppRole {
  const organizationRole = asRole(role);

  if (organizationRole === "owner" || organizationRole === "admin") {
    return "admin";
  }

  return organizationRole === "editor" ? "editor" : "viewer";
}

/**
 * Pure resolution used by lists that already loaded the project's access
 * mode and the current user's explicit membership.
 */
export function effectiveAppRole(
  organizationRole: string | null | undefined,
  accessMode: string | null | undefined,
  explicitRole: string | null | undefined,
): AppRole | null {
  const role = asRole(organizationRole);

  if (role === "owner" || role === "admin") {
    return "admin";
  }

  if (accessMode === "restricted") {
    return asAppRole(explicitRole);
  }

  return appRoleFromOrganizationRole(role);
}

export interface ProjectAccess {
  projectId: string;
  organizationId: string;
  organizationRole: Role;
  accessMode: ProjectAccessMode;
  /** Effective role, null when the member has no access in restricted mode. */
  role: AppRole | null;
  explicitRole: AppRole | null;
  isOrganizationAdmin: boolean;
  allowed: boolean;
}

type AccessClient = Pick<PrismaClient, "project" | "membership">;

/**
 * Resolves the effective application role for a platform member.
 *
 * - Organization owners/admins are always application admins.
 * - In "organization" mode, the organization role is mapped to an app role
 *   (owner/admin → admin, editor → editor, viewer → viewer).
 * - In "restricted" mode, only explicit ProjectMember rows grant access.
 */
export async function resolveProjectAccess(
  client: AccessClient,
  userId: string,
  projectId: string,
): Promise<ProjectAccess | null> {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      organizationId: true,
      accessMode: true,
      members: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!project) return null;

  const membership = await client.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: project.organizationId,
      },
    },
    select: { role: true },
  });

  if (!membership) return null;

  const organizationRole = asRole(membership.role);
  const isOrganizationAdmin =
    organizationRole === "owner" || organizationRole === "admin";
  const accessMode: ProjectAccessMode =
    project.accessMode === "restricted" ? "restricted" : "organization";
  const explicitRole = asAppRole(project.members[0]?.role);
  const role = effectiveAppRole(
    organizationRole,
    accessMode,
    explicitRole,
  );

  return {
    projectId: project.id,
    organizationId: project.organizationId,
    organizationRole,
    accessMode,
    role,
    explicitRole,
    isOrganizationAdmin,
    allowed: role !== null,
  };
}

/**
 * Application-facing wrapper. The database import stays dynamic so pure
 * permission helpers can be used from scripts and tests without the
 * `server-only` runtime guard.
 */
export async function getProjectAccess(
  userId: string,
  projectId: string,
): Promise<ProjectAccess | null> {
  const { db } = await import("@/lib/db");
  return resolveProjectAccess(db, userId, projectId);
}

/**
 * Prisma filter used by project lists. Organization admins see everything;
 * other members see open projects plus projects they are explicitly added to.
 */
export function projectVisibilityWhere(
  userId: string,
  organizationId: string,
  organizationRole: string | null | undefined,
): Prisma.ProjectWhereInput {
  const role = asRole(organizationRole);

  if (role === "owner" || role === "admin") {
    return { organizationId };
  }

  return {
    organizationId,
    OR: [
      { accessMode: "organization" },
      { members: { some: { userId } } },
    ],
  };
}
