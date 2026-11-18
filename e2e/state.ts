import { readFileSync } from "node:fs";
import path from "node:path";

export const PROJECT_ID = "e2e00000-0000-4000-8000-000000000001";
export const BACKUP_PROJECT_ID = "e2e00000-0000-4000-8000-000000000002";

export interface E2eState {
  projectId: string;
  backupProjectId: string;
  appKey: string;
  token: string;
  organizationId: string;
}

export function readE2eState(): E2eState {
  return JSON.parse(
    readFileSync(path.resolve(".e2e/state.json"), "utf8"),
  ) as E2eState;
}
