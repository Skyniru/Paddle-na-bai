import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("all routes work offline; photo backups preview, validate, restore and recover active play after closing", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const at = Date.now();
  const photo =
    "data:image/png;base64," +
    readFileSync("public/icons/icon-192.png").toString("base64");
  const players = Array.from({ length: 4 }, (_, i) => ({
    id: "p" + i,
    createdAt: at,
    updatedAt: at,
    name: "Offline player " + i,
    status: "active",
    photo: i === 0 ? photo : undefined,
  }));
  const fixture = {
    app: "paddlebai",
    formatVersion: 1,
    schemaVersion: 5,
    exportedAt: new Date(at).toISOString(),
    players,
    groups: [
      {
        id: "g",
        createdAt: at,
        updatedAt: at,
        name: "Offline crew",
        playerIds: players.map((p) => p.id),
        photo,
      },
    ],
    sessions: [],
    courts: [],
    matches: [],
  };
  async function choose(value: unknown) {
    await page.getByLabel("Choose backup to restore").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(value)),
    });
  }
  await page.goto("/players/");
  await expect(
    page.getByText("Ready for offline play", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await choose(fixture);
  await expect(
    page.getByRole("region", { name: "Restore preview" }),
  ).toContainText("2 photos");
  await expect(page.locator(".player-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(page.locator(".player-card")).toHaveCount(4);
  await expect(page.locator(".group-card img")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const path = await (await downloaded).path();
  const roundTrip = JSON.parse(readFileSync(path!, "utf8"));
  expect(roundTrip.players[0].photo).toBe(photo);
  expect(roundTrip.groups[0].photo).toBe(photo);
  await choose({
    ...roundTrip,
    groups: [{ ...fixture.groups[0], playerIds: ["missing"] }],
  });
  await expect(
    page.getByText("Invalid or unsupported backup.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".player-card")).toHaveCount(4);
  await choose({
    ...roundTrip,
    players: [
      { ...players[0], photo: "data:image/png;base64,YWJj" },
      ...players.slice(1),
    ],
  });
  await expect(
    page.getByText("Backup contains an unreadable photo.", { exact: true }),
  ).toBeVisible();
  await choose(roundTrip);
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByText("Restore complete.", { exact: false }),
  ).toBeVisible();
  const session = {
    id: "s",
    createdAt: at,
    updatedAt: at,
    name: "Recovered game",
    venue: "Cebu",
    courtCount: 1,
    continuous: false,
    playerIds: players.map((p) => p.id),
    status: "active",
    startedAt: at - 60000,
    attendance: Object.fromEntries(
      players.map((p) => [p.id, [{ action: "check-in", at }]]),
    ),
    round: 1,
  };
  const active = {
    ...fixture,
    sessions: [session],
    courts: [
      { id: "c", createdAt: at, updatedAt: at, sessionId: "s", number: 1 },
    ],
    matches: [
      {
        id: "m",
        createdAt: at,
        updatedAt: at,
        sessionId: "s",
        courtId: "c",
        teamA: ["p0", "p1"],
        teamB: ["p2", "p3"],
        status: "playing",
      },
    ],
  };
  await choose(active);
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByText("Restore complete.", { exact: false }),
  ).toBeVisible();
  await context.setOffline(true);
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto("/");
  await expect(
    reopened.getByText("Recovered game", { exact: true }),
  ).toBeVisible();
  await expect(reopened.getByText("● Playing", { exact: true })).toBeVisible();
  await expect(
    reopened.getByText("Your session is saved on this device", {
      exact: false,
    }),
  ).toBeVisible();
  for (const route of [
    "courts",
    "leaderboard",
    "snaps",
    "history",
    "players",
  ]) {
    await reopened.goto("/" + route + "/");
    await expect(reopened.locator("main h1").first()).toBeVisible();
    await expect(
      reopened.getByText("Ready for offline play", { exact: true }),
    ).toBeVisible();
  }
  await expect(reopened.locator(".group-card img")).toBeVisible();
  expect(
    await reopened
      .locator(".group-card img")
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
  ).toBe(true);
  await reopened.locator(".bottom-nav a").first().click();
  await expect(
    reopened.getByText("Recovered game", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("navigation matches the dark body and keeps a readable selected pill", async ({
  page,
}) => {
  await page.goto("/");
  expect(
    await page
      .locator(".header")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  expect(
    await page
      .locator(".header")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(23, 28, 25)");
  expect(
    await page
      .locator(".bottom-nav")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(23, 28, 25)");
  await expect(page.locator(".developer-button-dock")).toHaveCSS("background-color", "rgb(23, 28, 25)");
  await expect(page.locator(".header-actions .icon-button").first()).toHaveCSS("color", "rgb(241, 245, 242)");
  const selected = page.locator(".bottom-nav a[aria-current='page']");
  expect(await selected.evaluate((el) => getComputedStyle(el).color)).toBe(
    "rgb(255, 255, 255)",
  );
  await page.screenshot({
    path: "test-results/dark-green-navigation.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(
    page.locator(".desktop-nav a[aria-current='page']"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-dark-theme.png",
    fullPage: true,
  });
});
