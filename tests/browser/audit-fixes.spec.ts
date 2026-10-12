import { test, expect, type Page } from "@playwright/test";

async function seed(
  page: Page,
  mode: "playing" | "completed" | "draft" = "playing",
  courts = 2,
) {
  await page.goto("/");
  const at = await page.evaluate(() => Date.now());
  const players = Array.from({ length: 8 }, (_, i) => ({
    id: "review-p" + i,
    createdAt: at,
    updatedAt: at,
    name: "Review player " + i,
    status: "active",
  }));
  const session = {
    id: "review-s",
    createdAt: at,
    updatedAt: at,
    name: "Review session",
    venue: "Davao",
    courtCount: courts,
    continuous: false,
    playerIds: players.map((p) => p.id),
    status: mode === "draft" ? "draft" : "active",
    startedAt: mode === "draft" ? undefined : at - 120000,
    attendance: Object.fromEntries(
      players.map((p) => [p.id, [{ action: "check-in", at: at - 120000 }]]),
    ),
  };
  const matches =
    mode === "draft"
      ? []
      : Array.from({ length: mode === "completed" ? 1 : courts }, (_, i) => ({
          id: "review-m" + i,
          createdAt: at - 60000,
          updatedAt: at,
          sessionId: session.id,
          courtId: "review-c" + i,
          teamA: players.slice(i * 4, i * 4 + 2).map((p) => p.id),
          teamB: players.slice(i * 4 + 2, i * 4 + 4).map((p) => p.id),
          status: mode,
          ...(mode === "completed"
            ? { winner: "A", scoreA: 6, scoreB: 3, endedAt: at - 1000 }
            : {}),
        }));
  const backup = {
    app: "paddlebai",
    formatVersion: 1,
    schemaVersion: 5,
    exportedAt: new Date().toISOString(),
    players,
    groups: [],
    sessions: [session],
    courts: Array.from({ length: courts }, (_, i) => ({
      id: "review-c" + i,
      createdAt: at,
      updatedAt: at,
      sessionId: session.id,
      number: i + 1,
      reservationStart: at - 3600000,
      reservationEnd: at + 3600000,
    })),
    matches,
  };
  await page.getByLabel("Choose backup to restore").setInputFiles({
    name: "review.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByText("Restore complete.", { exact: false }),
  ).toBeVisible();
}

test("match drafts survive court switching and refresh; consecutive matches start empty", async ({
  page,
  context,
}) => {
  await seed(page);
  let court1 = page.locator(".court-card").nth(0);
  let court2 = page.locator(".court-card").nth(1);
  await court1.getByLabel("Team A score").fill("6");
  await court1.getByLabel("Team B score").fill("3");
  await expect(court1.getByRole("status")).toHaveText(
    "Score saved on this device.",
  );
  await court2.getByLabel("Team A score").fill("2");
  await court2.getByLabel("Team B score").fill("1");
  await expect(court2.getByRole("status")).toHaveText(
    "Score saved on this device.",
  );
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Courts", exact: true })
    .click();
  await expect(court1.getByLabel("Team A score")).toHaveValue("6");
  await expect(court2.getByLabel("Team A score")).toHaveValue("2");
  await page.reload();
  await expect(court1.getByLabel("Team B score")).toHaveValue("3");
  await expect(court2.getByLabel("Team B score")).toHaveValue("1");
  await court1
    .getByRole("button", { name: "Team A wins", exact: true })
    .click();
  await expect(court1.getByText("Team A won 6 – 3")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Play", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resume rotation", exact: true })
    .click();
  await expect(court1.getByLabel("Team A score")).toHaveValue("");
  await expect(court1.getByLabel("Team B score")).toHaveValue("");
  await expect(court2.getByLabel("Team B score")).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "Resume rotation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("No court is free right now.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Ready for offline play", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(court2.getByLabel("Team A score")).toHaveValue("2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("menu closes with Escape, outside tap, destinations and route changes", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Open secondary menu" });
  await button.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu")).toHaveCount(0);
  await expect(button).toBeFocused();
  await button.click();
  await page.mouse.click(380, 600);
  await expect(page.locator(".menu")).toHaveCount(0);
  await button.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "History", exact: true })
    .click();
  await expect(page.locator(".menu")).toHaveCount(0);
  await button.click();
  await page.getByRole("link", { name: "Snaps · Coming later" }).click();
  await expect(page.locator(".menu")).toHaveCount(0);
  await button.click();
  await page.getByRole("link", { name: "PaddleBai", exact: true }).click();
  await expect(page.locator(".menu")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New session", exact: true }),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Snaps" }),
  ).toHaveCount(0);
});

