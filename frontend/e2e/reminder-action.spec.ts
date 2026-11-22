import { expect, test } from "playwright/test";

test("a measurable habit reminder requires its progress and note before saving", async ({ page }) => {
  const saved: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => localStorage.setItem("dayloop:local-access", "true"));
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/profile")) {
      await route.fulfill({ json: { item: { username: "tester", age: 25, role: "working",
        tour_completed: true, display_name: "Tester" } } });
    } else if (path.endsWith("/notifications")) {
      await route.fulfill({ json: { items: [] } });
    } else if (path.endsWith("/habits") && route.request().method() === "GET") {
      await route.fulfill({ json: { items: [{ id: "habit-test", name: "Walk", timezone: "Asia/Kolkata",
        measurement_type: "quantity", unit: "steps", daily_note_required: true }] } });
    } else if (path.includes("/habits/habit-test/entries/") && route.request().method() === "PUT") {
      saved.push(route.request().postDataJSON());
      await route.fulfill({ json: { item: { status: "completed" } } });
    } else {
      await route.fulfill({ json: { items: [] } });
    }
  });

  await page.goto("/notification-action?type=habit&sourceId=habit-test");
  await expect(page.getByRole("heading", { name: "Walk" })).toBeVisible();
  await expect(page.getByLabel("Progress (steps)")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Note or response")).toHaveAttribute("required", "");
  await page.getByRole("button", { name: "Apply action" }).click();
  expect(saved).toHaveLength(0);
  await page.getByLabel("Progress (steps)").fill("1000");
  await page.getByLabel("Note or response").fill("Walked after lunch");
  await page.getByRole("button", { name: "Apply action" }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0]).toMatchObject({ status: "completed", value: 1000, note: "Walked after lunch" });
});
