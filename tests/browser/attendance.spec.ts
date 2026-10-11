import { test, expect } from "@playwright/test";
test("mobile attendance controls and reservations persist on reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const name of ["Ada", "Bea", "Cal", "Dan"]) {
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
  await page.getByLabel("Session name").fill("Attendance session");
  await page.getByLabel("Courts", { exact: true }).fill("1");
  await page.getByLabel("Default start").fill("00:00");
  await page.getByLabel("Default end").fill("23:59");
  await page
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Not Checked In", { exact: true })).toHaveCount(
    4,
  );
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: "Check in", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Check in", exact: true }),
    ).toHaveCount(3 - i);
  }
  await page
    .getByRole("button", { name: "Check out", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Undo Check-Out" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo Check-Out" }).click();
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate round", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Team A wins", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Team A wins", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-attendance.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
