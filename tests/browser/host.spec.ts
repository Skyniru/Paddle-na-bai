import { test, expect } from "@playwright/test";
test("mobile host flow persists results, rotates the waiting crew, and works offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good games start here." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-empty.png",
    fullPage: true,
  });
  for (const name of [
    "Alex Santos",
    "Bea Cruz",
    "Carlo Reyes",
    "Dani Lim",
    "Eli Tan",
    "Fran Uy",
  ]) {
    await page
      .getByRole("button", { name: "Add a player", exact: true })
      .click();
    await page.getByLabel("Player name").fill(name);
    await page
      .getByRole("button", { name: "Save player", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Create your first session" }).click();
  await page.getByLabel("Session name").fill("Friday crew");
  await page.getByLabel("Venue", { exact: true }).fill("Cebu Padel Club");
  await page
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate round", exact: true })
    .click();
  await expect(page.getByText("● Playing")).toBeVisible();
  await expect(page.locator(".waiting-players button")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/mobile-live.png",
    fullPage: true,
  });
  await page.getByLabel("Team A score").fill("6");
  await page.getByLabel("Team B score").fill("3");
  await page.getByRole("button", { name: "Team A wins", exact: true }).click();
  await expect(page.getByText("Team A won 6 – 3")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Team A won 6 – 3")).toBeVisible();
  await page
    .getByRole("button", { name: "Generate round", exact: true })
    .click();
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open secondary menu" }).click();
  await page.getByRole("link", { name: "Session history" }).click();
  await page.getByRole("button", { name: /Friday crew/ }).click();
  await expect(page.getByText("Team A won · 6 – 3")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Good times, on record." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Friday crew/ }).click();
  await expect(page.getByText("Team A won · 6 – 3")).toBeVisible();
  await page.getByRole("link", { name: "Players", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Meet your crew." }),
  ).toBeVisible();
  await expect(page.locator(".player-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await page.screenshot({
    path: "test-results/mobile-dark.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("desktop layout stays within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good games start here." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
