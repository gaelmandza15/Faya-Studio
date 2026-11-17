"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getLocale } from "@/i18n/server";
import {
  createSession,
  destroySession,
} from "@/lib/auth/session";
import { db } from "@/lib/db";

export type AuthErrorCode =
  | "missingFields"
  | "invalidCredentials"
  | "emailTaken"
  | "invalidEmail"
  | "passwordTooShort"
  | "generic";

export interface AuthState {
  error?: AuthErrorCode;
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  organizationName: z.string().trim().optional(),
});

function setLocaleCookie(locale: string) {
  return cookies().then((cookieStore) => {
    cookieStore.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  });
}

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "workspace"
  );
}

export async function loginAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "missingFields" };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    return { error: "invalidCredentials" };
  }

  const passwordMatches = await compare(
    parsed.data.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return { error: "invalidCredentials" };
  }

  await createSession(user.id);
  await setLocaleCookie(user.locale);
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function registerAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName") ?? "",
  });

  if (!parsed.success) {
    const password = formData.get("password");
    const email = formData.get("email");

    if (typeof password === "string" && password.length > 0 && password.length < 8) {
      return { error: "passwordTooShort" };
    }

    if (typeof email === "string" && email.length > 0 && !email.includes("@")) {
      return { error: "invalidEmail" };
    }

    return { error: "missingFields" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    return { error: "emailTaken" };
  }

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const organizationName =
    parsed.data.organizationName?.trim() ||
    dict.auth.personalWorkspace.replace("{name}", parsed.data.firstName);
  const passwordHash = await hash(parsed.data.password, 10);

  try {
    const user = await db.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email,
          passwordHash,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          locale,
        },
      });

      const organization = await transaction.organization.create({
        data: {
          name: organizationName,
          slug: `${slugify(organizationName)}-${randomBytes(2).toString("hex")}`,
          plan: "starter",
          credits: 250,
        },
      });

      await transaction.membership.create({
        data: {
          userId: createdUser.id,
          organizationId: organization.id,
          role: "owner",
        },
      });

      await transaction.creditTransaction.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          amount: 250,
          reason: "welcome",
        },
      });

      return createdUser;
    });

    await createSession(user.id);
    await setLocaleCookie(locale);
    revalidatePath("/", "layout");
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "emailTaken" };
    }

    console.error("Registration failed", error);
    return { error: "generic" };
  }

  redirect(safeNext(formData.get("next")));
}

export async function logoutAction() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}
