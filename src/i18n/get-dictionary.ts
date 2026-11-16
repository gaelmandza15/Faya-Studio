import type { Locale } from "@/i18n/config";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import type { Dictionary } from "@/i18n/types";

const dictionaries: Record<Locale, Dictionary> = {
  fr,
  en,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
