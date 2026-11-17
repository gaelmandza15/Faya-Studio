import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { installAppLinkRuntime } from "../src/engine/app-link-runtime";

async function main() {
  const dir = await mkdtemp(path.join(tmpdir(), "faya-runtime-"));

  await writeFile(
    path.join(dir, "index.html"),
    "<!doctype html><html><body><h1>App</h1></body></html>",
    "utf8",
  );

  await installAppLinkRuntime({
    frontendDir: dir,
    project: {
      id: "project-test",
      appKey: "fs_test",
      syncEnabled: true,
    },
    hooks: true,
    platformUrl: "https://studio.example.com/",
    runtimeSourceDir: path.join(process.cwd(), "templates", "faya-runtime"),
  });

  const html = await readFile(path.join(dir, "index.html"), "utf8");
  const configSource = await readFile(
    path.join(dir, "faya-config.js"),
    "utf8",
  );
  const runtime = await readFile(path.join(dir, "faya-sync.js"), "utf8");

  if (!html.includes('src="faya-config.js"')) {
    throw new Error("config script missing");
  }
  if (!html.includes('src="faya-sync.js"')) {
    throw new Error("sync script missing");
  }
  if (html.indexOf("faya-config.js") > html.indexOf("faya-sync.js")) {
    throw new Error("config must load before the sync engine");
  }
  if (!configSource.includes('"baseUrl":"https://studio.example.com"')) {
    throw new Error("baseUrl not normalized in config");
  }
  if (!configSource.includes('"sync":true') || !configSource.includes('"hooks":true')) {
    throw new Error("sync/hooks flags missing");
  }
  if (runtime.length < 1000) {
    throw new Error("runtime file was not copied");
  }

  // Injection must be idempotent.
  await installAppLinkRuntime({
    frontendDir: dir,
    project: { id: "project-test", appKey: "fs_test", syncEnabled: true },
    hooks: true,
    platformUrl: "https://studio.example.com",
    runtimeSourceDir: path.join(process.cwd(), "templates", "faya-runtime"),
  });

  const secondHtml = await readFile(path.join(dir, "index.html"), "utf8");
  const occurrences = secondHtml.split("faya-sync.js").length - 1;

  if (occurrences !== 1) {
    throw new Error(`expected one injection, found ${occurrences}`);
  }

  await rm(dir, { recursive: true, force: true });
  console.log("APP_LINK_RUNTIME_OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
