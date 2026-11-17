import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { getWorkspacesRoot } from "./workspace";

const PUBLICATIONS_DIR = ".publications";
const EXCLUDED = [
  ".faya",
  ".build",
  ".git",
  "node_modules",
  "design.md",
  "desktop-schema.sql",
];

export function getPublicationsRoot(): string {
  return path.join(getWorkspacesRoot(), PUBLICATIONS_DIR);
}

export function publicationDir(slug: string): string {
  return path.join(getPublicationsRoot(), slug);
}

export async function writePublicationFiles(
  projectId: string,
  slug: string,
): Promise<void> {
  const source = path.join(getWorkspacesRoot(), projectId);
  const target = publicationDir(slug);

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  for (const entry of await readdir(source, {
    withFileTypes: true,
  })) {
    if (EXCLUDED.includes(entry.name)) continue;

    await cp(
      path.join(source, entry.name),
      path.join(target, entry.name),
      { recursive: true },
    );
  }
}

export async function removePublicationFiles(slug: string): Promise<void> {
  await rm(publicationDir(slug), { recursive: true, force: true });
}

export function resolvePublicationFile(
  slug: string,
  relativePath: string,
): string {
  const root = publicationDir(slug);
  const cleaned = String(relativePath ?? "")
    .replace(/^\/+/, "")
    .trim();
  const resolved = path.resolve(
    root,
    cleaned || "index.html",
  );
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes the publication.");
  }

  return resolved;
}

export async function publicationFileExists(
  slug: string,
): Promise<boolean> {
  try {
    const info = await stat(publicationDir(slug));
    return info.isDirectory();
  } catch {
    return false;
  }
}
