import { test, expect, chromium } from "@playwright/test";
import { mkdtempSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

test("active session, attendance, scores and photos survive a full browser shutdown and offline relaunch", async () => {
  mkdirSync("test-results", { recursive: true });
  const profile = mkdtempSync(
    join(resolve("test-results"), "relaunch-profile-"),
  );
  const origin = "http://localhost:3100";
  let browser = await chromium.launchPersistentContext(profile, {
    headless: true,
  });
  try {
    let page = await browser.newPage();
    await page.goto(origin + "/players/");
    await expect(
      page.getByText("Ready for offline play", { exact: true }),
    ).toBeVisible();
    const at = Date.now();
    const photo =
      "data:image/png;base64," +
      readFileSync("public/icons/icon-192.png").toString("base64");
    const players = Array.from({ length: 4 }, (_, i) => ({
      id: "persist-p" + i,
      createdAt: at,
      updatedAt: at,
      name: "Saved player " + i,
      status: "active",
      photo,
    }));
    const session = {
      id: "persist-s",
      createdAt: at,
      updatedAt: at,
      name: "Persistent session",
      venue: "Cebu",
      courtCount: 1,
    continuous: false,
      playerIds: players.map((p) => p.id),
      status: "active",
      startedAt: at - 120000,
      round: 2,
      attendance: Object.fromEntries(
        players.map((p) => [p.id, [{ action: "check-in", at: at - 120000 }]]),
      ),
    };
    const match = {
      id: "live",
      createdAt: at,
      updatedAt: at,
      sessionId: session.id,
      courtId: "persist-c",
      teamA: players.slice(0, 2).map((p) => p.id),
      teamB: players.slice(2).map((p) => p.id),
      status: "playing",
    };
    const backup = {
      app: "paddlebai",
      formatVersion: 1,
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      players,
      groups: [],
      sessions: [session],
      courts: [
        {
          id: "persist-c",
          createdAt: at,
          updatedAt: at,
          sessionId: session.id,
          number: 1,
        },
      ],
      matches: [
        {
          ...match,
          id: "previous",
          createdAt: at - 60000,
          endedAt: at - 1000,
          status: "completed",
          winner: "A",
          scoreA: 6,
          scoreB: 3,
        },
        match,
      ],
    };
    await page.getByLabel("Choose backup to restore").setInputFiles({
      name: "recovery.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.getByRole("button", { name: "Confirm replacement" }).click();
    await expect(
      page.getByText("Restore complete.", { exact: false }),
    ).toBeVisible();
    await browser.close();
    browser = await chromium.launchPersistentContext(profile, {
      headless: true,
      offline: true,
    });
    page = await browser.newPage();
    await page.goto(origin + "/");
    await expect(
      page.getByText("Persistent session", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("● Playing", { exact: true })).toBeVisible();
    await expect(page.locator(".timer strong")).not.toHaveText("00:00:00");
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    const restored = JSON.parse(
      readFileSync((await (await download).path())!, "utf8"),
    );
    expect(restored.sessions).toEqual(backup.sessions);
    expect(restored.players).toEqual(backup.players);
    expect(restored.matches).toHaveLength(backup.matches.length);
    expect(restored.matches).toEqual(expect.arrayContaining(backup.matches));
    await page.getByLabel("Team A score").fill("6");
    await page.getByLabel("Team B score").fill("2");
    await page
      .getByRole("button", { name: "Team A wins", exact: true })
      .click();
    await expect(
      page.getByText("Team A won 6 – 2", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Team A won 6 – 2", { exact: true }),
    ).toBeVisible();
  } finally {
    await browser.close();
  }
});