test("About header stays visible on short narrow screens and contains version and support", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "About the Developer", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Meet the Developer" });
  await panel
    .getByRole("button", { name: "Copy GCash Number" })
    .scrollIntoViewIfNeeded();
  const close = await panel
    .getByRole("button", { name: "Close About the Developer" })
    .boundingBox();
  const bounds = await panel.boundingBox();
  expect(close!.y).toBeGreaterThanOrEqual(bounds!.y);
  expect(close!.y + close!.height).toBeLessThan(bounds!.y + bounds!.height);
  await expect(panel.getByText("Version 1.0.0")).toHaveCount(1);
  await expect(panel).toContainText("never required");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/audit-about-short.png",
    animations: "disabled",
  });
  await panel
    .getByRole("button", { name: "Close About the Developer" })
    .click();
  await expect(panel).not.toBeVisible();
});

test("court setup offers only a court count", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New session", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("Court Setup", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Reservation date")).toHaveCount(0);
  await expect(panel.getByLabel("Court number", { exact: true })).toHaveCount(
    0,
  );
  await panel.getByLabel("Available Courts", { exact: true }).fill("1");
  await expect(
    panel.getByLabel("Available Courts", { exact: true }),
  ).toHaveValue("1");
  await panel.getByLabel("Available Courts", { exact: true }).fill("4");
  await expect(panel.getByLabel("Start", { exact: true })).toHaveCount(0);
});

