"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  hashInvitationToken,
  INVITATION_TTL_MS,
} from "@/lib/invitations";
import {
  can,
  canAssignRole,
  type Role,
} from "@/lib/roles";
import { requireUser } from "@/lib/auth/session";
import { ORG_COOKIE, getWorkspaceContext } from "@/lib/workspace";

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "editor", "viewer"]),
});

export type InviteMemberResult =
  | {
      ok: true;
      email: string;
      role: string;
      inviteUrl: string;
      expiresAt: string;
    }
  | {
      error:
        | "invalid"
        | "forbidden"
        | "alreadyMember"
        | "generic";
    };

export type MemberMutationResult =
  | { ok: true }
  | { error: "notFound" | "forbidden" | "generic" };

export type AcceptInvitationResult =
  | { ok: true; organizationId: string }
  | {
      error:
        | "invalid"
        | "expired"
        | "alreadyAccepted"
        | "emailMismatch"
        | "generic";
    };

export async function inviteMemberAction(
  formData: FormData,
): Promise<InviteMemberResult> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "member.manage")) {
      return { error: "forbidden" };
    }

    if (!canAssignRole(workspace.organization.role, parsed.data.role)) {
      return { error: "forbidden" };
    }

    const email = parsed.data.email.toLowerCase();
    const existingUser = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organizationId: workspace.organization.id },
        },
      },
    });

    if (existingUser?.memberships.length) {
      return { error: "alreadyMember" };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    await db.invitation.deleteMany({
      where: {
        organizationId: workspace.organization.id,
        email,
        acceptedAt: null,
      },
    });

    await db.invitation.create({
      data: {
        organizationId: workspace.organization.id,
        email,
        role: parsed.data.role,
        tokenHash,
        invitedById: workspace.user.id,
        expiresAt,
      },
    });

    revalidatePath("/parametres");
    return {
      ok: true,
      email,
      role: parsed.data.role,
      inviteUrl: `/invite/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error("Invitation failed", error);
    return { error: "generic" };
  }
}

export async function updateMemberRoleAction(
  memberUserId: string,
  role: string,
): Promise<MemberMutationResult> {
  const parsedRole = z
    .enum(["admin", "editor", "viewer"])
    .safeParse(role);

  if (!parsedRole.success) {
    return { error: "forbidden" };
  }

  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "member.manage")) {
      return { error: "forbidden" };
    }

    const membership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: memberUserId,
          organizationId: workspace.organization.id,
        },
      },
    });

    if (!membership) {
      return { error: "notFound" };
    }

    if (
      membership.role === "owner" ||
      memberUserId === workspace.user.id ||
      !canAssignRole(
        workspace.organization.role,
        parsedRole.data,
      )
    ) {
      return { error: "forbidden" };
    }

    await db.membership.update({
      where: { id: membership.id },
      data: { role: parsedRole.data },
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("Member role update failed", error);
    return { error: "generic" };
  }
}

export async function removeMemberAction(
  memberUserId: string,
): Promise<MemberMutationResult> {
  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "member.manage")) {
      return { error: "forbidden" };
    }

    if (memberUserId === workspace.user.id) {
      return { error: "forbidden" };
    }

    const membership = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: memberUserId,
          organizationId: workspace.organization.id,
        },
      },
    });

    if (!membership) {
      return { error: "notFound" };
    }

    if (
      membership.role === "owner" ||
      !canAssignRole(
        workspace.organization.role,
        membership.role as Role,
      )
    ) {
      return { error: "forbidden" };
    }

    await db.membership.delete({ where: { id: membership.id } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("Member removal failed", error);
    return { error: "generic" };
  }
}

export async function acceptInvitationAction(
  token: string,
): Promise<AcceptInvitationResult> {
  if (!token.trim()) {
    return { error: "invalid" };
  }

  try {
    const user = await requireUser();
    const tokenHash = hashInvitationToken(token);
    const invitation = await db.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      return { error: "invalid" };
    }

    if (invitation.acceptedAt) {
      return { error: "alreadyAccepted" };
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      return { error: "expired" };
    }

    if (
      invitation.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      return { error: "emailMismatch" };
    }

    const existing = await db.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (!existing) {
      await db.$transaction([
        db.membership.create({
          data: {
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        }),
        db.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        }),
      ]);
    } else {
      await db.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    }

    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE, invitation.organizationId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
    });

    revalidatePath("/", "layout");
    return { ok: true, organizationId: invitation.organizationId };
  } catch (error) {
    console.error("Invitation acceptance failed", error);
    return { error: "generic" };
  }
}
