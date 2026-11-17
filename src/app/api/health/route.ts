import { connection, NextResponse } from "next/server";
import pkg from "../../../../package.json";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * GET /api/health
 *
 * Public probe for load balancers, uptime monitors and CI smoke tests.
 * Returns 200 when the platform database answers, 503 otherwise.
 */
export async function GET() {
  // Opt out of build-time/static evaluation: the probe must run per request.
  await connection();

  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const version: string = pkg.version ?? "unknown";
  const log = logger.child({ requestId, route: "health" });

  try {
    // Lightweight connectivity check, no table scan.
    await db.$queryRaw`SELECT 1`;
    log.debug("Health probe ok");

    return NextResponse.json(
      { ok: true, version, timestamp, db: "ok", requestId },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database connectivity failed";

    log.error("Health probe failed", { error: message });

    return NextResponse.json(
      {
        ok: false,
        version,
        timestamp,
        db: "error",
        requestId,
        // Never leak driver details in production.
        ...(process.env.NODE_ENV === "production"
          ? {}
          : { error: message }),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "x-request-id": requestId,
        },
      },
    );
  }
}
