import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  defineTool,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  resolveInsideWorkspace,
  writeWorkspaceFile,
} from "./workspace";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT = 20_000;

export interface WorkspaceCheck {
  ok: boolean;
  report: string;
}

function truncate(value: string, max = MAX_OUTPUT): string {
  return value.length > max ? `${value.slice(0, max)}\n… (truncated)` : value;
}

export async function validateWorkspace(
  root: string,
): Promise<WorkspaceCheck> {
  const errors: string[] = [];
  const notes: string[] = [];
  let html: string;

  try {
    html = await readFile(path.join(root, "index.html"), "utf8");
  } catch {
    return {
      ok: false,
      report:
        "CHECK FAILED\nindex.html is missing. Create a complete index.html at the workspace root.",
    };
  }

  if (!/<!doctype html>/i.test(html)) {
    errors.push("index.html must start with <!DOCTYPE html>.");
  }
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    errors.push("index.html must contain a complete <html> element.");
  }
  if (!/<body[\s>]/i.test(html) || !/<\/body>/i.test(html)) {
    errors.push("index.html must contain a complete <body> element.");
  }
  if (!/<title>[\s\S]*?<\/title>/i.test(html)) {
    errors.push("index.html must contain a <title>.");
  }

  const references = Array.from(
    html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi),
  ).map((match) => match[1]);

  for (const reference of references) {
    if (
      /^(https?:)?\/\//i.test(reference) ||
      reference.startsWith("#") ||
      reference.startsWith("data:") ||
      reference.startsWith("mailto:") ||
      reference.startsWith("tel:") ||
      reference.startsWith("javascript:")
    ) {
      continue;
    }

    const cleaned = reference.split("?")[0].split("#")[0];
    if (!cleaned) continue;

    try {
      const absolute = resolveInsideWorkspace(root, cleaned);
      const info = await stat(absolute);
      if (!info.isFile()) {
        errors.push(`Local asset is not a file: ${cleaned}`);
      }
    } catch {
      errors.push(`Missing local asset: ${cleaned}`);
    }
  }

  const files = await listWorkspaceFiles(root, 6);
  const scriptFiles = files.filter((file) =>
    /\.(js|mjs)$/i.test(file.path),
  );

  for (const file of scriptFiles) {
    try {
      await execFileAsync(
        process.execPath,
        ["--check", path.join(root, file.path)],
        { timeout: 5000, windowsHide: true },
      );
      notes.push(`JS syntax OK: ${file.path}`);
    } catch (error) {
      const stderr =
        (error as { stderr?: string }).stderr ??
        (error as Error).message;
      errors.push(
        `JS syntax error in ${file.path}:\n${stderr.slice(0, 2000)}`,
      );
    }
  }

  const fileList =
    files
      .map((file) => `- ${file.path} (${file.size} bytes)`)
      .join("\n") || "(empty workspace)";

  const report = [
    errors.length === 0 ? "CHECK PASSED" : "CHECK FAILED",
    ...notes,
    ...errors,
    "",
    "Files:",
    fileList,
  ].join("\n");

  return { ok: errors.length === 0, report: truncate(report) };
}

export function createWorkspaceTools(root: string) {
  const listFiles = defineTool({
    name: "list_files",
    label: "List workspace files",
    description:
      "List the files currently present in the workspace, with their sizes.",
    promptSnippet:
      "List the current workspace files before writing or editing.",
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({
          description:
            "Relative file or folder path. Defaults to the workspace root.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const target = resolveInsideWorkspace(root, params.path ?? ".");
      const info = await stat(target);

      if (info.isFile()) {
        return {
          content: [
            {
              type: "text",
              text: `${params.path ?? "."} (${info.size} bytes)`,
            },
          ],
          details: {},
        };
      }

      const files = await listWorkspaceFiles(root);
      const text =
        files
          .map((file) => `${file.path} (${file.size} bytes)`)
          .join("\n") || "(empty workspace)";

      return {
        content: [{ type: "text", text: truncate(text) }],
        details: {},
      };
    },
  });

  const readFile = defineTool({
    name: "read_file",
    label: "Read a workspace file",
    description:
      "Read a UTF-8 text file from the workspace. Paths must stay inside the workspace.",
    promptSnippet:
      "Read an existing workspace file before modifying it.",
    parameters: Type.Object({
      path: Type.String({
        description: "Relative path of the file to read.",
      }),
    }),
    async execute(_toolCallId, params) {
      const content = await readWorkspaceFile(root, params.path);
      return {
        content: [{ type: "text", text: truncate(content) }],
        details: {},
      };
    },
  });

  const writeFile = defineTool({
    name: "write_file",
    label: "Write a workspace file",
    description:
      "Create or overwrite a UTF-8 text file in the workspace. Use this for index.html, styles.css and app.js.",
    promptSnippet:
      "Write or overwrite files in the workspace with complete file contents.",
    promptGuidelines: [
      "Use write_file for every file creation or modification.",
      "Use write_file only with relative paths inside the workspace.",
      "Write complete files; do not rely on a shell or package manager.",
    ],
    parameters: Type.Object({
      path: Type.String({
        description: "Relative path of the file to write.",
      }),
      content: Type.String({
        description: "Complete UTF-8 content of the file.",
      }),
    }),
    async execute(_toolCallId, params) {
      const absolute = resolveInsideWorkspace(root, params.path);

      return withFileMutationQueue(absolute, async () => {
        const bytes = await writeWorkspaceFile(
          root,
          params.path,
          params.content,
        );

        return {
          content: [
            {
              type: "text",
              text: `Wrote ${params.path} (${bytes} bytes).`,
            },
          ],
          details: {},
        };
      });
    },
  });

  const runChecks = defineTool({
    name: "run_checks",
    label: "Validate the generated app",
    description:
      "Validate index.html, local asset references and JavaScript syntax. Returns CHECK PASSED or CHECK FAILED with actionable errors.",
    promptSnippet:
      "Validate the generated app after writing files and fix any reported errors.",
    promptGuidelines: [
      "Use run_checks after writing files and after every fix.",
      "Do not call finish while run_checks reports CHECK FAILED.",
    ],
    parameters: Type.Object({}),
    async execute() {
      const check = await validateWorkspace(root);

      return {
        content: [{ type: "text", text: check.report }],
        details: { ok: check.ok },
        isError: !check.ok,
      };
    },
  });

  const finish = defineTool({
    name: "finish",
    label: "Finish generation",
    description:
      "Call this only when the application is complete and run_checks passes. Provide a short summary of what was built.",
    promptSnippet:
      "Finish the generation with a short summary once checks pass.",
    promptGuidelines: [
      "Call finish only after run_checks reports CHECK PASSED.",
    ],
    parameters: Type.Object({
      summary: Type.String({
        description:
          "Short user-facing summary of the generated application.",
      }),
    }),
    async execute(_toolCallId, params) {
      return {
        content: [
          {
            type: "text",
            text: `Application complete: ${params.summary}`,
          },
        ],
        details: {},
        terminate: true,
      };
    },
  });

  return [listFiles, readFile, writeFile, runChecks, finish];
}
