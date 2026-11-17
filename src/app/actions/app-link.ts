"use server";

import { revalidatePath } from "next/cache";
import {
  ensureAppKey,
  generateWebhookSecret,
  rotateAppKey,
} from "@/lib/app-link";
import { db } from "@/lib/db";
import { can } from "@/lib/roles";
import { getWorkspaceContext } from "@/lib/workspace";
import { isValidWebhookUrl, notifyProjectWebhooks } from "@/lib/webhooks";

export type SyncToggleResult =
  | { ok: true; appKey: string; syncEnabled: boolean }
  | { error: "notFound" | "forbidden" | "generic" };

export type RotateKeyResult =
  | { ok: true; appKey: string; prefix: string }
  | { error: "notFound" | "forbidden" | "generic" };

export type WebhookActionResult =
  | { ok: true }
  | { error: "notFound" | "forbidden" | "invalidUrl" | "limit" | "generic" };

export type AddWebhookResult =
  | {
      ok: true;
      endpoint: { id: string; name: string; url: string; secret: string };
    }
  | {
      error: "notFound" | "forbidden" | "invalidUrl" | "limit" | "generic";
    };

export type TestWebhookResult =
  | { ok: true; endpoints: number; delivered: number; failed: number }
  | { error: "notFound" | "forbidden" | "none" | "generic" };

type LoadedProject =
  | { error: "notFound" | "forbidden" }
  | {
      project: {
        id: string;
        name: string;
        appKey: string | null;
        syncEnabled: boolean;
      };
    };

async function loadProject(projectId: string): Promise<LoadedProject> {
  const workspace = await getWorkspaceContext();

  if (!can(workspace.organization.role, "project.update")) {
    return { error: "forbidden" as const };
  }

  const project = await db.project.findFirst({
    where: { id: projectId, organizationId: workspace.organization.id },
    select: { id: true, name: true, appKey: true, syncEnabled: true },
  });

  if (!project) {
    return { error: "notFound" as const };
  }

  return { project };
}

function revalidate(projectId: string) {
  revalidatePath(`/applications/${projectId}`);
  revalidatePath("/applications");
  revalidatePath("/projets");
}

export async function setProjectSyncAction(
  projectId: string,
  enabled: boolean,
): Promise<SyncToggleResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) {
      return { error: loaded.error };
    }

    const key = await ensureAppKey(loaded.project);

    if (enabled) {
      await db.project.update({
        where: { id: projectId },
        data: { syncEnabled: true, lastActivityAt: new Date() },
      });
    } else {
      await db.project.update({
        where: { id: projectId },
        data: { syncEnabled: false, lastActivityAt: new Date() },
      });
    }

    revalidate(projectId);

    return { ok: true, appKey: key.appKey, syncEnabled: enabled };
  } catch {
    return { error: "generic" };
  }
}

export async function rotateAppKeyAction(
  projectId: string,
): Promise<RotateKeyResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) {
      return { error: loaded.error };
    }

    const rotated = await rotateAppKey(projectId);
    await db.syncDevice.deleteMany({ where: { projectId } });

    revalidate(projectId);

    return { ok: true, appKey: rotated.appKey, prefix: rotated.prefix };
  } catch {
    return { error: "generic" };
  }
}

export async function addWebhookAction(
  projectId: string,
  input: { name?: string; url: string },
): Promise<AddWebhookResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) {
      return { error: loaded.error };
    }

    const url = input.url.trim();

    if (!isValidWebhookUrl(url)) {
      return { error: "invalidUrl" };
    }

    const count = await db.webhookEndpoint.count({ where: { projectId } });

    if (count >= 10) {
      return { error: "limit" };
    }

    const name = input.name?.trim().slice(0, 60) || "Webhook";
    const secret = generateWebhookSecret();

    await ensureAppKey(loaded.project);

    const endpoint = await db.webhookEndpoint.create({
      data: { projectId, name, url, secret },
      select: { id: true, name: true, url: true, secret: true },
    });

    revalidate(projectId);

    return { ok: true, endpoint };
  } catch {
    return { error: "generic" };
  }
}

export async function removeWebhookAction(
  projectId: string,
  endpointId: string,
): Promise<WebhookActionResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) {
      return { error: loaded.error };
    }

    await db.webhookEndpoint.deleteMany({
      where: { id: endpointId, projectId },
    });

    revalidate(projectId);

    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}

export async function toggleWebhookAction(
  projectId: string,
  endpointId: string,
  enabled: boolean,
): Promise<WebhookActionResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) {
      return { error: loaded.error };
    }

    const updated = await db.webhookEndpoint.updateMany({
      where: { id: endpointId, projectId },
      data: { enabled },
    });

    if (updated.count === 0) {
      return { error: "notFound" };
    }

    revalidate(projectId);

    return { ok: true };
  } catch {
    return { error: "generic" };
  }
}

export async function testWebhookAction(
  projectId: string,
): Promise<TestWebhookResult> {
  try {
    const loaded = await loadProject(projectId);

    if ("error" in loaded) {
      return { error: loaded.error };
    }

    const count = await db.webhookEndpoint.count({
      where: { projectId, enabled: true },
    });

    if (count === 0) {
      return { error: "none" };
    }

    const result = await notifyProjectWebhooks(projectId, "faya.test", {
      projectId,
      projectName: loaded.project.name,
      message: "Test event from Faya-Studio.",
    });

    revalidate(projectId);

    return {
      ok: true,
      endpoints: result.endpoints,
      delivered: result.delivered,
      failed: result.endpoints - result.delivered,
    };
  } catch {
    return { error: "generic" };
  }
}
