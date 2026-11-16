"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { getSession, updateUserLocale } from "@/lib/auth/session";

export async function setLocaleAction(formData: FormData) {
  const locale = formData.get("locale");

  if (typeof locale !== "string" || !isLocale(locale)) {
    return;
  }

  const session = await getSession();

  if (session) {
    await updateUserLocale(session.userId, locale);
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
