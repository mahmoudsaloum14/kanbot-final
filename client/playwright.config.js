import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 4,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:49186",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  globalSetup: "./e2e/global-setup.js",
});
