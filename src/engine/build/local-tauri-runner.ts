import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  BuildRunner,
  TauriBuildInput,
  TauriBuildResult,
} from "./types";

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const LOG_TAIL = 40_000;

export class LocalTauriRunner implements BuildRunner {
  readonly name = "local";

  async buildTauriApp(
    input: TauriBuildInput,
  ): Promise<TauriBuildResult> {
    const startedAt = Date.now();
    const targetDir = resolveCargoTargetDir(input.workspaceDir);
    const buildDir = path.join(input.workspaceDir, ".build");
    await mkdir(buildDir, { recursive: true });

    const logPath = path.join(buildDir, "build.log");
    const logStream = createWriteStream(logPath, { flags: "w" });
    let log = "";

    const append = (chunk: unknown) => {
      const text = String(chunk);
      logStream.write(text);
      log += text;

      if (log.length > LOG_TAIL) {
        log = log.slice(-LOG_TAIL);
      }
    };

    const closeLog = () =>
      new Promise<void>((resolve) => logStream.end(() => resolve()));

    try {
      if (!input.appName.trim()) {
        throw new Error("The application name is required.");
      }

      if (!/^[a-zA-Z0-9.-]+$/.test(input.identifier)) {
        throw new Error("The application identifier is invalid.");
      }

      const configPath = path.join(
        input.workspaceDir,
        "src-tauri",
        "tauri.conf.json",
      );
      const config = JSON.parse(
        await readFile(configPath, "utf8"),
      ) as {
        productName?: string;
        identifier?: string;
        app?: { windows?: Array<{ title?: string }> };
      };

      config.productName = input.appName;
      config.identifier = input.identifier;

      if (config.app?.windows?.[0]) {
        config.app.windows[0].title = input.appName;
      }

      await writeFile(
        configPath,
        `${JSON.stringify(config, null, 2)}\n`,
        "utf8",
      );

      const cliPath =
        process.env.TAURI_CLI_JS ??
        path.join(
          process.cwd(),
          "node_modules",
          "@tauri-apps",
          "cli",
          "tauri.js",
        );

      append(
        `[build] Tauri CLI: ${cliPath}\n[build] Workspace: ${input.workspaceDir}\n[build] Cargo target: ${targetDir}\n`,
      );

      const child = spawn(
        process.execPath,
        [cliPath, "build", "--no-bundle"],
        {
          cwd: input.workspaceDir,
          env: {
            ...process.env,
            CARGO_TERM_COLOR: "never",
            FORCE_COLOR: "0",
            CARGO_TARGET_DIR: targetDir,
          },
          windowsHide: true,
        },
      );

      child.stdout.on("data", append);
      child.stderr.on("data", append);

      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        append("\n[build] Timeout reached; stopping the build.\n");
        child.kill();
      }, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

      const exitCode = await new Promise<number | null>(
        (resolve, reject) => {
          child.on("error", reject);
          child.on("close", resolve);
        },
      )
        .catch((error) => {
          append(`\n[build] Spawn failed: ${String(error)}\n`);
          return null;
        })
        .finally(() => clearTimeout(timeout));

      const ok = exitCode === 0 && !timedOut;
      const binaryPath = ok
        ? await findReleaseBinary(targetDir)
        : undefined;

      return {
        ok: ok && Boolean(binaryPath),
        exitCode,
        log,
        binaryPath,
        durationMs: Date.now() - startedAt,
        error:
          ok && binaryPath
            ? undefined
            : timedOut
              ? "Tauri build timed out."
              : !binaryPath
                ? "Build completed but no executable was found."
                : "Tauri build failed.",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      append(`\n[build] ${message}\n`);

      return {
        ok: false,
        exitCode: null,
        log,
        durationMs: Date.now() - startedAt,
        error: message,
      };
    } finally {
      await closeLog();
    }
  }
}

function resolveCargoTargetDir(workspaceDir: string): string {
  const shared = process.env.FAYA_TAURI_TARGET_DIR;

  if (shared) {
    return path.isAbsolute(shared)
      ? shared
      : path.resolve(process.cwd(), shared);
  }

  return path.join(workspaceDir, "src-tauri", "target");
}

async function findReleaseBinary(
  targetDir: string,
): Promise<string | undefined> {
  const releaseDir = path.join(targetDir, "release");

  let entries;

  try {
    entries = await readdir(releaseDir, { withFileTypes: true });
  } catch {
    return undefined;
  }

  const candidates: Array<{
    path: string;
    size: number;
    modifiedAt: number;
  }> = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".exe")) continue;

    const filePath = path.join(releaseDir, entry.name);
    const info = await stat(filePath);

    candidates.push({
      path: filePath,
      size: info.size,
      modifiedAt: info.mtimeMs,
    });
  }

  candidates.sort((a, b) => b.modifiedAt - a.modifiedAt);
  return candidates[0]?.path;
}
