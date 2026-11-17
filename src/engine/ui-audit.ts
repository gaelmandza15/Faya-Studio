import { readFile } from "node:fs/promises";
import path from "node:path";
import { listWorkspaceFiles } from "./workspace";

export type UiFindingSeverity = "blocker" | "major" | "minor";

export interface UiAuditFinding {
  rule: string;
  severity: UiFindingSeverity;
  file: string;
  message: string;
}

const TEXT_FILE = /\.(html|css|js|mjs)$/i;
const MAX_FILE_BYTES = 1_500_000;

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function finding(
  rule: string,
  severity: UiFindingSeverity,
  file: string,
  message: string,
): UiAuditFinding {
  return { rule, severity, file, message };
}

function auditHtml(html: string, file: string): UiAuditFinding[] {
  const findings: UiAuditFinding[] = [];
  const ids = new Map<string, number>();

  for (const match of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    ids.set(match[1], (ids.get(match[1]) ?? 0) + 1);
  }

  for (const [id, count] of ids) {
    if (count > 1) {
      findings.push(
        finding(
          "duplicate-id",
          "blocker",
          file,
          `id="${id}" appears ${count} times. Browsers keep only the first one, so aria-controls, labels and lookups can target the wrong element.`,
        ),
      );
    }
  }

  const known = new Set(ids.keys());
  const referenceAttributes =
    /(aria-controls|aria-labelledby|aria-describedby|for|list|form)\s*=\s*["']([^"']+)["']/gi;

  for (const match of html.matchAll(referenceAttributes)) {
    const attribute = match[1];
    const values = match[2].split(/\s+/).filter(Boolean);

    for (const value of values) {
      if (!known.has(value)) {
        findings.push(
          finding(
            "broken-id-reference",
            "blocker",
            file,
            `${attribute}="${value}" points to an element that does not exist. The panel/menu/label it controls may never open or be announced.`,
          ),
        );
      }
    }
  }

  const buttons = html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi);

  for (const match of buttons) {
    const attributes = match[1];
    const content = stripTags(match[2]);
    const hasName =
      /\baria-label\s*=/i.test(attributes) ||
      /\baria-labelledby\s*=/i.test(attributes) ||
      /\btitle\s*=/i.test(attributes);

    if (!content && !hasName) {
      findings.push(
        finding(
          "icon-button-name",
          "major",
          file,
          `An icon-only <button> has no text, aria-label or title: ${attributes.trim().slice(0, 80)}`,
        ),
      );
    }
  }

  for (const form of html.matchAll(/<form\b[\s\S]*?<\/form>/gi)) {
    for (const button of form[0].matchAll(/<button\b([^>]*)>/gi)) {
      if (!/\btype\s*=/i.test(button[1])) {
        findings.push(
          finding(
            "button-default-submit",
            "blocker",
            file,
            "A <button> inside a form has no type attribute; it defaults to submit and can trigger the form unexpectedly. Use type=\"button\" for non-submit actions.",
          ),
        );
      }
    }
  }

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt\s*=/i.test(match[1])) {
      findings.push(
        finding(
          "image-alt",
          "major",
          file,
          "<img> is missing alt text. Use alt=\"\" for decorative images.",
        ),
      );
    }
  }

  for (const match of html.matchAll(/<a\b([^>]*)>/gi)) {
    if (/href\s*=\s*["']#["']/i.test(match[1])) {
      findings.push(
        finding(
          "dead-link",
          "minor",
          file,
          'A link uses href="#" and may jump to the top or do nothing. Use a button for actions.',
        ),
      );
    }
  }

  if (/onclick\s*=\s*(["'])\s*\1/gi.test(html)) {
    findings.push(
      finding(
        "empty-handler",
        "major",
        file,
        "An onclick handler is empty.",
      ),
    );
  }

  const visible = stripScriptsAndStyles(html);

  if (/\b(lorem ipsum|TODO|FIXME)\b/i.test(visible)) {
    findings.push(
      finding(
        "placeholder-copy",
        "minor",
        file,
        "Visible placeholder copy remains (Lorem ipsum / TODO / FIXME).",
      ),
    );
  }

  return findings;
}

function auditCss(css: string, file: string): UiAuditFinding[] {
  const findings: UiAuditFinding[] = [];

  if (
    /outline\s*:\s*(none|0)\b/i.test(css) &&
    !/:focus-visible/i.test(css)
  ) {
    findings.push(
      finding(
        "focus-style",
        "major",
        file,
        "outline is removed without any :focus-visible replacement; keyboard users lose the focus indicator.",
      ),
    );
  }

  return findings;
}

/**
 * Static, high-signal UI quality audit. It cannot click through the app, but it
 * catches structural mistakes that cause the most common finishing bugs.
 */
export async function auditUiQuality(root: string): Promise<UiAuditFinding[]> {
  const files = await listWorkspaceFiles(root, 6);
  const findings: UiAuditFinding[] = [];

  for (const file of files) {
    if (!TEXT_FILE.test(file.path) || file.size > MAX_FILE_BYTES) continue;

    const absolute = path.join(root, file.path);
    const content = await readFile(absolute, "utf8").catch(() => "");

    if (!content) continue;

    if (/\.html$/i.test(file.path)) {
      findings.push(...auditHtml(content, file.path));
    } else if (/\.css$/i.test(file.path)) {
      findings.push(...auditCss(content, file.path));
    }
  }

  return findings.slice(0, 40);
}

export function formatUiFindings(findings: UiAuditFinding[]): string[] {
  return findings.map(
    (item) =>
      `UI QUALITY [${item.severity}] ${item.rule} (${item.file}): ${item.message}`,
  );
}
