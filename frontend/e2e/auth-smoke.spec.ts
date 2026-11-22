import { expect, test } from "playwright/test";

test("unauthenticated visitors can reach sign-in and sign-up from the landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Plan less/i })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByRole("button", { name: "Create a new workspace" }).click();
  await expect(page.getByRole("heading", { name: /Start with a clean loop/i })).toBeVisible();
});

test("a protected route does not expose workspace content without a session", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: /Plan less/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toHaveCount(0);
});
