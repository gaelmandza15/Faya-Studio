import { LocalTauriRunner } from "./local-tauri-runner";
import type { BuildRunner } from "./types";

export type {
  BuildRunner,
  TauriBuildInput,
  TauriBuildResult,
} from "./types";

export function getBuildRunner(): BuildRunner {
  const kind = process.env.FAYA_BUILD_RUNNER ?? "local";

  if (kind === "local") {
    return new LocalTauriRunner();
  }

  throw new Error(
    `Unsupported build runner "${kind}". A remote Windows/CI runner will be added for production.`,
  );
}
