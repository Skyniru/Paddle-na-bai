import { test, expect } from "@playwright/test";

test("system theme, saved preference and dark surfaces stay consistent", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass("dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(23, 28, 25)");
  await expect(page.locator(".header")).toHaveCSS("background-color", "rgb(23, 28, 25)");
  await page.getByRole("button", { name: "About the Developer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCSS("background-color", "rgb(34, 43, 37)");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByRole("link", { name: "Players", exact: true }).last().click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass("dark");
});
