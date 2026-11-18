import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";
import {
  readAcceptancePlan,
  type AcceptanceFlowResult,
  type AcceptanceLocator,
  type AcceptanceMode,
  type AcceptanceReport,
  type AcceptanceStep,
} from "../src/engine/acceptance";
import { getWorkspacesRoot } from "../src/engine/workspace";

const MIME: Record<string, string> = {
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

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function startServer(root: string): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer(async (request, response) => {
      try {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
        const candidate = relative || "index.html";
        const absolute = path.resolve(root, candidate);

        if (!absolute.startsWith(path.resolve(root))) {
          response.writeHead(403).end("Forbidden");
          return;
        }

        const info = await stat(absolute);
        const file = info.isDirectory()
          ? path.join(absolute, "index.html")
          : absolute;
        const finalInfo = info.isDirectory() ? await stat(file) : info;

        if (!finalInfo.isFile()) {
          response.writeHead(404).end("Not found");
          return;
        }

        response.writeHead(200, {
          "content-type":
            MIME[path.extname(file).toLowerCase()] ??
            "application/octet-stream",
          "cache-control": "no-store",
        });
        createReadStream(file).pipe(response);
      } catch {
        response.writeHead(404).end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function locatorFor(
  page: import("@playwright/test").Page,
  locator: AcceptanceLocator,
  exact?: boolean,
) {
  if (locator.role) {
    return page.getByRole(locator.role as never, {
      name: locator.name,
      exact,
    });
  }
  if (locator.label) return page.getByLabel(locator.label, { exact });
  if (locator.placeholder) {
    return page.getByPlaceholder(locator.placeholder, { exact });
  }
  if (locator.text) return page.getByText(locator.text, { exact });
  return page.locator(locator.selector ?? "body");
}

async function runStep(
  page: import("@playwright/test").Page,
  step: AcceptanceStep,
) {
  switch (step.action) {
    case "click": {
      const locator = locatorFor(page, step.locator, step.exact);
      await locator.first().waitFor({ state: "visible", timeout: 10000 });
      await locator.first().click();
      return;
    }
    case "fill": {
      const locator = locatorFor(page, step.locator);
      await locator.first().waitFor({ state: "visible", timeout: 10000 });
      await locator.first().fill(step.value);
      return;
    }
    case "select": {
      const locator = locatorFor(page, step.locator);
      await locator.first().waitFor({ state: "visible", timeout: 10000 });
      await locator.first().selectOption(step.value);
      return;
    }
    case "press":
      await page.keyboard.press(step.key);
      return;
    case "expectText": {
      const locator = page.getByText(step.text, { exact: step.exact });
      await locator.first().waitFor({ state: "visible", timeout: 10000 });
      return;
    }
    case "expectHidden": {
      const locator = page.getByText(step.text);
      if ((await locator.count()) > 0) {
        await locator.first().waitFor({ state: "hidden", timeout: 10000 });
      }
      return;
    }
    case "reload":
      await page.reload({ waitUntil: "domcontentloaded" });
      return;
    case "wait":
      await page.waitForTimeout(step.ms);
      return;
  }
}

async function writeReport(outPath: string, report: AcceptanceReport) {
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
}

async function main() {
  const projectArg =
    getArg("--project") ?? getArg("--workspace") ?? process.argv[2];
  if (!projectArg) {
    console.error("Usage: tsx scripts/run-acceptance.ts --project <id>");
    process.exitCode = 2;
    return;
  }

  // In platform mode --project is the project id used in the URL, while
  // --workspace points to the generated files. Static mode accepts either.
  const workspaceArg = getArg("--workspace") ?? projectArg;

  const baseUrl = getArg("--base-url")?.replace(/\/+$/, "");
  const mode: AcceptanceMode =
    getArg("--mode") === "platform" || baseUrl ? "platform" : "static";
  const token = getArg("--token") ?? process.env.FAYA_ACCEPTANCE_TOKEN;
  const organizationId = getArg("--org");
  const sandbox = getArg("--sandbox");

  if (mode === "platform" && (!baseUrl || !token)) {
    console.error("Platform mode needs --base-url and --token.");
    process.exitCode = 2;
    return;
  }

  const direct = path.resolve(workspaceArg);
  const directIsDir = await stat(direct)
    .then((info) => info.isDirectory())
    .catch(() => false);
  const root =
    path.isAbsolute(workspaceArg) || directIsDir
      ? direct
      : path.join(getWorkspacesRoot(), workspaceArg);
  const parsed = await readAcceptancePlan(root);

  if (!parsed.ok) {
    console.error(
      `[acceptance] Invalid plan: ${parsed.errors.join(" ")}`,
    );
    process.exitCode = 3;
    return;
  }

  const outPath = getArg("--out")
    ? path.resolve(getArg("--out") as string)
    : path.join(root, ".faya", "acceptance-results.json");

  // Static mode serves the workspace over a throwaway HTTP server. Platform
  // mode exercises the real Web Bridge and the project's SQLite database.
  let server: http.Server | undefined;
  let targetUrl: string;

  if (mode === "platform") {
    const sandboxParam = sandbox
      ? `&_sandbox=${encodeURIComponent(sandbox)}`
      : "";
    targetUrl = `${baseUrl}/api/workspaces/${encodeURIComponent(
      projectArg,
    )}/index.html?_client=acceptance${sandboxParam}`;
  } else {
    server = await startServer(root);
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    targetUrl = `http://127.0.0.1:${port}`;
  }

  const results: AcceptanceFlowResult[] = [];
  const consoleErrors: string[] = [];
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const report: AcceptanceReport = {
      ok: false,
      generatedAt: new Date().toISOString(),
      mode,
      baseUrl,
      flows: [],
      consoleErrors: [],
      error: `Chromium is unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
    await writeReport(outPath, report);
    console.log(JSON.stringify(report, null, 2));
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
    process.exitCode = 4;
    return;
  }

  try {
    for (const flow of parsed.plan.flows) {
      const startedAt = Date.now();
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });

      if (mode === "platform" && token && baseUrl) {
        const cookies = [
          {
            name: "faya_session",
            value: token,
            url: baseUrl,
            httpOnly: true,
            sameSite: "Lax" as const,
          },
        ];

        if (organizationId) {
          cookies.push({
            name: "faya_org",
            value: organizationId,
            url: baseUrl,
            httpOnly: false,
            sameSite: "Lax" as const,
          });
        }

        await context.addCookies(cookies);
      }

      const page = await context.newPage();
      let failedStep: number | undefined;

      page.on("pageerror", (error) =>
        consoleErrors.push(`${flow.name}: ${error.message}`),
      );
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !/favicon|Failed to load resource/i.test(message.text())
        ) {
          consoleErrors.push(`${flow.name}: ${message.text()}`);
        }
      });

      try {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
        if (mode === "platform") {
          await page
            .waitForLoadState("networkidle", { timeout: 8000 })
            .catch(() => undefined);
        }

        for (let index = 0; index < flow.steps.length; index += 1) {
          failedStep = index + 1;
          await runStep(page, flow.steps[index]);
        }
        failedStep = undefined;
        results.push({
          name: flow.name,
          ok: true,
          durationMs: Date.now() - startedAt,
        });
      } catch (error) {
        results.push({
          name: flow.name,
          ok: false,
          failedStep,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startedAt,
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  }

  const report: AcceptanceReport = {
    ok: results.every((flow) => flow.ok),
    generatedAt: new Date().toISOString(),
    mode,
    baseUrl,
    flows: results,
    consoleErrors: consoleErrors.slice(0, 20),
  };

  await writeReport(outPath, report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
