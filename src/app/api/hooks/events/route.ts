import { NextResponse } from "next/server";
import {
  bearerToken,
  getProjectForAppKey,
} from "@/lib/app-link";
import { notifyProjectWebhooks } from "@/lib/webhooks";


const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Faya-Key",
  "Access-Control-Max-Age": "86400",
};

const EVENT_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,79}$/;
const MAX_BODY_BYTES = 64 * 1024;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const project = await getProjectForAppKey(bearerToken(request));

  if (!project) {
    return json({ error: "unauthorized" }, 401);
  }

  const raw = await request.text();

  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: "payloadTooLarge" }, 413);
  }

  let body: { event?: unknown; data?: unknown };

  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: "invalidBody" }, 400);
  }

  const event = typeof body.event === "string" ? body.event : "";

  if (!EVENT_PATTERN.test(event)) {
    return json({ error: "invalidEvent" }, 400);
  }

  const result = await notifyProjectWebhooks(project.id, event, body.data ?? {});
  const failed = result.results.filter((entry) => !entry.ok);

  return json({
    ok: failed.length === 0,
    endpoints: result.endpoints,
    delivered: result.delivered,
    failed: failed.length,
    results: result.results.map((entry) =>
      entry.ok
        ? { ok: true, deliveryId: entry.deliveryId, status: entry.status }
        : { ok: false, deliveryId: entry.deliveryId, error: entry.error },
    ),
  });
}
