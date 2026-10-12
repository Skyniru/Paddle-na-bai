import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
  },
  webServer: {
    command: "node scripts/serve.cjs 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
  },
  reporter: "list",
});
