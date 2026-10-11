import { test, expect } from "@playwright/test";

test("saved groups support searchable session selection, late arrivals and session-only rest", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/players");
  await expect(
    page.getByRole("heading", { name: "Meet your crew." }),
  ).toBeVisible();
  for (const name of [
    "Alex Santos",
    "Bea Cruz",
    "Carlo Reyes",
    "Dani Lim",
    "Eli Tan",
    "Fran Uy",
  ]) {
    await page.getByRole("button", { name: "Add player", exact: true }).click();
    await page.getByLabel("Player name").fill(name);
    await page
      .getByRole("button", { name: "Save player", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page.getByLabel("Group name", { exact: true }).fill("Friday Club");
  for (const name of [
    "Alex Santos",
    "Bea Cruz",
    "Carlo Reyes",
    "Dani Lim",
    "Eli Tan",
  ]) {
    await page.getByLabel("Search saved players").fill(name);
    await page.getByRole("checkbox", { name: new RegExp(name) }).check();
  }
  await page.getByLabel("Group photo or logo", { exact: false }).setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator(".group-editor").getByRole("alert")).toContainText(
    "Choose a JPG, PNG, or WebP",
  );
  await page
    .getByLabel("Group photo or logo", { exact: false })
    .setInputFiles("public/icons/icon-192.png");
  await expect(page.locator(".group-photo-field img")).toBeVisible();
  await expect(page.getByText("5 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Friday Club" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Friday Club" }),
  ).toBeVisible();
  await expect(page.locator(".group-card img")).toBeVisible();
  await page
    .getByRole("button", { name: "Manage Friday Club", exact: true })
    .click();
  await expect(page.locator(".group-photo-field img")).toBeVisible();
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(page.locator(".group-card img")).toBeVisible();
  await page.screenshot({
    path: "test-results/groups-logos.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Add Friday Club to session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Session name").fill("Friday evening");
  await page.getByLabel("Venue", { exact: true }).fill("Local Club");
  await page
    .getByRole("button", { name: "Friday Club 5 players", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add whole group", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Eli Tan/ }).uncheck();
  await page.locator(".player-picker .crew-picker").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/group-player-picker.png" });
  await page.getByLabel("Search saved players").fill("Alex");
  await expect(page.getByText("4 selected", { exact: true })).toBeVisible();
  await page.getByLabel("Courts", { exact: true }).fill("1");
  await page.getByLabel("Default start").fill("00:00");
  await page.getByLabel("Default end").fill("23:59");
  await page
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const roster = page.getByRole("region", { name: "Session playing list" });
  await expect(roster.locator(".roster-row")).toHaveCount(4);
  await page.getByRole("link", { name: "Players", exact: true }).click();
  await page
    .getByRole("link", { name: "Add Friday Club to session", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to playing list", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Friday Club 1 players", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Eli Tan/ }).check();
  await page.getByRole("button", { name: "Add to playing list" }).click();
  await expect(roster.locator(".roster-row")).toHaveCount(5);
  await page.getByLabel("Availability for Alex Santos").selectOption("resting");
  await page.reload();
  await expect(page.getByLabel("Availability for Alex Santos")).toHaveValue(
    "resting",
  );
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
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
  await page
    .getByRole("button", { name: "Generate round", exact: true })
    .click();
  await expect(page.locator(".court-card")).not.toContainText("Alex Santos");
  await expect(page.getByLabel("Availability for Eli Tan")).toBeDisabled();
  await page.getByRole("button", { name: "Team A wins", exact: true }).click();
  await expect(page.getByLabel("Availability for Eli Tan")).toBeEnabled();
  await page.getByLabel("Availability for Alex Santos").selectOption("active");
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
  await page
    .getByRole("button", { name: "Generate round", exact: true })
    .click();
  await expect(page.locator(".court-card")).toContainText("Alex Santos");
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Create your first session" }).click();
  await page
    .getByRole("button", { name: "Friday Club 5 players", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add whole group", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /Eli Tan/ }).uncheck();
  await expect(page.getByText("4 selected", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Alex Santos/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("link", { name: "Players", exact: true }).click();
  await page
    .getByRole("link", { name: "Add Friday Club to session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Add active players", exact: true })
    .click();
  await expect(page.getByText("5 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("link", { name: "Players", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage Friday Club", exact: true })
    .click();
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(page.locator(".group-editor")).toHaveCount(0);
  await expect(page.locator(".group-card img")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Friday Club", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".group-card img")).toHaveCount(0);
  expect(errors).toEqual([]);
});
