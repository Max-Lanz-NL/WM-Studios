import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  },
  webServer: {
    command: "npm run dev -- --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    env: {
      APP_MODE: "demo",
      ADMIN_PASSWORD: "local-e2e-test-password-only",
      SESSION_SECRET: "local-e2e-test-secret-at-least-thirty-two-characters",
      DATABASE_PATH:
        process.env.E2E_DATABASE_PATH || `./data/e2e-${randomUUID()}.sqlite`,
    },
    timeout: 120000,
  },
});
