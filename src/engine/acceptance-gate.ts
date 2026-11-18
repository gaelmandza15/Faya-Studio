import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  parseAcceptanceReport,
  type AcceptanceOutcome,
} from "./acceptance";

export type AcceptanceGateResult = {
  outcome: AcceptanceOutcome;
  exitCode: number | null;
  output: string;
};

export interface AcceptanceGateOptions {
  projectId: string;
  /** Absolute path to the generated workspace. */
  workspaceDir: string;
  /** Platform base URL. When omitted, the runner stays in static mode. */
  baseUrl?: string;
  /** Short-lived session token for the platform mode. */
  token?: string;
  organizationId?: string;
  /** Throwaway database used by the acceptance run. */
  sandbox?: string;
  timeoutMs?: number;
}

function tail(value: string, size = 1200): string {
  return value.length > size ? value.slice(-size) : value;
}

export function resolveAcceptanceBaseUrl(): string {
  const configured =
    process.env.FAYA_ACCEPTANCE_URL ??
    process.env.FAYA_PLATFORM_URL ??
    `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

  return configured.replace(/\/+$/, "");
}

/**
 * The acceptance gate needs the platform server to exercise the real Web
 * Bridge. When it cannot be reached (worker on another host, server down in
 * local development), callers should fall back to the static runner.
 */
export async function isPlatformReachable(
  baseUrl: string,
  timeoutMs = 2500,
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function runAcceptanceGate(
  options: AcceptanceGateOptions,
): Promise<AcceptanceGateResult> {
  const tsxCli = path.join(
    process.cwd(),
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs",
  );
  const script = path.join(process.cwd(), "scripts", "run-acceptance.ts");
  const outPath = path.join(
    options.workspaceDir,
    ".faya",
    "acceptance",
    `${Date.now()}-${process.pid}.json`,
  );

  await rm(outPath, { force: true });

  const args = [
    tsxCli,
    script,
    "--project",
    options.projectId,
    "--workspace",
    options.workspaceDir,
    "--out",
    outPath,
  ];

  if (options.baseUrl && options.token) {
    args.push("--base-url", options.baseUrl, "--mode", "platform");

    if (options.organizationId) {
      args.push("--org", options.organizationId);
    }

    if (options.sandbox) {
      args.push("--sandbox", options.sandbox);
    }
  }

  // The session token is passed through the environment, not argv, so it does
  // not appear in the process list.
  const env = options.token
    ? { ...process.env, FAYA_ACCEPTANCE_TOKEN: options.token }
    : process.env;

  const timeoutMs = options.timeoutMs ?? 3 * 60 * 1000;

  return new Promise<AcceptanceGateResult>((resolve) => {
    let output = "";
    let settled = false;
    let timedOut = false;

    const finish = async (
      exitCode: number | null,
      spawnError?: Error,
    ) => {
      if (settled) return;
      settled = true;

      if (spawnError) {
        resolve({
          outcome: {
            status: "skipped",
            reason: `acceptance-spawn-failed: ${spawnError.message}`,
          },
          exitCode: null,
          output: tail(output),
        });
        return;
      }

      if (timedOut) {
        resolve({
          outcome: { status: "skipped", reason: "acceptance-timeout" },
          exitCode,
          output: tail(output),
        });
        return;
      }

      let raw: string | null = null;
      try {
        raw = await readFile(outPath, "utf8");
      } catch {
        // The runner writes the report at the end, even on flow failure.
      }

      if (raw) {
        try {
          const report = parseAcceptanceReport(JSON.parse(raw));
          if (report) {
            resolve({
              outcome: {
                status: report.ok ? "passed" : "failed",
                report,
              },
              exitCode,
              output: tail(output),
            });
            return;
          }
        } catch {
          // Fall through to the exit-code mapping below.
        }
      }

      if (exitCode === 3) {
        resolve({
          outcome: { status: "skipped", reason: "missing-acceptance-plan" },
          exitCode,
          output: tail(output),
        });
        return;
      }

      if (exitCode === 4) {
        resolve({
          outcome: { status: "skipped", reason: "chromium-unavailable" },
          exitCode,
          output: tail(output),
        });
        return;
      }

      resolve({
        outcome: {
          status: "skipped",
          reason: `acceptance-runner-error: ${tail(output, 400) || "no output"}`,
        },
        exitCode,
        output: tail(output),
      });
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(process.execPath, args, {
        cwd: process.cwd(),
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      void finish(null, error instanceof Error ? error : new Error(String(error)));
      return;
    }

    child.stdout?.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output += String(chunk);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      void finish(null, error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      void finish(code);
    });
  });
}
