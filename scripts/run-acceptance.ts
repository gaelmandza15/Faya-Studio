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
  type AcceptanceLocator,
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
      await locator.first().waitFor({ state: "visible", timeout: 5000 });
      await locator.first().click();
      return;
    }
    case "fill": {
      const locator = locatorFor(page, step.locator);
      await locator.first().waitFor({ state: "visible", timeout: 5000 });
      await locator.first().fill(step.value);
      return;
    }
    case "select": {
      const locator = locatorFor(page, step.locator);
      await locator.first().waitFor({ state: "visible", timeout: 5000 });
      await locator.first().selectOption(step.value);
      return;
    }
    case "press":
      await page.keyboard.press(step.key);
      return;
    case "expectText": {
      const locator = page.getByText(step.text, { exact: step.exact });
      await locator.first().waitFor({ state: "visible", timeout: 5000 });
      return;
    }
    case "expectHidden": {
      const locator = page.getByText(step.text);
      if ((await locator.count()) > 0) {
        await locator.first().waitFor({ state: "hidden", timeout: 5000 });
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

async function main() {
  const projectId =
    getArg("--project") ?? getArg("--workspace") ?? process.argv[2];
  if (!projectId) {
    console.error("Usage: tsx scripts/run-acceptance.ts --project <id>");
    process.exitCode = 2;
    return;
  }

  const direct = path.resolve(projectId);
  const directIsDir = await stat(direct)
    .then((info) => info.isDirectory())
    .catch(() => false);
  const root =
    path.isAbsolute(projectId) || directIsDir
      ? direct
      : path.join(getWorkspacesRoot(), projectId);
  const parsed = await readAcceptancePlan(root);

  if (!parsed.ok) {
    console.error(
      `[acceptance] Invalid plan: ${parsed.errors.join(" ")}`,
    );
    process.exitCode = 3;
    return;
  }

  const server = await startServer(root);
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : 0;
  const baseURL = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const results: Array<{
    name: string;
    ok: boolean;
    failedStep?: number;
    error?: string;
  }> = [];
  const consoleErrors: string[] = [];

  try {
    for (const flow of parsed.plan.flows) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();

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
        await page.goto(baseURL, { waitUntil: "domcontentloaded" });
        for (let index = 0; index < flow.steps.length; index += 1) {
          await runStep(page, flow.steps[index]);
        }
        results.push({ name: flow.name, ok: true });
      } catch (error) {
        results.push({
          name: flow.name,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const report = {
    ok: results.every((flow) => flow.ok),
    generatedAt: new Date().toISOString(),
    flows: results,
    consoleErrors: consoleErrors.slice(0, 20),
  };

  const fayaDir = path.join(root, ".faya");
  await mkdir(fayaDir, { recursive: true });
  await writeFile(
    path.join(fayaDir, "acceptance-results.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
