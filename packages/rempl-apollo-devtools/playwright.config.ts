import { defineConfig, devices } from "@playwright/test";

const TEST_TIMEOUT_MS = 60_000;

export default defineConfig({
  testDir: "./e2e",
  timeout: TEST_TIMEOUT_MS,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "node scripts/playground.js && yarn workspace graphql-playground start --host 127.0.0.1 --port 4173",
    cwd: __dirname,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
