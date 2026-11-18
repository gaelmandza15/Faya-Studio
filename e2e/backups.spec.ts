import { expect, test } from "@playwright/test";
import { gotoInteractive } from "./helpers";
import { readE2eState } from "./state";

test.describe("Backups", () => {
  test("creates, downloads and restores a snapshot", async ({ page }) => {
    const { backupProjectId } = readE2eState();

    await page.goto(`/app/${backupProjectId}`, {
      waitUntil: "domcontentloaded",
    });
    const frame = page.frameLocator("iframe");
    await expect(frame.locator("#task-count")).toHaveText("3");

    await frame.getByLabel("Nouvelle tâche").fill("Backup Test");
    await frame.getByRole("button", { name: "Ajouter" }).click();
    await expect(
      frame.locator(".task-item").filter({ hasText: "Backup Test" }),
    ).toHaveCount(1);
    await expect(frame.locator("#task-count")).toHaveText("4");

    await gotoInteractive(page, `/applications/${backupProjectId}`);
    await expect(
      page.getByRole("heading", { name: "E2E Backup" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Créer une sauvegarde" }).click();
    await expect(
      page.getByRole("button", { name: "Restaurer" }),
    ).toBeVisible();
    await expect(page.getByText("Manuelle").first()).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Télécharger" }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.db$/);

    await page.goto(`/app/${backupProjectId}`, {
      waitUntil: "domcontentloaded",
    });
    const updated = page.frameLocator("iframe");
    await expect(updated.locator("#task-count")).toHaveText("4");
    await updated
      .getByRole("button", { name: "Supprimer Backup Test" })
      .click();
    await expect(updated.locator("#task-count")).toHaveText("3");

    await gotoInteractive(page, `/applications/${backupProjectId}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restaurer" }).click();
    await expect(page.getByText("Sauvegarde restaurée.")).toBeVisible();

    await page.goto(`/app/${backupProjectId}`, {
      waitUntil: "domcontentloaded",
    });
    const restored = page.frameLocator("iframe");
    await expect(
      restored.locator(".task-item").filter({ hasText: "Backup Test" }),
    ).toHaveCount(1);
    await expect(restored.locator("#task-count")).toHaveText("4");
  });
});
