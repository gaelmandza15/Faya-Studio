import { stat } from "node:fs/promises";
import path from "node:path";
import { auditUiQuality } from "../src/engine/ui-audit";
import { getWorkspacesRoot } from "../src/engine/workspace";

async function resolveTarget(input: string): Promise<string> {
  if (path.isAbsolute(input)) return input;

  const direct = path.resolve(process.cwd(), input);

  try {
    const info = await stat(direct);
    if (info.isDirectory()) return direct;
  } catch {
    // Fall back to a workspace id below.
  }

  return path.join(getWorkspacesRoot(), input);
}

async function main() {
  const inputs = process.argv.slice(2);

  if (inputs.length === 0) {
    console.error(
      "Usage: npm run ui:audit -- <workspace-id-or-path> [more...]",
    );
    process.exitCode = 1;
    return;
  }

  let blockers = 0;
  let majors = 0;

  for (const input of inputs) {
    const root = await resolveTarget(input);
    const findings = await auditUiQuality(root);

    console.log(`\n=== ${root} ===`);

    if (findings.length === 0) {
      console.log("No structural UI finding.");
      continue;
    }

    for (const item of findings) {
      if (item.severity === "blocker") blockers += 1;
      if (item.severity === "major") majors += 1;
      console.log(
        `[${item.severity}] ${item.rule} (${item.file})\n  ${item.message}`,
      );
    }
  }

  console.log(
    `\nSummary: ${blockers} blocker(s), ${majors} major finding(s).`,
  );
  console.log(
    "Static audit only: complete the interaction checklist in src/engine/ui-quality.ts.",
  );

  if (blockers > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
