import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const ACCEPTANCE_FILE = "acceptance.json";
const MAX_FLOWS = 5;
const MAX_STEPS = 25;

const locatorSchema = z
  .object({
    role: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(200).optional(),
    label: z.string().min(1).max(200).optional(),
    placeholder: z.string().min(1).max(200).optional(),
    text: z.string().min(1).max(300).optional(),
    selector: z.string().min(1).max(300).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        value.role ||
          value.label ||
          value.placeholder ||
          value.text ||
          value.selector,
      ),
    { message: "A locator needs at least one of role, label, placeholder, text or selector." },
  );

const stepSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("click"),
    locator: locatorSchema,
    exact: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("fill"),
    locator: locatorSchema,
    value: z.string().max(2000),
  }),
  z.object({
    action: z.literal("select"),
    locator: locatorSchema,
    value: z.string().max(200),
  }),
  z.object({
    action: z.literal("press"),
    key: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("expectText"),
    text: z.string().min(1).max(300),
    exact: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("expectHidden"),
    text: z.string().min(1).max(300),
  }),
  z.object({
    action: z.literal("reload"),
  }),
  z.object({
    action: z.literal("wait"),
    ms: z.number().int().min(0).max(5000),
  }),
]);

const flowSchema = z.object({
  name: z.string().min(1).max(120),
  steps: z.array(stepSchema).min(1).max(MAX_STEPS),
});

export const acceptancePlanSchema = z.object({
  version: z.literal(1).default(1),
  flows: z.array(flowSchema).min(1).max(MAX_FLOWS),
});

export type AcceptancePlan = z.infer<typeof acceptancePlanSchema>;
export type AcceptanceStep = z.infer<typeof stepSchema>;
export type AcceptanceLocator = z.infer<typeof locatorSchema>;

export const ACCEPTANCE_RESULTS_FILE = "acceptance-results.json";
const MAX_STORED_REPORT_CHARS = 16_000;

export type AcceptanceMode = "platform" | "static";

export type AcceptanceFlowResult = {
  name: string;
  ok: boolean;
  failedStep?: number;
  error?: string;
  durationMs?: number;
};

export type AcceptanceReport = {
  ok: boolean;
  generatedAt: string;
  mode: AcceptanceMode;
  baseUrl?: string;
  flows: AcceptanceFlowResult[];
  consoleErrors: string[];
  error?: string;
};

export type AcceptanceOutcome =
  | { status: "passed"; report: AcceptanceReport }
  | { status: "failed"; report: AcceptanceReport }
  | { status: "skipped"; reason: string };

const flowResultSchema = z.object({
  name: z.string().min(1).max(200),
  ok: z.boolean(),
  failedStep: z.number().int().min(1).optional(),
  error: z.string().max(4000).optional(),
  durationMs: z.number().int().min(0).optional(),
});

const reportSchema = z.object({
  ok: z.boolean(),
  generatedAt: z.string().min(1),
  mode: z.enum(["platform", "static"]).default("static"),
  baseUrl: z.string().max(500).optional(),
  flows: z.array(flowResultSchema).max(20),
  consoleErrors: z.array(z.string().max(1000)).max(50).default([]),
  error: z.string().max(4000).optional(),
});

export function parseAcceptanceReport(value: unknown): AcceptanceReport | null {
  const parsed = reportSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseStoredAcceptanceReport(
  value: string | null,
): AcceptanceReport | null {
  if (!value) return null;

  try {
    return parseAcceptanceReport(JSON.parse(value));
  } catch {
    return null;
  }
}

export function summarizeAcceptanceReport(report: AcceptanceReport): {
  passed: number;
  total: number;
  failed: number;
} {
  const total = report.flows.length;
  const passed = report.flows.filter((flow) => flow.ok).length;
  return { passed, total, failed: total - passed };
}

/** Text handed back to the generation agent when a flow fails. */
export function formatAcceptanceFailure(report: AcceptanceReport): string {
  const lines = [
    `The automatic acceptance run failed (${report.mode} mode, ${report.baseUrl ?? "local"}).`,
    "These flows are executed in the real application with Playwright:",
  ];

  for (const flow of report.flows) {
    if (flow.ok) {
      lines.push(`- PASS "${flow.name}"`);
      continue;
    }

    const step =
      typeof flow.failedStep === "number"
        ? ` at step ${flow.failedStep}`
        : "";
    lines.push(
      `- FAIL "${flow.name}"${step}: ${flow.error ?? "unknown error"}`,
    );
  }

  if (report.consoleErrors.length > 0) {
    lines.push("", "Browser console errors:");
    for (const error of report.consoleErrors.slice(0, 8)) {
      lines.push(`- ${error}`);
    }
  }

  lines.push(
    "",
    "Fix the application so every flow passes. If the failing locator does not",
    "match the real UI because acceptance.json itself is wrong, update",
    "acceptance.json instead. Keep the plan semantic and aligned with the UI,",
    "then call run_checks again. Do not call finish until the plan is correct.",
  );

  return lines.join("\n");
}

export type AcceptanceRecord = {
  acceptanceStatus: "passed" | "failed" | "skipped";
  acceptancePassed: number;
  acceptanceTotal: number;
  acceptanceFailed: number;
  acceptanceRunAt: Date;
  acceptanceError: string | null;
  acceptanceReport: string | null;
};

export function buildAcceptanceRecord(
  outcome: AcceptanceOutcome,
  warning?: string | null,
  now: Date = new Date(),
): AcceptanceRecord {
  if (outcome.status === "skipped") {
    return {
      acceptanceStatus: "skipped",
      acceptancePassed: 0,
      acceptanceTotal: 0,
      acceptanceFailed: 0,
      acceptanceRunAt: now,
      acceptanceError: outcome.reason.slice(0, 1000),
      acceptanceReport: null,
    };
  }

  const summary = summarizeAcceptanceReport(outcome.report);
  const serialized = JSON.stringify(outcome.report);
  const errorParts = outcome.report.error
    ? [outcome.report.error]
    : [];
  if (warning) errorParts.push(warning);

  return {
    acceptanceStatus: outcome.status,
    acceptancePassed: summary.passed,
    acceptanceTotal: summary.total,
    acceptanceFailed: summary.failed,
    acceptanceRunAt: now,
    acceptanceError:
      errorParts.join(" ").slice(0, 1000) || null,
    acceptanceReport:
      serialized.length <= MAX_STORED_REPORT_CHARS
        ? serialized
        : `${serialized.slice(0, MAX_STORED_REPORT_CHARS)}…`,
  };
}

export type AcceptanceValidation =
  | { ok: true; plan: AcceptancePlan }
  | { ok: false; missing: boolean; errors: string[] };

export async function readAcceptancePlan(
  workspaceDir: string,
): Promise<AcceptanceValidation> {
  const file = path.join(workspaceDir, ACCEPTANCE_FILE);

  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return {
      ok: false,
      missing: true,
      errors: [`${ACCEPTANCE_FILE} is missing at the workspace root.`],
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      missing: false,
      errors: [
        `${ACCEPTANCE_FILE} is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  const result = acceptancePlanSchema.safeParse(parsed);

  if (!result.success) {
    return {
      ok: false,
      missing: false,
      errors: result.error.issues.map(
        (issue) =>
          `${issue.path.join(".") || ACCEPTANCE_FILE}: ${issue.message}`,
      ),
    };
  }

  return { ok: true, plan: result.data };
}
