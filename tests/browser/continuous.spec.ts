import { test, expect, chromium, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

async function seed(page: Page, completed = false, count = 16) {
  await page.goto("/players/");
  const at = await page.evaluate(() => Date.now());
  const players = Array.from({ length: count }, (_, i) => ({
    id: "auto-p" + i,
    createdAt: at,
    updatedAt: at,
    name: "Queue player " + String(i + 1).padStart(2, "0"),
    status: "active",
  }));
  const photo =
    "data:image/png;base64," +
    readFileSync("public/icons/icon-192.png").toString("base64");
  const session = {
    id: "auto-session",
    createdAt: at,
    updatedAt: at,
    name: "Saturday open play",
    venue: "Cebu Pickleball Club",
    courtCount: 2,
    playerIds: players.map((p) => p.id),
    status: completed ? "completed" : "active",
    continuous: true,
    mode: "fair",
    startedAt: at - 3600000,
    ...(completed ? { endedAt: at, elapsedDuration: 3600000 } : {}),
    bannerPhoto: photo,
    attendance: Object.fromEntries(
      players.map((p) => [p.id, [{ action: "check-in", at: at - 3600000 }]]),
    ),
    queue: completed
      ? { upNext: [], standby: [] }
      : {
          upNext: players.slice(8, 12).map((p) => p.id),
          standby: players.slice(12).map((p) => p.id),
        },
  };
  const matches = Array.from({ length: 2 }, (_, i) => ({
    id: "auto-match" + i,
    createdAt: at - 60000,
    updatedAt: at,
    sessionId: session.id,
    courtId: "auto-court" + i,
    teamA: players.slice(i * 4, i * 4 + 2).map((p) => p.id),
    teamB: players.slice(i * 4 + 2, i * 4 + 4).map((p) => p.id),
    status: completed ? "completed" : "playing",
    ...(completed ? { endedAt: at, winner: "A", scoreA: 6, scoreB: 3 } : {}),
  }));
  await page.getByLabel("Choose backup to restore").setInputFiles({
    name: "automatic.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        app: "paddlebai",
        formatVersion: 1,
        schemaVersion: 5,
        exportedAt: new Date(at).toISOString(),
        players,
        groups: [],
        sessions: [session],
        courts: [0, 1].map((i) => ({
          id: "auto-court" + i,
          createdAt: at,
          updatedAt: at,
          sessionId: session.id,
          number: i + 1,
        })),
        matches,
      }),
    ),
  });
  await page.getByRole("button", { name: "Confirm replacement" }).click();
  await expect(
    page.getByText("Restore complete.", { exact: false }),
  ).toBeVisible();
  await page.goto(completed ? "/history/?session=auto-session" : "/");
}

test("desktop results use binary PNG writes and handle save cancellation and write errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = {
      signature: [] as number[],
      path: "",
      fail: false,
      cancel: false,
    };
    Object.assign(window, {
      isTauri: true,
      pngSave: state,
      __TAURI_INTERNALS__: {
        invoke: async (
          command: string,
          args: Uint8Array,
          options: { headers: { path: string } },
        ) => {
          if (command === "plugin:dialog|save")
            return state.cancel ? null : "C:\\selected-results.png";
          if (command === "plugin:fs|write_file") {
            if (state.fail) throw Error("Native PNG write failed.");
            state.signature = [...args.slice(0, 8)];
            state.path = decodeURIComponent(options.headers.path);
            return;
          }
          throw Error("Unexpected native command: " + command);
        },
      },
    });
  });
  await seed(page, true, 8);
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "All 8 players are included" }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      (window as unknown as { pngSave: { signature: number[]; path: string } })
        .pngSave,
  );
  expect(saved.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(saved.path).toBe("C:\\selected-results.png");
  await page.evaluate(() => {
    (window as unknown as { pngSave: { cancel: boolean } }).pngSave.cancel =
      true;
  });
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saving cancelled." }),
  ).toBeVisible();
  await page.evaluate(() => {
    const state = (
      window as unknown as { pngSave: { cancel: boolean; fail: boolean } }
    ).pngSave;
    state.cancel = false;
    state.fail = true;
  });
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Native PNG write failed." }),
  ).toBeVisible();
});

