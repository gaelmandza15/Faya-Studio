import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { db } from "@/lib/db";

const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_SNIPPET = 500;

export type WebhookSendResult =
  | { ok: true; deliveryId: string; status: number }
  | { ok: false; deliveryId: string; error: string };

export function isValidWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    if (url.hostname === "169.254.169.254") {
      return false;
    }

    return Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function signWebhook(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export async function deliverWebhook(input: {
  endpointId: string;
  url: string;
  secret: string;
  projectId: string;
  event: string;
  data: unknown;
}): Promise<WebhookSendResult> {
  const deliveryId = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    id: deliveryId,
    event: input.event,
    projectId: input.projectId,
    createdAt: new Date().toISOString(),
    data: input.data ?? {},
  });
  const signature = signWebhook(input.secret, timestamp, body);

  const delivery = await db.webhookDelivery.create({
    data: {
      id: deliveryId,
      endpointId: input.endpointId,
      event: input.event,
      status: "pending",
      payload: body,
    },
    select: { id: true },
  });

  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Faya-Studio-Webhooks/1.0",
        "x-faya-event": input.event,
        "x-faya-delivery": delivery.id,
        "x-faya-timestamp": timestamp,
        "x-faya-signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      cache: "no-store",
    });

    const snippet = (await response.text().catch(() => "")).slice(
      0,
      MAX_RESPONSE_SNIPPET,
    );

    const ok = response.ok;

    await db.$transaction([
      db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: ok ? "delivered" : "failed",
          responseCode: response.status,
          error: ok ? null : snippet || `HTTP ${response.status}`,
        },
      }),
      db.webhookEndpoint.update({
        where: { id: input.endpointId },
        data: { lastDeliveryAt: new Date(), lastStatus: response.status },
      }),
    ]);

    return ok
      ? { ok: true, deliveryId: delivery.id, status: response.status }
      : {
          ok: false,
          deliveryId: delivery.id,
          error: snippet || `HTTP ${response.status}`,
        };
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, MAX_RESPONSE_SNIPPET) : "unknown";

    await db.$transaction([
      db.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "failed", error: message },
      }),
      db.webhookEndpoint.update({
        where: { id: input.endpointId },
        data: { lastDeliveryAt: new Date(), lastStatus: null },
      }),
    ]);

    return { ok: false, deliveryId: delivery.id, error: message };
  }
}

export async function notifyProjectWebhooks(
  projectId: string,
  event: string,
  data: unknown,
) {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { projectId, enabled: true },
    select: { id: true, url: true, secret: true },
  });

  const results = await Promise.all(
    endpoints.map((endpoint) =>
      deliverWebhook({
        endpointId: endpoint.id,
        url: endpoint.url,
        secret: endpoint.secret,
        projectId,
        event,
        data,
      }),
    ),
  );

  return {
    endpoints: endpoints.length,
    delivered: results.filter((result) => result.ok).length,
    results,
  };
}
