import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AppLinkRuntimeInput {
  frontendDir: string;
  project: { id: string; appKey: string; syncEnabled: boolean };
  hooks: boolean;
  platformUrl?: string;
  runtimeSourceDir?: string;
}

/**
 * Adds the sync/webhook runtime and its configuration to an exported
 * application's frontend before the Tauri build.
 */
export async function installAppLinkRuntime(
  input: AppLinkRuntimeInput,
): Promise<void> {
  const sourceDir =
    input.runtimeSourceDir ??
    path.join(process.cwd(), "templates", "faya-runtime");
  const runtimeSource = path.join(sourceDir, "faya-sync.js");
  const indexPath = path.join(input.frontendDir, "index.html");
  const html = await readFile(indexPath, "utf8");

  await copyFile(runtimeSource, path.join(input.frontendDir, "faya-sync.js"));

  const baseUrl =
    input.platformUrl ??
    process.env.FAYA_PLATFORM_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const config = {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    projectId: input.project.id,
    appKey: input.project.appKey,
    sync: input.project.syncEnabled,
    hooks: input.hooks,
    locale: "fr",
    appVersion: "1.0.0",
    showBadge: true,
  };
  const serialized = JSON.stringify(config).replace(/</g, "\\u003c");

  await writeFile(
    path.join(input.frontendDir, "faya-config.js"),
    `window.FAYA_CONFIG = ${serialized};\n`,
    "utf8",
  );

  if (html.includes("faya-sync.js")) {
    return;
  }

  const tags =
    '<script src="faya-config.js"></script>\n    <script src="faya-sync.js" defer></script>';
  const injected = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `  ${tags}\n  </body>`)
    : `${html}\n${tags}\n`;

  await writeFile(indexPath, injected, "utf8");
}
