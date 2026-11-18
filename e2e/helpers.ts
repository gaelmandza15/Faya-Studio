import type { Page } from "@playwright/test";

/**
 * Navigate to a platform page and wait until client components are hydrated.
 * `domcontentloaded` alone can resolve before React attaches event handlers,
 * which makes the first click a no-op on cold dev-server starts.
 */
export async function gotoInteractive(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
}
