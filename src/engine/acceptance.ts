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
