import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { spawn } from "node:child_process";
import {
  copyFile,
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { getBuildRunner } from "../src/engine/build";
import { installAppLinkRuntime } from "../src/engine/app-link-runtime";
import { getWorkspacesRoot } from "../src/engine/workspace";
import { refundCredits } from "../src/engine/credits";
import { CREDIT_REFUND_REASONS } from "../src/lib/credit-costs";

const prisma = new PrismaClient();

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function safeArtifactName(projectName: string): string {
  const base = projectName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "application"}.exe`;
}

function appIdentifier(projectId: string): string {
  return `studio.faya.${projectId.toLowerCase()}`;
}

function copyFilter(root: string, excluded: string[]) {
  return (source: string) => {
    const relative = path
      .relative(root, source)
      .split(path.sep)
      .join("/");

    return !excluded.some(
      (entry) => relative === entry || relative.startsWith(`${entry}/`),
    );
  };
}

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
  const projectId = getArg("--project");
  const jobId = getArg("--job");

  if (!projectId || !jobId) {
    throw new Error("Missing --project or --job argument.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const enabledWebhooks = await prisma.webhookEndpoint.count({
    where: { projectId, enabled: true },
  });

  const job = await prisma.buildJob.findUnique({
    where: { id: jobId },
    select: { projectId: true, creditTransactionId: true },
  });

  if (!job || job.projectId !== projectId) {
    throw new Error(`Build job not found: ${jobId}`);
  }

  const latestVersion = await prisma.projectVersion.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  await prisma.buildJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      error: null,
      versionNumber: latestVersion?.number ?? null,
    },
  });

  const root = getWorkspacesRoot();
  const workspaceDir = path.join(root, projectId);
  const templateDir = path.join(
    process.cwd(),
    "templates",
    "tauri-v2-sqlite",
  );
  const buildDir = path.join(root, ".build-jobs", jobId);
  const logsDir = path.join(root, ".logs");
  const buildLogCopy = path.join(logsDir, `${jobId}-build.log`);
  const artifactsDir = path.join(root, ".artifacts", jobId);

  process.env.FAYA_TAURI_TARGET_DIR ??= path.join(
    root,
    ".build-cache",
    "cargo-target",
  );

  await mkdir(logsDir, { recursive: true });

  try {
    const index = await stat(path.join(workspaceDir, "index.html"));

    if (!index.isFile()) {
      throw new Error("The generated application has no index.html.");
    }

    await rm(buildDir, { recursive: true, force: true });
    await mkdir(buildDir, { recursive: true });

    await cp(templateDir, buildDir, {
      recursive: true,
      filter: copyFilter(templateDir, [
        "node_modules",
        "src-tauri/target",
        "src-tauri/gen",
        ".git",
      ]),
    });

    const frontendDir = path.join(buildDir, "src");
    await rm(frontendDir, { recursive: true, force: true });
    await mkdir(frontendDir, { recursive: true });

    await cp(workspaceDir, frontendDir, {
      recursive: true,
      filter: copyFilter(workspaceDir, [
        ".faya",
        ".build",
        ".git",
        "node_modules",
        "desktop-schema.sql",
        "design.md",
      ]),
    });

    const schemaCandidates = [
      path.join(workspaceDir, "desktop-schema.sql"),
      path.join(workspaceDir, ".faya", "desktop-schema.sql"),
    ];
    let schemaOverride: string | undefined;

    for (const candidate of schemaCandidates) {
      try {
        const content = await readFile(candidate, "utf8");

        if (content.trim()) {
          schemaOverride = content;
          break;
        }
      } catch {
        // Try the next location.
      }
    }

    if (schemaOverride) {
      await writeFile(
        path.join(buildDir, "src-tauri", "migrations", "schema.sql"),
        schemaOverride,
        "utf8",
      );
    }

    if (project.appKey && (project.syncEnabled || enabledWebhooks > 0)) {
      await installAppLinkRuntime({
        frontendDir,
        project: {
          id: project.id,
          appKey: project.appKey,
          syncEnabled: project.syncEnabled,
        },
        hooks: enabledWebhooks > 0,
      });
    }

    const runner = getBuildRunner();
    const result = await runner.buildTauriApp({
      workspaceDir: buildDir,
      appName: project.name,
      identifier: appIdentifier(projectId),
    });

    await writeFile(buildLogCopy, result.log, "utf8").catch(
      () => undefined,
    );

    if (!result.ok || !result.binaryPath) {
      throw new Error(
        result.error ??
          "The desktop build failed. Check the build log for details.",
      );
    }

    const binaryInfo = await stat(result.binaryPath);
    const artifactName = safeArtifactName(project.name);
    await mkdir(artifactsDir, { recursive: true });

    const artifactPath = path.join(artifactsDir, artifactName);
    await copyFile(result.binaryPath, artifactPath);

    const selfTestExitCode = await runSelfTest(artifactPath).catch(
      () => null,
    );

    if (selfTestExitCode !== 0) {
      throw new Error(
        `The exported application failed its SQLite self-test (exit ${selfTestExitCode}).`,
      );
    }

    await prisma.buildJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        error: null,
        artifactPath,
        artifactName,
        artifactSize: binaryInfo.size,
        durationMs: result.durationMs,
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { lastActivityAt: new Date() },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    await prisma.buildJob
      .update({
        where: { id: jobId },
        data: { status: "error", error: message.slice(0, 2000) },
      })
      .catch(() => undefined);

    if (job.creditTransactionId) {
      await refundCredits(prisma, {
        transactionId: job.creditTransactionId,
        reason: CREDIT_REFUND_REASONS.build,
      });
    }
  } finally {
    await rm(buildDir, { recursive: true, force: true }).catch(
      () => undefined,
    );
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
