import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { resolvePublicationFile } from "@/engine/publications";
import { isValidPublicationSlug } from "@/lib/publication-utils";
import { db } from "@/lib/db";

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
    params: Promise<{ slug: string; path?: string[] }>;
  },
) {
  const { slug, path: segments = [] } = await params;

  if (!isValidPublicationSlug(slug)) {
    return new Response("Not found", { status: 404 });
  }

  const publication = await db.publication.findUnique({
    where: { slug },
    select: { projectId: true },
  });

  if (!publication) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const relative =
      segments.length === 0 ? "index.html" : segments.join("/");
    let absolute = resolvePublicationFile(slug, relative);
    let info = await stat(absolute);

    if (info.isDirectory()) {
      absolute = resolvePublicationFile(
        slug,
        `${relative}/index.html`,
      );
      info = await stat(absolute);
    }

    if (!info.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    let body = await readFile(absolute);
    const extension = path.extname(absolute).toLowerCase();

    if (extension === ".html") {
      let html = body.toString("utf8");

      if (!/<base\b/i.test(html)) {
        const base = `<base href="/p/${slug}/">`;

        if (/<head(\s[^>]*)?>/i.test(html)) {
          html = html.replace(
            /<head(\s[^>]*)?>/i,
            (match) => `${match}${base}`,
          );
        } else {
          html = `${base}${html}`;
        }
      }

      body = Buffer.from(html, "utf8");
    }

    const headers: Record<string, string> = {
      "Content-Type":
        CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    };

    if (extension === ".html") {
      headers["Content-Security-Policy"] =
        "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; form-action 'none'; base-uri 'self'";
    }

    return new Response(body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
