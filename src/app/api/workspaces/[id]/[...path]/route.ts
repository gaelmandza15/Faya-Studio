import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";
import {
  assertWorkspaceId,
  getWorkspacesRoot,
  resolveInsideWorkspace,
} from "@/engine/workspace";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; path?: string[] }>;
  },
) {
  const session = await getSession();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id, path: segments = [] } = await params;

  try {
    assertWorkspaceId(id);
  } catch {
    return new Response("Invalid workspace id", { status: 400 });
  }

  const root = path.join(getWorkspacesRoot(), id);

  try {
    const relative =
      segments.length === 0 ? "index.html" : segments.join("/");
    let absolute = resolveInsideWorkspace(root, relative);
    const info = await stat(absolute);

    if (info.isDirectory()) {
      absolute = resolveInsideWorkspace(root, `${relative}/index.html`);
    }

    const body = await readFile(absolute);
    const extension = path.extname(absolute).toLowerCase();
    const contentType =
      CONTENT_TYPES[extension] ?? "application/octet-stream";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };

    if (extension === ".html") {
      headers["Content-Security-Policy"] =
        "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
    }

    return new Response(body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
