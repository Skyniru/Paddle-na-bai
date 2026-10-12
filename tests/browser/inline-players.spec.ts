import { test, expect } from "@playwright/test";

test("create a group first and enter new names without leaving the group form", async ({
  page,
}) => {
  await page.goto("/players");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page
    .getByLabel("Group name", { exact: true })
    .fill("Future Friday Club");
  await page.getByLabel("New player name", { exact: true }).fill("Alex Santos");
  await page.getByLabel("New player name", { exact: true }).press("Enter");
  await expect(
    page.getByRole("checkbox", { name: /Alex Santos/ }),
  ).toBeChecked();
  await expect(page.getByLabel("Group name", { exact: true })).toHaveValue(
    "Future Friday Club",
  );
  await page.getByLabel("New player name", { exact: true }).fill("Bea Cruz");
  await page.getByRole("button", { name: "Add name", exact: true }).click();
  await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(page.locator(".group-editor")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Future Friday Club", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".player-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Manage Future Friday Club", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /Alex Santos/ }),
  ).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Bea Cruz/ })).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page.getByLabel("Group name", { exact: true }).fill("Planning only");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Planning only", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "New session" })).toBeVisible();
});

test("direct play accepts new names in place and a new late arrival without any group", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New session" }).click();
  await page.getByLabel("Session name").fill("Just play");
  await page.getByLabel("Venue", { exact: true }).fill("Local courts");
  for (const [index, name] of [
    "Alex Santos",
    "Bea Cruz",
    "Carlo Reyes",
    "Dani Lim",
  ].entries()) {
    await page.getByLabel("New player name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Add name", exact: true }).click();
    await expect(
      page.getByText(`${index + 1} selected`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Session name")).toHaveValue("Just play");
    await expect(page.getByLabel("Venue", { exact: true })).toHaveValue(
      "Local courts",
    );
  }
  await page
    .getByLabel("New player name", { exact: true })
    .fill(" alex santos ");
  await page.getByRole("button", { name: "Add name", exact: true }).click();
  await expect(
    page.locator(".inline-player-add").getByRole("status"),
  ).toContainText("Alex Santos added");
  await expect(page.getByText("4 selected", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(4);
  await page.getByLabel("Available Courts", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add saved players", exact: true })
    .click();
  await page.getByLabel("New player name", { exact: true }).fill("Eli Tan");
  await page.getByRole("button", { name: "Add name", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Eli Tan/ })).toBeChecked();
  await page
    .getByRole("button", { name: "Add to playing list", exact: true })
    .click();
  await expect(page.locator(".roster-row")).toHaveCount(5);
  await page.reload();
  await expect(page.locator(".roster-row")).toHaveCount(5);
  while (
    await page.getByRole("button", { name: "Check in", exact: true }).count()
  ) {
    const remaining = await page
      .getByRole("button", { name: "Check in", exact: true })
      .count();
    await page
      .getByRole("button", { name: "Check in", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Check in", exact: true }),
    ).toHaveCount(remaining - 1);
  }

  await expect(
    page
      .locator(".court-card")
      .getByText(/Playing/)
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Players", exact: true }).click();
  await expect(page.locator(".player-card")).toHaveCount(5);
  await expect(page.locator(".group-card")).toHaveCount(0);
});
