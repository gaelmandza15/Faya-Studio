import type { Locale } from "@/i18n/config";

function toIntlLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(toIntlLocale(locale)).format(value);
}

export function formatCurrency(
  locale: Locale,
  value: number,
  fractionDigits = 0,
): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatRelativeTime(
  locale: Locale,
  date: Date,
  now = new Date(),
): string {
  const diffMs = date.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const minutes = Math.max(1, Math.round(absMs / 60000));

  if (absMs < 60000) {
    return locale === "fr" ? "à l'instant" : "just now";
  }

  if (minutes < 60) {
    return locale === "fr"
      ? `il y a ${minutes} min`
      : `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return locale === "fr" ? `il y a ${hours} h` : `${hours} h ago`;
  }

  const days = Math.round(hours / 24);

  return locale === "fr" ? `il y a ${days} j` : `${days} d ago`;
}

export function formatDate(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
