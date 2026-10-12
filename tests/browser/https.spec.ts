import { test, expect, chromium } from "@playwright/test";
import { existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import https from "node:https";

test("production HTTPS serves install assets and offline routes in desktop Chromium", async () => {
  const openssl = "C:/Program Files/Git/usr/bin/openssl.exe";
  test.skip(
    !existsSync(openssl),
    "Local OpenSSL unavailable; trusted phone setup remains documented.",
  );
  mkdirSync("test-results", { recursive: true });
  const directory = mkdtempSync(join(resolve("test-results"), "https-test-"));
  const cert = join(directory, "cert.pem"),
    key = join(directory, "key.pem");
  const generated = spawnSync(
    openssl,
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    { windowsHide: true, encoding: "utf8" },
  );
  expect(generated.status, generated.stderr).toBe(0);
  const server = spawn(
    process.execPath,
    ["scripts/https.cjs", cert, key, "3444"],
    { windowsHide: true, stdio: "ignore" },
  );
  // This self-signed test certificate is not an iPhone-trusted certificate.
  // Browser-wide allowance is necessary for SW fetches with this disposable test cert.
  // Normal phone installation requires mkcert trust, never this bypass.
  const browser = await chromium.launch({
    args: ["--ignore-certificate-errors"],
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    await expect
      .poll(
        () =>
          new Promise<number>((resolveStatus) => {
            https
              .get(
                "https://localhost:3444/manifest.webmanifest",
                { rejectUnauthorized: false },
                (response) => {
                  resolveStatus(response.statusCode || 0);
                  response.resume();
                },
              )
              .on("error", () => resolveStatus(0));
          }),
      )
      .toBe(200);
    const page = await context.newPage();
    await page.goto("https://localhost:3444/");
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
    await expect(
      page.getByText("Ready for offline play", { exact: true }),
    ).toBeVisible();
    await context.setOffline(true);
    await page.goto("https://localhost:3444/players/");
    await expect(
      page.getByRole("heading", { name: "Meet your crew." }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Meet your crew." }),
    ).toBeVisible();
  } finally {
    await context.close();
    await browser.close();
    const stopped = new Promise<void>((resolveStopped) =>
      server.once("exit", () => resolveStopped()),
    );
    if (server.exitCode === null) {
      server.kill();
      await stopped;
    }
  }
});
