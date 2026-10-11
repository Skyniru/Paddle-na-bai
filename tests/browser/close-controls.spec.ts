import { test, expect } from "@playwright/test";

test("close stays visible while session forms and group editors scroll", async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 480 },
    { width: 1280, height: 600 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Create your first session" })
      .click();
    const close = page.getByRole("button", {
      name: "Close dialog",
      exact: true,
    });
    const before = await close.boundingBox();
    const scrolled = await page.locator(".modal-body").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);
    const after = await close.boundingBox();
    expect(after?.y).toBe(before?.y);
    expect(after!.y).toBeGreaterThanOrEqual(0);
    expect(after!.y + after!.height).toBeLessThanOrEqual(viewport.height);
    await close.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/players");
    await page
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save group", exact: true })
      .scrollIntoViewIfNeeded();
    const groupClose = page.getByRole("button", {
      name: "Close group editor",
      exact: true,
    });
    const bounds = await groupClose.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await groupClose.click();
    await expect(page.locator(".group-editor")).toHaveCount(0);
  }
});
