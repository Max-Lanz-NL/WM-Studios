import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { assertLocalUrl } from "./scripts/local-config.mjs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (process.env.APP_ENV !== "local" || !process.env.SUPABASE_URL)
  throw new Error("Voer eerst npm run local:provision uit.");
assertLocalUrl(process.env.SUPABASE_URL);
export default defineConfig({
  testDir: "./e2e-local",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:3002",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
  },
  webServer: {
    command: "npm run dev -- --port 3002",
    url: "http://127.0.0.1:3002",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      APP_ENV: "local",
      APP_ORIGIN: "http://127.0.0.1:3002",
      SUPABASE_URL: process.env.SUPABASE_URL!,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY!,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY!,
    },
  },
});
