import { expect, test } from "@playwright/test";
import { readE2eState } from "./state";

test.describe("Platform shell", () => {
  test("authenticated dashboard and applications list", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Bienvenue sur Faya-Studio !" }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Applications", exact: true })
      .click();
    await expect(page).toHaveURL(/\/applications$/);
    await expect(
      page.getByRole("heading", { name: "Applications", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("E2E Runner").first()).toBeVisible();
  });

  test("application detail exposes the launch action", async ({ page }) => {
    const { projectId } = readE2eState();

    await page.goto(`/applications/${projectId}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "E2E Runner" }),
    ).toBeVisible();

    const launch = page.getByRole("link", { name: "Lancer l'application" });
    await expect(launch).toBeVisible();
    await expect(launch).toHaveAttribute("href", `/app/${projectId}`);
  });

  test("notifications dropdown opens and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByText("Application mise à jour")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText("Application mise à jour")).toBeHidden();
  });

  test("mobile navigation drawer opens, closes and locks the background", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu de navigation" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    await expect(dialog).toBeVisible();
    await page
      .getByRole("button", { name: "Fermer le menu" })
      .click({ position: { x: 350, y: 220 } });
    await expect(dialog).toBeHidden();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(overflow).toBe(true);
  });
});
