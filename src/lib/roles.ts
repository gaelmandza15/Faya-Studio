export const ROLES = ["owner", "admin", "editor", "viewer"] as const;

export type Role = (typeof ROLES)[number];

export type Permission =
  | "project.create"
  | "project.update"
  | "project.delete"
  | "generation.run"
  | "build.run"
  | "publication.manage"
  | "version.restore"
  | "organization.manage"
  | "member.manage"
  | "billing.manage";

const ALL_PERMISSIONS: Permission[] = [
  "project.create",
  "project.update",
  "project.delete",
  "generation.run",
  "build.run",
  "publication.manage",
  "version.restore",
  "organization.manage",
  "member.manage",
  "billing.manage",
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL_PERMISSIONS,
  admin: [
    "project.create",
    "project.update",
    "project.delete",
    "generation.run",
    "build.run",
    "publication.manage",
    "version.restore",
    "organization.manage",
    "member.manage",
  ],
  editor: [
    "project.create",
    "project.update",
    "generation.run",
    "build.run",
    "publication.manage",
    "version.restore",
  ],
  viewer: [],
};

export function asRole(value: string | null | undefined): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "viewer";
}

export function can(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[asRole(role)].includes(permission);
}

const ASSIGNABLE: Record<Role, Role[]> = {
  owner: ["admin", "editor", "viewer"],
  admin: ["editor", "viewer"],
  editor: [],
  viewer: [],
};

export function canAssignRole(
  actorRole: string | null | undefined,
  targetRole: string,
): boolean {
  return ASSIGNABLE[asRole(actorRole)].includes(asRole(targetRole));
}

export function assignableRoles(role: string | null | undefined): Role[] {
  return ASSIGNABLE[asRole(role)];
}
