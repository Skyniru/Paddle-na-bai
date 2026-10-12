import { test, expect, chromium } from "@playwright/test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

for (const theme of ["light", "dark"] as const) {
  test(`${theme} overrides system preference across full offline browser reopening`, async () => {
    mkdirSync("test-results", { recursive: true });
    const profile = mkdtempSync(
      join(resolve("test-results"), `theme-${theme}-`),
    );
    const system = theme === "light" ? "dark" : "light";
    let browser = await chromium.launchPersistentContext(profile, {
      headless: true,
      colorScheme: system,
    });
    try {
      let page = await browser.newPage();
      await page.goto("http://localhost:3100/");
      await expect(
        page.getByText("Ready for offline play", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Toggle color theme" }).click();
      expect(
        await page.evaluate(() => localStorage.getItem("paddle-theme")),
      ).toBe(theme);
      await page.reload();
      expect(
        await page
          .locator("html")
          .evaluate((el) => el.classList.contains("dark")),
      ).toBe(theme === "dark");
      await browser.close();
      browser = await chromium.launchPersistentContext(profile, {
        headless: true,
        offline: true,
        colorScheme: system,
      });
      page = await browser.newPage();
      await page.goto("http://localhost:3100/");
      for (const route of ["players", "courts", "leaderboard", "history", ""]) {
        await page.goto("http://localhost:3100/" + (route ? route + "/" : ""));
        expect(
          await page
            .locator("html")
            .evaluate((el) => el.classList.contains("dark")),
        ).toBe(theme === "dark");
        expect(
          await page.evaluate(() => localStorage.getItem("paddle-theme")),
        ).toBe(theme);
      }
      await page.emulateMedia({ colorScheme: theme });
      await page.emulateMedia({ colorScheme: system });
      expect(
        await page
          .locator("html")
          .evaluate((el) => el.classList.contains("dark")),
      ).toBe(theme === "dark");
    } finally {
      await browser.close();
    }
  });
}
