import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";
import { appCan, getProjectAccess } from "@/lib/project-access";
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
  request: Request,
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

  const access = await getProjectAccess(session.userId, id);

  if (!access || !appCan(access.role, "view")) {
    return new Response("Forbidden", { status: 403 });
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

    let body = await readFile(absolute);
    const extension = path.extname(absolute).toLowerCase();
    const contentType =
      CONTENT_TYPES[extension] ?? "application/octet-stream";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };

    if (extension === ".html") {
      let html = body.toString("utf8");

      // Inject the Faya Platform Web Bridge before other scripts
      const bridgeScript = `<script>
(function() {
  if (typeof window.__TAURI_INTERNALS__ !== 'undefined' &&
      typeof window.__TAURI_INTERNALS__.invoke === 'function') return;
  const PROJECT_ID = ${JSON.stringify(id)};
  const params = new URLSearchParams(window.location.search);
  const CLIENT_ID = params.get('_client') || 'web';
  const SANDBOX = params.get('_sandbox') || '';
  const invoke = async function(cmd, args) {
    if (cmd !== 'db_select' && cmd !== 'db_execute') {
      throw new Error('Commande non supportée sur le Web Bridge : ' + cmd);
    }
    const headers = {
      'Content-Type': 'application/json',
      'X-Faya-Client': CLIENT_ID
    };
    if (SANDBOX) headers['X-Faya-Sandbox'] = SANDBOX;
    const res = await fetch('/api/projects/' + PROJECT_ID + '/db', {
      method: 'POST',
      headers: headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        cmd: cmd,
        query: args && args.query,
        params: (args && args.params) || []
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(function() { return { error: 'Erreur SQL' }; });
      throw new Error(err.error || ('Erreur HTTP ' + res.status));
    }
    const data = await res.json();
    return data.result;
  };
  // Generated apps use either __TAURI__ or __TAURI_INTERNALS__.
  window.__TAURI__ = { core: { invoke: invoke } };
  window.__TAURI_INTERNALS__ = { invoke: invoke };
})();
</script>`;

      if (/<head(\s[^>]*)?>/i.test(html)) {
        html = html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${bridgeScript}`);
      } else {
        html = `${bridgeScript}\n${html}`;
      }

      body = Buffer.from(html, "utf8");

      // The app may only reach its own data endpoint. Keeping connect-src
      // narrower than 'self' stops generated code from calling other
      // platform APIs with the user's session.
      // Use the origin the browser actually used. `request.url` can be
      // normalized to localhost by the dev server, which then blocks the
      // bridge when the page is opened through 127.0.0.1 or another host.
      const origin = `${
        request.headers.get("x-forwarded-proto") ??
        new URL(request.url).protocol.replace(":", "")
      }://${
        request.headers.get("host") ?? new URL(request.url).host
      }`;
      headers["Content-Security-Policy"] =
        `default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src ${origin}/api/projects/${id}/db; form-action 'none'; base-uri 'none'`;
    }

    headers["Content-Length"] = String(body.byteLength);

    return new Response(body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
