import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { getBuildRunner } from "../src/engine/build";

async function runSelfTest(binaryPath: string): Promise<number | null> {
  return new Promise<number | null>((resolve, reject) => {
    const child = spawn(binaryPath, ["--self-test"], {
      windowsHide: true,
      stdio: "ignore",
    });

    child.on("error", reject);
    child.on("close", resolve);
  });
}

async function main() {
  const workspaceDir = path.join(
    process.cwd(),
    "workspaces",
    `tauri-proof-${randomUUID()}`,
  );
  const templateDir = path.join(
    process.cwd(),
    "templates",
    "tauri-v2-sqlite",
  );

  await mkdir(workspaceDir, { recursive: true });

  await cp(templateDir, workspaceDir, {
    recursive: true,
    filter(source) {
      const relative = path
        .relative(templateDir, source)
        .split(path.sep)
        .join("/");

      return (
        !relative.startsWith("node_modules") &&
        !relative.startsWith("src-tauri/target") &&
        !relative.startsWith("src-tauri/gen") &&
        !relative.startsWith(".git")
      );
    },
  });

  console.log(`Tauri proof workspace: ${workspaceDir}`);

  const runner = getBuildRunner();
  const result = await runner.buildTauriApp({
    workspaceDir,
    appName: "Carnet de contacts",
    identifier: "app.faya.carnet",
  });

  console.log(`Build status: ${result.ok ? "OK" : "FAILED"}`);
  console.log(`Duration: ${Math.round(result.durationMs / 1000)}s`);
  console.log(`Binary: ${result.binaryPath ?? "(none)"}`);

  if (!result.ok) {
    console.error(result.error);
    console.error(result.log.slice(-4000));
    process.exitCode = 1;
    return;
  }

  const selfTestExitCode = await runSelfTest(result.binaryPath!);
  console.log(`SQLite self-test exit code: ${selfTestExitCode}`);

  if (selfTestExitCode !== 0) {
    process.exitCode = 1;
    return;
  }

  console.log("TAURI_PROOF_OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
