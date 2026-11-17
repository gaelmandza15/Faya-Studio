export const PUBLICATION_SLUG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_SLUGS = new Set([
  "api",
  "p",
  "login",
  "register",
  "creer",
  "projets",
  "applications",
  "credits",
  "parametres",
  "modeles",
  "aide",
  "_next",
  "publications",
  "workspaces",
  "faya",
]);

export function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return base || "app";
}

export function isValidPublicationSlug(slug: string): boolean {
  return (
    slug.length >= 3 &&
    slug.length <= 60 &&
    PUBLICATION_SLUG_PATTERN.test(slug) &&
    !RESERVED_SLUGS.has(slug)
  );
}
