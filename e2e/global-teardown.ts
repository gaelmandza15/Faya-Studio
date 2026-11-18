import { createHash } from "node:crypto";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PROJECT_ID, BACKUP_PROJECT_ID, readE2eState } from "./state";

config({ path: ".env.local" });
config({ path: ".env" });

export default async function globalTeardown() {
  if (process.env.E2E_REMOTE === "1") {
    console.log(
      "[e2e] Remote mode: project and session are managed by the staging environment.",
    );
    return;
  }

  const prisma = new PrismaClient();

  try {
    let token: string | null = null;

    try {
      token = readE2eState().token;
    } catch {
      token = null;
    }

    if (token) {
      await prisma.session.deleteMany({
        where: {
          tokenHash: createHash("sha256").update(token).digest("hex"),
        },
      });
    }

    await prisma.project.deleteMany({
      where: { id: { in: [PROJECT_ID, BACKUP_PROJECT_ID] } },
    });
    console.log(`[e2e] Removed ${PROJECT_ID} and its test session.`);
  } catch (error) {
    console.warn(
      "[e2e] Teardown warning:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    await prisma.$disconnect();
  }
}
