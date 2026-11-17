import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";

export const DESIGN_FILE = "design.md";

export function getDesignSystemSource(): string {
  return path.join(process.cwd(), "design", "clean-soft.md");
}

async function readDesignSystem(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function installDesignSystem(
  workspaceDir: string,
): Promise<string> {
  const source = getDesignSystemSource();
  const target = path.join(workspaceDir, DESIGN_FILE);

  await copyFile(source, target);
  return readDesignSystem(target);
}

export async function readWorkspaceDesignSystem(
  workspaceDir: string,
): Promise<string | undefined> {
  try {
    const content = await readDesignSystem(
      path.join(workspaceDir, DESIGN_FILE),
    );

    return content.trim() ? content : undefined;
  } catch {
    return undefined;
  }
}
