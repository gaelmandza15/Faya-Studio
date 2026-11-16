"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ORG_COOKIE } from "@/lib/workspace";

export async function selectOrganizationAction(organizationId: string) {
  const user = await requireUser();

  const membership = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId,
      },
    },
  });

  if (!membership) {
    return { error: "forbidden" as const };
  }

  const cookieStore = await cookies();
  cookieStore.set(ORG_COOKIE, organizationId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}
