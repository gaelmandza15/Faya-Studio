import { expect, test } from "@playwright/test";
import { readE2eState } from "./state";

test.describe("Real-time sync", () => {
  test("a desktop push refreshes the open web app through SSE", async ({
    page,
    request,
  }) => {
    const { projectId, appKey } = readE2eState();

    await page.goto(`/app/${projectId}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-sse="connected"]')).toBeVisible();

    const frame = page.frameLocator("iframe");
    await expect(frame.locator("#task-count")).toHaveText("3");

    const push = await request.post(
      `http://localhost:3000/api/sync/push`,
      {
        headers: { authorization: `Bearer ${appKey}` },
        data: {
          deviceId: "e2e-desktop",
          deviceName: "E2E Desktop",
          changes: [
            {
              table: "tasks",
              id: "9999",
              updatedAt: new Date().toISOString(),
              deleted: false,
              data: {
                id: 9999,
                title: "Desktop E2E",
                done: 0,
              },
            },
          ],
        },
      },
    );

    expect(push.ok()).toBe(true);
    await expect(frame.getByText("Desktop E2E")).toBeVisible({
      timeout: 15_000,
    });
    await expect(frame.locator("#task-count")).toHaveText("4");

    const remove = await request.post(
      `http://localhost:3000/api/sync/push`,
      {
        headers: { authorization: `Bearer ${appKey}` },
        data: {
          deviceId: "e2e-desktop",
          deviceName: "E2E Desktop",
          changes: [
            {
              table: "tasks",
              id: "9999",
              updatedAt: new Date().toISOString(),
              deleted: true,
              data: null,
            },
          ],
        },
      },
    );

    expect(remove.ok()).toBe(true);
    await expect(
      frame.locator(".task-item").filter({ hasText: "Desktop E2E" }),
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(frame.locator("#task-count")).toHaveText("3");
  });
});
