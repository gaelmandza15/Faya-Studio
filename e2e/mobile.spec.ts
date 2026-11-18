import { expect, test } from "@playwright/test";
import { gotoInteractive } from "./helpers";
import { readE2eState } from "./state";

test.describe("Mobile", () => {
  test("platform drawer and app runner fit a phone screen", async ({
    page,
  }) => {
    const { projectId } = readE2eState();

    await gotoInteractive(page, "/");
    await page.getByRole("button", { name: "Ouvrir le menu" }).tap();

    const dialog = page.getByRole("dialog", { name: "Menu de navigation" });
    await expect(dialog).toBeVisible();

    const overlay = page.getByRole("button", { name: "Fermer le menu" });
    const box = await overlay.boundingBox();

    await overlay.tap({
      position: { x: Math.max(20, (box?.width ?? 400) - 20), y: 220 },
    });
    await expect(dialog).toBeHidden();

    await page.goto(`/app/${projectId}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-sse="connected"]')).toBeVisible();

    const iframe = page.locator("iframe");
    await expect(iframe).toBeVisible();

    const box2 = await iframe.boundingBox();
    expect(box2?.height ?? 0).toBeGreaterThan(500);

    const frame = page.frameLocator("iframe");
    await expect(frame.locator("#task-count")).toHaveText("3");

    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(pageOverflow).toBe(true);

    const frameOverflow = await iframe.evaluate((element) => {
      const doc = (element as HTMLIFrameElement).contentDocument;
      if (!doc) return false;
      return (
        doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1
      );
    });
    expect(frameOverflow).toBe(true);

    await frame.getByRole("button", { name: "Ouvrir le menu" }).tap();
    await expect(frame.locator("#sidebar")).toBeVisible();
    await frame.getByRole("button", { name: "Fermer le menu" }).tap();
    await expect(frame.locator("#sidebar")).toBeHidden();

    await frame.getByLabel("Nouvelle tâche").fill("Mobile E2E");
    await frame.getByRole("button", { name: "Ajouter" }).tap();
    await expect(
      frame.locator(".task-item").filter({ hasText: "Mobile E2E" }),
    ).toHaveCount(1);
    await expect(frame.locator("#task-count")).toHaveText("4");

    await frame
      .getByRole("button", { name: "Supprimer Mobile E2E" })
      .tap();
    await expect(frame.locator("#task-count")).toHaveText("3");
  });
});