test("navigation and About remain usable on tablet, desktop and enlarged text", async ({
  page,
}) => {
  await page.goto("/");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("button", { name: "New session", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 664 });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page
    .getByRole("button", { name: "About the Developer", exact: true })
    .click();
  const panel = page.getByRole("dialog");
  await panel
    .getByRole("button", { name: "Copy GCash Number" })
    .scrollIntoViewIfNeeded();
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await panel
    .getByRole("button", { name: "Close About the Developer" })
    .click();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("player and group removal ask before changing saved records", async ({
  page,
}) => {
  await page.goto("/players/");
  await page.getByRole("button", { name: "Add player", exact: true }).click();
  await page.getByLabel("Player name").fill("Keep this player");
  await page.getByRole("button", { name: "Save player", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Keep this player/ }).click();
  const panel = page.getByRole("dialog");
  await panel
    .getByRole("button", { name: "Remove player", exact: true })
    .click();
  await expect(
    panel.getByRole("region", { name: "Remove player confirmation" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Keep player", exact: true }).click();
  await panel.getByRole("button", { name: "Close player details" }).click();
  await expect(
    page.getByRole("button", { name: /Keep this player/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page.getByLabel("Group name", { exact: true }).fill("Keep this group");
  await page.getByRole("button", { name: "Save group", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage Keep this group", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete group (keep players)", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Delete group confirmation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep group", exact: true }).click();
  await page
    .getByRole("button", { name: "Close group editor", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Manage Keep this group", exact: true }),
  ).toBeVisible();
});

test("correct result and undo update standings without adding games", async ({
  page,
}) => {
  await seed(page, "completed", 1);
  await page
    .getByRole("button", { name: "Correct Result", exact: true })
    .click();
  await page.getByLabel("Winning team").selectOption("B");
  await page.getByLabel("Corrected Team A score").fill("3");
  await page.getByLabel("Corrected Team B score").fill("6");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Team B won 3 – 6")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Leaderboard", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("button", { name: /Review player 0/ }) });
  await expect(row.locator("td").nth(1)).toHaveText("1");
  await expect(row.locator("td").nth(2)).toHaveText("0");
  await expect(row.locator("td").nth(3)).toHaveText("1");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Play", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo correction" }).click();
  await expect(page.getByText("Team A won 6 – 3")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Undo correction" }),
  ).toHaveCount(0);
});

test("eligible-only assignment, disabled generation, readable dates and backup timestamp", async ({
  page,
}) => {
  await seed(page, "draft", 1);
  for (let i = 0; i < 5; i++) {
    const row = page
      .locator(".roster-row")
      .filter({ hasText: "Review player " + i });
    await row.getByRole("button", { name: "Check out", exact: true }).click();
    await expect(row.getByText("Checked Out", { exact: true })).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume rotation", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Check in at least four ready players", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manual assignment" }).click();
  const form = page.locator(".court-card form");
  await expect(
    form.getByRole("button", { name: "Assign match", exact: true }),
  ).toBeDisabled();
  await expect(form.locator("select").first().locator("option")).toHaveCount(4);
  await form.getByLabel("Player 1").selectOption("review-p5");
  await expect(
    form.getByLabel("Player 2").locator('option[value="review-p5"]'),
  ).toHaveCount(0);
  const row = page
    .locator(".roster-row")
    .filter({ hasText: "Review player 5" });
  await row
    .getByLabel("Availability for Review player 5")
    .selectOption("resting");
  await expect(row.getByText("Resting", { exact: true })).toBeVisible();
  await expect(
    form.getByLabel("Player 2").locator('option[value="review-p5"]'),
  ).toHaveCount(0);
  expect(
    await page.locator(".court-card .card-top").first().innerText(),
  ).not.toContain("?");
  await row.getByText("Attendance history", { exact: true }).click();
  expect(await row.locator("details").innerText()).not.toContain("?");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  await expect(
    page.getByText("Last backup exported:", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Last backup exported:", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/audit-dashboard-short.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("small court timers recover independently, stop on results and reset for new matches", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-12T10:00:00Z") });
  await seed(page);
  await expect(page.locator(".court-match-timer")).toHaveCount(2);
  await expect(page.locator(".court-match-timer").first()).toHaveText("01:00");
  await page.clock.fastForward(125000);
  await expect(page.locator(".court-match-timer").first()).toHaveText("03:05");
  await page.getByRole("link", { name: "Courts", exact: true }).last().click();
  await expect(page.locator(".court-match-timer").first()).toHaveText("03:05");
  await page.reload();
  await expect(page.locator(".court-match-timer").first()).toHaveText("03:05");
  await page
    .locator(".court-card")
    .first()
    .getByRole("button", { name: "Team A wins" })
    .click();
  await expect(page.locator(".court-match-timer")).toHaveCount(1);
  await expect(
    page.getByText("Duration: 03:05", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(10000);
  await expect(page.locator(".court-match-timer")).toHaveText("03:15");
  await expect(
    page.getByText("Duration: 03:05", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume rotation" }).click();
  await expect(page.locator(".court-match-timer")).toHaveCount(2);
  await expect(page.locator(".court-match-timer").first()).toHaveText("00:00");
  await expect(page.locator(".court-match-timer").last()).toHaveText("03:15");
});

test("four unscheduled courts start, remember count and end into the recap", async ({
  page,
}) => {
  await seed(page, "playing", 1);
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(page).toHaveURL(/history.*session=/);
  await page.getByRole("link", { name: "Play", exact: true }).last().click();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  const panel = page.getByRole("dialog");
  await panel.getByLabel("Session name").fill("Simple four courts");
  await panel.getByLabel("Available Courts", { exact: true }).fill("4");
  await panel.getByRole("checkbox").first().check();
  // Select the existing crew without introducing any scheduling fields.
  for (const checkbox of await panel.getByRole("checkbox").all())
    await checkbox.check();
  await panel
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start session", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check in", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".court-card")).toHaveCount(4);
  await expect(page.locator(".court-match-timer")).toHaveCount(2);
  await expect(
    page.locator(".court-card").getByText("Extend reservation 30 min"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "End session", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End session", exact: true })
    .click();
  await expect(page).toHaveURL(/history.*session=/);
  await expect(
    page.getByRole("heading", { name: "Simple four courts" }),
  ).toBeVisible();
  await expect(page.locator(".court-match-timer")).toHaveCount(0);
  await page.getByRole("link", { name: "Play", exact: true }).last().click();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Available Courts", { exact: true }),
  ).toHaveValue("4");
});
