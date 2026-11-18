import { createHash, randomBytes } from "node:crypto";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Short-lived token used by the automated acceptance run. */
export const ACCEPTANCE_SESSION_TTL_MS = 1000 * 60 * 15;

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}
