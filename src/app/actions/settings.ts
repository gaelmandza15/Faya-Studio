"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
});

const organizationSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type SettingsMutationResult =
  | { ok: true }
  | { error: "invalid" | "forbidden" | "generic" };

export async function updateProfileAction(
  formData: FormData,
): Promise<SettingsMutationResult> {
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    const workspace = await getWorkspaceContext();

    await db.user.update({
      where: { id: workspace.user.id },
      data: parsed.data,
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("Profile update failed", error);
    return { error: "generic" };
  }
}

export async function updateOrganizationAction(
  formData: FormData,
): Promise<SettingsMutationResult> {
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    const workspace = await getWorkspaceContext();

    if (!can(workspace.organization.role, "organization.manage")) {
      return { error: "forbidden" };
    }

    await db.organization.update({
      where: { id: workspace.organization.id },
      data: { name: parsed.data.name },
    });

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("Organization update failed", error);
    return { error: "generic" };
  }
}
