import type { GenerationTarget } from "../lib/types";
import { buildUiQualityPrompt } from "./ui-quality";

export const FRAME_VERSION = 1;

export type FrameMode = "generate" | "modify";

export interface FrameChecks {
  requiresDesktopSchema: boolean;
  requiresTauriBridge: boolean;
  schemaMustStayIdempotent: boolean;
  forbidsExternalAssets: boolean;
}

export interface TargetFrame {
  id: GenerationTarget;
  label: string;
  runtime: string;
  contract: string[];
  generationOnly: string[];
  checks: FrameChecks;
}

const COMMON = [
  "File tools only: no shell, package manager, network access or external assets.",
  "Stay inside the workspace and do not create binary files.",
  "The app opens from index.html and works offline.",
  "Use the user's language for the interface.",
  "Do not ask the user questions; make reasonable assumptions.",
  "When a design contract is provided, it is authoritative for colors, typography, spacing, layout, shapes and components.",
];

const QUALITY = [
  "Deliver the requested workflows with real interactions and realistic sample data.",
  "Handle empty, loading and error states; make controls accessible; confirm destructive actions.",
  "Persistence must survive reloads.",
  "Keep the app runnable at every step: every referenced file must exist and every script must be included.",
  "If the implementation is large, split JavaScript into a few coherent modules and include all of them in index.html; never leave a partial or unreferenced file.",
  "Call run_checks and fix every reported error before finish; a referenced file that was never written is a failure, not a detail.",
  "Stay focused on the requested workflows; avoid unrelated features.",
  "Verify the app before finishing, then summarize what you built.",
];

const PRESERVE = [
  "Inspect the existing implementation before changing it.",
  "Make the smallest coherent change that fully delivers the request.",
  "Preserve current behaviour, data, visual identity and runtime contract.",
  "Change only what the request requires; avoid unrelated refactors or features.",
  "Update every affected layer consistently.",
  "If the request is ambiguous, choose the least destructive reasonable interpretation.",
  "Verify the app before finishing, then summarize what changed.",
];

export const TARGET_FRAMES: Record<GenerationTarget, TargetFrame> = {
  web: {
    id: "web",
    label: "web",
    runtime:
      "The app runs as a static single-page app in the browser.",
    contract: [
      "Persist data in the browser, with a graceful in-memory fallback when storage is unavailable.",
      "No SQL files or external dependencies.",
    ],
    generationOnly: ["Seed realistic sample data on first load."],
    checks: {
      requiresDesktopSchema: false,
      requiresTauriBridge: false,
      schemaMustStayIdempotent: false,
      forbidsExternalAssets: true,
    },
  },
  desktop: {
    id: "desktop",
    label: "desktop (Tauri 2 + SQLite)",
    runtime:
      "The app runs in a Tauri 2 WebView with a local SQLite database. The same app must remain fully usable in the browser preview, where the Tauri bridge is absent.",
    contract: [
      "Ship the schema and seed data as desktop-schema.sql at the workspace root. The shell applies it at every launch, so it must remain idempotent and free of destructive statements.",
      'The shell exposes invoke("db_select", { query, params }) returning rows and invoke("db_execute", { query, params }) returning the number of changed rows. Parameterize SQL values.',
      "Persist the app's domain data in SQLite on desktop; provide equivalent local persistence for the browser preview.",
    ],
    generationOnly: [
      "Seed enough realistic data for the app to feel alive on first launch.",
    ],
    checks: {
      requiresDesktopSchema: true,
      requiresTauriBridge: true,
      schemaMustStayIdempotent: true,
      forbidsExternalAssets: true,
    },
  },
};

export function getTargetFrame(target: GenerationTarget): TargetFrame {
  return TARGET_FRAMES[target] ?? TARGET_FRAMES.desktop;
}

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildSystemPrompt(
  target: GenerationTarget,
  mode: FrameMode,
  designSystem?: string,
): string {
  const frame = getTargetFrame(target);
  const intro =
    mode === "generate"
      ? "You are Faya-Studio's application builder. Build the business application the user describes."
      : "You are modifying an existing Faya-Studio application. The app is complete and working; apply the requested change without regressing anything else.";
  const rules = mode === "generate" ? QUALITY : PRESERVE;
  const targetRules =
    mode === "generate"
      ? [...frame.contract, ...frame.generationOnly]
      : frame.contract;

  const parts = [
    intro,
    "",
    "FRAME",
    bullets(COMMON),
    "",
    bullets(rules),
    "",
    `RUNTIME: ${frame.label}`,
    frame.runtime,
    bullets(targetRules),
  ];

  if (designSystem?.trim()) {
    parts.push(
      "",
      "DESIGN CONTRACT",
      "Follow this design system for the entire interface. It overrides your own visual preferences.",
      "",
      designSystem.trim(),
    );
  }

  parts.push("", buildUiQualityPrompt(mode));

  return parts.join("\n");
}
