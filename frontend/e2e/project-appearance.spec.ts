import { expect, test } from "playwright/test";

test("project icon tiles do not overlap and cover categories work on desktop and mobile", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("dayloop:local-access", "true"));
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({ json: path.endsWith("/profile")
      ? { item: { username: "tester", age: 25, role: "working", tour_completed: true, display_name: "Tester" } }
      : { items: [] } });
  });
  for (const width of [1200, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects");
    await page.getByRole("button", { name: "New project", exact: true }).click();
    const tiles = page.locator(".project-icon-tile");
    await expect(tiles).toHaveCount(163);
    const layout = await tiles.evaluateAll(nodes => {
      const rects = nodes.map(n => n.getBoundingClientRect());
      return { minHeight: Math.min(...rects.map(r => r.height)), overlap: rects.some((a,i) => rects.slice(i+1).some(b => a.left < b.right-1 && a.right > b.left+1 && a.top < b.bottom-1 && a.bottom > b.top+1)) };
    });
    expect(layout.minHeight).toBeGreaterThanOrEqual(70);
    expect(layout.overlap).toBe(false);
    await page.getByLabel("Search project icons").fill("rocket");
    await expect(tiles).toHaveCount(1);
    await tiles.first().click();
    await expect(tiles.first()).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("group", { name: "Cover categories" }).getByRole("button", { name: "Gradients" }).click();
    await expect(page.locator(".project-cover-choice")).toHaveCount(5);
    await page.locator(".project-cover-choice").first().click();
    await expect(page.locator(".project-cover-choice").first()).toHaveAttribute("aria-pressed","true");
  }
});
