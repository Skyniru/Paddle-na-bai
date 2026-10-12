import { test, expect } from "@playwright/test";

test("developer info supports keyboard, themes, outside dismissal and offline use", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "About the Developer",
    exact: true,
  });
  const panel = page.getByRole("dialog", { name: "Meet the Developer" });
  await expect(trigger).toBeVisible();
  const buttonBounds = await trigger.boundingBox();
  const navBounds = await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .boundingBox();
  expect(buttonBounds!.height).toBeGreaterThanOrEqual(44);
  expect(buttonBounds!.x + buttonBounds!.width).toBeLessThanOrEqual(
    navBounds!.x,
  );
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "Neil Iwelador" }),
  ).toBeVisible();
  await expect(panel).toContainText("Solo Developer & IT Enthusiast");
  await expect(panel).toContainText(
    "Made with passion, patience, and lots of learning.",
  );
  await expect(
    page.getByRole("button", { name: "Close About the Developer" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    panel.getByRole("link", { name: "Email the Developer" }),
  ).toBeFocused();
  await expect(trigger).not.toBeFocused();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/developer-mobile-light.png",
  });
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await trigger.click();
  await page.screenshot({
    animations: "disabled",
    path: "test-results/developer-mobile-dark.png",
  });
  await page.mouse.click(5, 5);
  await expect(panel).not.toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.setOffline(true);
  await trigger.click();
  await expect(panel).toBeVisible();
  const desktop = await panel.boundingBox();
  expect(desktop!.width).toBeLessThanOrEqual(360);
  expect(desktop!.x).toBeLessThan(40);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await panel.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "none",
  );
  await page.screenshot({
    animations: "disabled",
    path: "test-results/developer-desktop-dark.png",
  });
  await page.getByRole("button", { name: "Close About the Developer" }).click();
  await expect(panel).not.toBeVisible();
});

test("feedback email and copy actions work offline and report clipboard failures", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page
    .getByRole("button", { name: "About the Developer", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Meet the Developer" });
  const link = panel.getByRole("link", { name: "Email the Developer" });
  const href = await link.getAttribute("href");
  const url = new URL(href!);
  expect(url.protocol).toBe("mailto:");
  expect(url.pathname).toBe("neil.relador04@gmail.com");
  expect(url.searchParams.get("subject")).toBe(
    "PaddleBai — Feedback & Suggestions",
  );
  expect(url.searchParams.get("body")).toContain(
    "Write your ideas or suggestions here.",
  );
  await context.setOffline(true);
  for (const viewport of [
    { width: 390, height: 664 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await panel.getByRole("button", { name: "Copy email address" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "neil.relador04@gmail.com",
    );
    await expect(
      panel.getByRole("status").filter({ hasText: "Email address copied." }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Copy GCash Number" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "09274901442",
    );
    await expect(
      panel.getByRole("status").filter({ hasText: "GCash number copied." }),
    ).toBeVisible();
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => Promise.reject(new Error("Permission denied")),
    }),
  );
  await panel.getByRole("button", { name: "Copy GCash Number" }).click();
  await expect(
    panel
      .getByRole("status")
      .filter({ hasText: "Could not copy automatically." }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Close About the Developer" })
    .click();
  await expect(panel).not.toBeVisible();
});
