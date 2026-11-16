import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  defaultLocale,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Dictionary } from "@/i18n/types";

export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  const headerStore = await headers();
  const accepted = headerStore.get("accept-language") ?? "";
  const preferred = accepted.split(",")[0]?.trim().toLowerCase() ?? "";

  return preferred.startsWith("en") ? "en" : defaultLocale;
});

export const getI18n = cache(
  async (): Promise<{ locale: Locale; dict: Dictionary }> => {
    const locale = await getLocale();
    return { locale, dict: getDictionary(locale) };
  },
);
