import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  },
  webServer: [
    {
      command: "node --import tsx scripts/test-backend.ts",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command:
        process.env.E2E_PRODUCTION === "true"
          ? "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001"
          : "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3001",
      url: "http://127.0.0.1:3001/admin",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_ORIGIN: "http://127.0.0.1:3001",
        SUPABASE_URL: "http://127.0.0.1:54329",
        SUPABASE_PUBLISHABLE_KEY: "test-publishable",
        SUPABASE_SECRET_KEY: "test-secret",
        DEPLOYMENT_ENV: "staging",
        ENABLE_TEST_CHECKOUT: "true",
        CRON_SECRET: "local-e2e-cron-secret-at-least-thirty-two-characters",
      },
    },
  ],
});
