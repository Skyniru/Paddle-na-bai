import { test, expect } from "@playwright/test";
test("desktop bridge disables PWA installation and reports save-dialog cancellation", async ({
  page,
}) => {
  // Browser mock only: this does not test a compiled Tauri window or filesystem permission.
  await page.addInitScript(() => {
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string) => {
          if (command === "plugin:dialog|save") return null;
          throw Error("Unexpected mocked native command: " + command);
        },
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("Desktop app · bundled for offline play", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Install guidance" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  await expect(
    page.getByText("Backup export cancelled.", { exact: true }),
  ).toBeVisible();
});

test("desktop export bridge sends portable backup bytes to the selected path and handles write failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { payload: "", path: "", fail: false };
    Object.assign(window, {
      isTauri: true,
      desktopTest: state,
      __TAURI_INTERNALS__: {
        invoke: async (
          command: string,
          args: Uint8Array,
          options: { headers: { path: string } },
        ) => {
          if (command === "plugin:dialog|save")
            return "C:\\selected-backup.json";
          if (command === "plugin:fs|write_text_file") {
            if (state.fail) throw Error("Native backup write failed.");
            state.payload = new TextDecoder().decode(args);
            state.path = decodeURIComponent(options.headers.path);
            return;
          }
          throw Error("Unexpected mocked native command: " + command);
        },
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  await expect(
    page.getByText("Backup saved. Keep the file somewhere safe.", {
      exact: true,
    }),
  ).toBeVisible();
  const captured = await page.evaluate(
    () =>
      (window as unknown as { desktopTest: { payload: string; path: string } })
        .desktopTest,
  );
  expect(captured.path).toBe("C:\\selected-backup.json");
  expect(JSON.parse(captured.payload)).toMatchObject({
    app: "paddlebai",
    formatVersion: 1,
    schemaVersion: 5,
    players: [],
    sessions: [],
    matches: [],
  });
  await page.evaluate(() => {
    (window as unknown as { desktopTest: { fail: boolean } }).desktopTest.fail =
      true;
  });
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  await expect(
    page.getByText("Native backup write failed.", { exact: true }),
  ).toBeVisible();
});
