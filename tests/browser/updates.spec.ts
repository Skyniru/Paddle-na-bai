import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
test("a new worker waits while app windows remain open and activates after they close", async ({
  page,
  context,
}) => {
  const original = readFileSync("out/sw.js", "utf8");
  const updated = original.replace(
    /const CACHE = "([^"]+)"/,
    'const CACHE = "paddle-update-test"',
  );
  try {
    await page.goto("/");
    await expect(
      page.getByText("Ready for offline play", { exact: true }),
    ).toBeVisible();
    const second = await context.newPage();
    await second.goto("/courts/");
    writeFileSync("out/sw.js", updated);
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg!.update();
    });
    await expect
      .poll(() =>
        page.evaluate(
          async () =>
            (await navigator.serviceWorker.getRegistration())?.waiting?.state,
        ),
      )
      .toBe("installed");
    expect(
      await page.evaluate(async () => {
        const channel = new MessageChannel();
        const result = new Promise<string>((resolve) => {
          channel.port1.onmessage = (event) => {
            resolve(event.data.build);
            channel.port1.close();
          };
        });
        navigator.serviceWorker.controller!.postMessage("STATUS", [
          channel.port2,
        ]);
        return result;
      }),
    ).not.toBe("paddle-update-test");
    await expect(
      page.getByText("Update downloaded.", { exact: false }),
    ).toBeVisible({ timeout: 15000 });
    await page.close();
    expect(
      await second.evaluate(
        async () =>
          (await navigator.serviceWorker.getRegistration())?.waiting?.state,
      ),
    ).toBe("installed");
    await second.close();
    const reopened = await context.newPage();
    await reopened.goto("/");
    await expect
      .poll(() =>
        reopened.evaluate(async () => {
          const channel = new MessageChannel();
          const result = new Promise<string>((resolve) => {
            channel.port1.onmessage = (event) => {
              resolve(event.data.build);
              channel.port1.close();
            };
          });
          if (!navigator.serviceWorker.controller) return "no controller";
          navigator.serviceWorker.controller.postMessage("STATUS", [
            channel.port2,
          ]);
          return result;
        }),
      )
      .toBe("paddle-update-test");
  } finally {
    writeFileSync("out/sw.js", original);
  }
});
