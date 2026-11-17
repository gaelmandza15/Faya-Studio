import { expect, test } from "@playwright/test";
import { readE2eState } from "./state";

test.describe.serial("App runner", () => {
  test("loads the fixture app through the platform bridge", async ({
    page,
  }) => {
    const { projectId } = readE2eState();
    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !/favicon|Failed to load resource/i.test(message.text())
      ) {
        errors.push(message.text());
      }
    });

    await page.goto(`/app/${projectId}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "E2E Runner" }),
    ).toBeVisible();
    await expect(page.locator('[data-sse="connected"]')).toBeVisible();

    const iframe = page.locator("iframe");
    await expect(iframe).toBeVisible();
    await expect
      .poll(async () => (await iframe.boundingBox())?.height ?? 0)
      .toBeGreaterThan(600);

    const frame = page.frameLocator("iframe");
    await expect(
      frame.getByRole("heading", { name: "Vos tâches" }),
    ).toBeVisible();
    await expect(frame.locator("#task-count")).toHaveText("3");

    const bridge = await iframe.evaluate(async (element) => {
      const win = (element as HTMLIFrameElement).contentWindow as unknown as {
        __TAURI_INTERNALS__?: {
          invoke: (command: string, args: unknown) => Promise<unknown>;
        };
        __TAURI__?: { core?: { invoke?: unknown } };
      };

      const rows = (await win.__TAURI_INTERNALS__!.invoke("db_select", {
        query: "SELECT COUNT(*) AS c FROM tasks",
        params: [],
      })) as Array<{ c: number }>;

      return {
        hasCoreBridge: Boolean(win.__TAURI__?.core?.invoke),
        count: rows[0]?.c,
      };
    });

    expect(bridge.hasCoreBridge).toBe(true);
    expect(bridge.count).toBe(3);
    expect(errors).toEqual([]);
  });

  test("creates, persists and deletes a task", async ({ page }) => {
    const { projectId } = readE2eState();

    await page.goto(`/app/${projectId}`, { waitUntil: "domcontentloaded" });
    const frame = page.frameLocator("iframe");
    await expect(frame.locator("#task-count")).toHaveText("3");

    await frame.getByLabel("Nouvelle tâche").fill("Tâche E2E");
    await frame.getByRole("button", { name: "Ajouter" }).click();
    await expect(
      frame.locator(".task-item").filter({ hasText: "Tâche E2E" }),
    ).toHaveCount(1);
    await expect(frame.locator("#task-count")).toHaveText("4");
    await expect(frame.locator("#done-count")).toHaveText("1");

    await page.reload();
    const reloaded = page.frameLocator("iframe");
    const reloadedItem = reloaded
      .locator(".task-item")
      .filter({ hasText: "Tâche E2E" });
    await expect(reloadedItem).toHaveCount(1);
    await expect(reloaded.locator("#task-count")).toHaveText("4");

    await reloaded
      .getByRole("button", { name: "Supprimer Tâche E2E" })
      .click();
    await expect(reloadedItem).toHaveCount(0);
    await expect(reloaded.locator("#task-count")).toHaveText("3");
  });

  test("notification badge clears and drawer closes with Escape", async ({
    page,
  }) => {
    const { projectId } = readE2eState();

    await page.goto(`/app/${projectId}`, { waitUntil: "domcontentloaded" });
    const frame = page.frameLocator("iframe");
    const badge = frame.locator("#notification-badge");
    const panel = frame.locator("#notifications-panel");

    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("2");

    await frame.getByRole("button", { name: "Notifications" }).click();
    await expect(panel).toBeVisible();
    await expect(badge).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    await frame.getByRole("button", { name: "Ouvrir le menu" }).click();
    await expect(frame.locator("#sidebar")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(frame.locator("#sidebar")).toBeHidden();
  });

  test("has no horizontal overflow on a phone viewport", async ({ page }) => {
    const { projectId } = readE2eState();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/app/${projectId}`, { waitUntil: "domcontentloaded" });
    const frame = page.frameLocator("iframe");
    await expect(frame.locator("#task-count")).toHaveText("3");

    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(pageOverflow).toBe(true);

    const frameOverflow = await page.locator("iframe").evaluate((element) => {
      const doc = (element as HTMLIFrameElement).contentDocument;
      if (!doc) return false;
      return doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1;
    });
    expect(frameOverflow).toBe(true);
  });
});
