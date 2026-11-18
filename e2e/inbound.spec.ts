import { expect, test } from "@playwright/test";
import { readE2eState } from "./state";

test.describe("Inbound API", () => {
  test("external tools can create and delete a row", async ({
    page,
    request,
  }) => {
    const { projectId, appKey } = readE2eState();

    await page.goto(`/app/${projectId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-sse="connected"]')).toBeVisible();

    const frame = page.frameLocator("iframe");
    await expect(frame.locator("#task-count")).toHaveText("3");

    const created = await request.post(
      "http://localhost:3000/api/hooks/in",
      {
        headers: { authorization: `Bearer ${appKey}` },
        data: {
          table: "tasks",
          id: "8888",
          updatedAt: new Date().toISOString(),
          data: { id: 8888, title: "Inbound E2E", done: 0 },
        },
      },
    );

    expect(created.ok()).toBe(true);
    await expect(frame.getByText("Inbound E2E")).toBeVisible({
      timeout: 15_000,
    });
    await expect(frame.locator("#task-count")).toHaveText("4");

    const deleted = await request.post(
      "http://localhost:3000/api/hooks/in",
      {
        headers: { authorization: `Bearer ${appKey}` },
        data: {
          table: "tasks",
          id: "8888",
          updatedAt: new Date().toISOString(),
          deleted: true,
          data: null,
        },
      },
    );

    expect(deleted.ok()).toBe(true);
    await expect(
      frame.locator(".task-item").filter({ hasText: "Inbound E2E" }),
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(frame.locator("#task-count")).toHaveText("3");
  });
});