test("confirmed queue and score draft survive a full browser shutdown and offline reopen", async () => {
  mkdirSync("test-results", { recursive: true });
  const profile = mkdtempSync(join(resolve("test-results"), "queue-reopen-"));
  let browser = await chromium.launchPersistentContext(profile, {
    headless: true,
    baseURL: "http://localhost:3100",
  });
  try {
    let page = await browser.newPage();
    await seed(page);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const names = await page
      .getByRole("list", { name: "Up Next players" })
      .locator("li > span:last-child")
      .allTextContents();
    await page
      .locator(".court-card")
      .first()
      .getByLabel("Team A score")
      .fill("6");
    await expect(page.locator(".court-card").first()).toContainText(
      "Score saved on this device.",
    );
    await browser.close();
    browser = await chromium.launchPersistentContext(profile, {
      headless: true,
      offline: true,
      baseURL: "http://localhost:3100",
    });
    page = await browser.newPage();
    await page.goto("/");
    await expect(
      page
        .getByRole("list", { name: "Up Next players" })
        .locator("li > span:last-child"),
    ).toHaveText(names);
    await expect(page.locator(".court-match-timer")).toHaveCount(2);
    await expect(
      page.locator(".court-card").first().getByLabel("Team A score"),
    ).toHaveValue("6");
  } finally {
    await browser.close();
  }
});

test("confirmed Up Next survives clocks, scores, navigation and offline reload; one court reassigns independently", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date("2026-10-12T10:00:00Z") });
  await seed(page);
  const next = page.getByRole("list", { name: "Up Next players" });
  const original = (await next.textContent())!;
  const otherNames = await page
    .locator(".court-card")
    .nth(1)
    .locator(".team strong")
    .allTextContents();
  await expect(
    page.getByRole("button", { name: "Generate Next Round" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Resume rotation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Check in", exact: true }),
  ).toHaveCount(0);
  await page.clock.fastForward(45000);
  await expect(next).toHaveText(original);
  await page
    .locator(".court-card")
    .first()
    .getByLabel("Team A score")
    .fill("6");
  await page
    .locator(".court-card")
    .first()
    .getByLabel("Team B score")
    .fill("3");
  await expect(next).toHaveText(original);
  await page.getByRole("link", { name: "Players", exact: true }).last().click();
  await page.getByRole("link", { name: "Play", exact: true }).last().click();
  await expect(next).toHaveText(original);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(next).toHaveText(original);
  await page
    .locator(".court-card")
    .first()
    .getByRole("button", { name: "Team A wins" })
    .click();
  await expect(
    page.locator(".court-card").first().locator(".team strong"),
  ).toHaveText([
    "Queue player 09",
    "Queue player 10",
    "Queue player 11",
    "Queue player 12",
  ]);
  expect(
    await page
      .locator(".court-card")
      .nth(1)
      .locator(".team strong")
      .allTextContents(),
  ).toEqual(otherNames);
  await expect(
    page.locator(".court-card").first().getByLabel("Team A score"),
  ).toHaveValue("");
  await expect(next).not.toHaveText(original);
  await page.screenshot({
    path: "test-results/continuous-live.png",
    fullPage: true,
  });
});

test("offline PNG export contains real results, photo and every player across image pages", async ({
  page,
  context,
}) => {
  await seed(page, true, 25);
  await expect(
    page.getByRole("img", { name: "Session photo for Saturday open play" }),
  ).toBeVisible();
  const podium = page.getByLabel("Top three podium");
  await expect(podium.locator(".podium-place")).toHaveCount(3);
  expect(await podium.locator(".podium-place span").allTextContents()).toEqual([
    "2nd place",
    "1st place",
    "3rd place",
  ]);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
    const original = CanvasRenderingContext2D.prototype.fillText;
    const rendered: string[] = [];
    (window as unknown as { rendered: string[] }).rendered = rendered;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      maxWidth,
    ) {
      rendered.push(text);
      return maxWidth === undefined
        ? original.call(this, text, x, y)
        : original.call(this, text, x, y, maxWidth);
    };
  });
  const downloads: import("@playwright/test").Download[] = [];
  page.on("download", (download) => downloads.push(download));
  await page
    .getByRole("button", { name: "Share Results", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "All 25 players are included" }),
  ).toBeVisible();
  await expect.poll(() => downloads.length).toBe(3);
  for (const download of downloads) {
    const path = await download.path();
    expect(readFileSync(path!).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  }
  await downloads[0].saveAs("test-results/results-export-page-1.png");
  const rendered = await page.evaluate(
    () => (window as unknown as { rendered: string[] }).rendered,
  );
  for (let i = 1; i <= 25; i++)
    expect(rendered).toContain("Queue player " + String(i).padStart(2, "0"));
  expect(rendered).toContain("Saturday open play");
  expect(rendered).toContain("Cebu Pickleball Club");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: string[] }).shared = data.files!.map(
          (file) => file.name,
        );
      },
    });
  });
  await page
    .getByRole("button", { name: "Share Results", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Results shared." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { shared: string[] }).shared.length,
    ),
  ).toBe(3);
  expect(downloads.length).toBe(3);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Cancelled", "AbortError");
      },
    }),
  );
  await page
    .getByRole("button", { name: "Share Results", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sharing cancelled." }),
  ).toBeVisible();
  expect(downloads.length).toBe(3);
});
