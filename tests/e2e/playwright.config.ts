import { defineConfig } from "@playwright/test";
import { resolveE2eBaseUrl } from "../support/browser-chain.js";

const BASE_URL = resolveE2eBaseUrl();

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  // The launcher script preconfigures an isolated data dir and port before Playwright connects.
  webServer: {
    command: "node ../../scripts/playwright/e2e-webserver.mjs",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  outputDir: "./test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
});
