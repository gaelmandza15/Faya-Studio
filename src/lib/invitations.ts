import { createHash } from "node:crypto";

export const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
