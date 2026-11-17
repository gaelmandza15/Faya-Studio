import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Workspace {
  id: string;
  dir: string;
}

export interface WorkspaceFile {
  path: string;
  size: number;
}

const MAX_FILE_BYTES = 512 * 1024;
const MAX_LISTED_FILES = 200;

export function getWorkspacesRoot(): string {
  return process.env.FAYA_WORKSPACES_DIR
    ? path.resolve(process.env.FAYA_WORKSPACES_DIR)
    : path.join(process.cwd(), "workspaces");
}

export function assertWorkspaceId(id: string): void {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    throw new Error("Invalid workspace id.");
  }
}

export async function createWorkspace(
  id: string = randomUUID(),
): Promise<Workspace> {
  assertWorkspaceId(id);

  const root = getWorkspacesRoot();
  await mkdir(root, { recursive: true });

  const dir = path.join(root, id);
  await mkdir(dir, { recursive: true });

  return { id, dir };
}

export function resolveInsideWorkspace(
  root: string,
  relativePath: string,
): string {
  const cleaned = String(relativePath ?? "")
    .replace(/^@/, "")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "./") {
    return path.resolve(root);
  }

  if (
    path.isAbsolute(cleaned) ||
    /^[a-zA-Z]:[\\/]/.test(cleaned) ||
    cleaned.startsWith("\\\\")
  ) {
    throw new Error("Absolute paths are not allowed.");
  }

  const resolved = path.resolve(root, cleaned);
  const relative = path.relative(root, resolved);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Path escapes the workspace.");
  }

  const internal = relative.split(path.sep)[0];

  if (internal === ".faya" || internal === ".build") {
    throw new Error("Internal workspace paths are not accessible.");
  }

  return resolved;
}

export async function listWorkspaceFiles(
  root: string,
  maxDepth = 4,
): Promise<WorkspaceFile[]> {
  const files: WorkspaceFile[] = [];

  async function walk(directory: string, depth: number) {
    if (depth > maxDepth || files.length >= MAX_LISTED_FILES) return;

    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= MAX_LISTED_FILES) return;
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".faya" ||
        entry.name === ".build"
      ) {
        continue;
      }

      const absolute = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(absolute, depth + 1);
        continue;
      }

      if (entry.isFile()) {
        const info = await stat(absolute);
        files.push({
          path: path.relative(root, absolute).split(path.sep).join("/"),
          size: info.size,
        });
      }
    }
  }

  await walk(root, 0);
  return files;
}

export async function readWorkspaceFile(
  root: string,
  relativePath: string,
): Promise<string> {
  const absolute = resolveInsideWorkspace(root, relativePath);
  const content = await readFile(absolute, "utf8");

  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new Error("File is too large to read.");
  }

  return content;
}

export async function writeWorkspaceFile(
  root: string,
  relativePath: string,
  content: string,
): Promise<number> {
  const bytes = Buffer.byteLength(content, "utf8");

  if (bytes > MAX_FILE_BYTES) {
    throw new Error("File is too large to write.");
  }

  const absolute = resolveInsideWorkspace(root, relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");

  return bytes;
}
