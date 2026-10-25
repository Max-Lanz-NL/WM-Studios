import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  },
  webServer: [
    {
      command: "node --import tsx e2e/support/supabase-fixture.ts",
      url: "http://127.0.0.1:54329",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: "npm run dev -- --port 3001",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_ENV: "local",
        APP_ORIGIN: "http://127.0.0.1:3001",
        SUPABASE_URL: "http://127.0.0.1:54329",
        SUPABASE_PUBLISHABLE_KEY: "e2e-public-key",
        SUPABASE_SECRET_KEY: "e2e-service-key",
      },
    },
  ],
});
