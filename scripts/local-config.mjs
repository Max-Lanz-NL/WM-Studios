import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
/** Read only this checkout's CLI status, with credentials captured in memory. */
export function localStatus() {
  const output = execFileSync(
    process.execPath,
    ["node_modules/supabase/dist/supabase.js", "status", "-o", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 },
  );
  return parseLocalStatus(JSON.parse(output));
}
export function parseLocalStatus(raw) {
  const get = (...names) =>
    names.map((n) => raw[n]).find((v) => typeof v === "string" && v.length);
  const url = get("API_URL", "api_url", "api.url");
  const publishable = get(
    "PUBLISHABLE_KEY",
    "publishable_key",
    "ANON_KEY",
    "anon_key",
  );
  const secret = get(
    "SECRET_KEY",
    "secret_key",
    "SERVICE_ROLE_KEY",
    "service_role_key",
  );
  const database = get("DB_URL", "db_url", "database_url");
  if (!url || !publishable || !secret || !database)
    throw new Error(
      "Onvolledige lokale Supabase-status. Controleer of de WM-stack draait.",
    );
  assertLocalUrl(url);
  assertLocalUrl(database);
  if (new URL(url).port !== "55321" || new URL(database).port !== "55322")
    throw new Error("Lokale status hoort niet bij de WM Studio-poorten.");
  return { url, publishable, secret, database };
}
export function assertLocalUrl(value) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    throw new Error("Deze bewerking is uitsluitend lokaal toegestaan.");
}
/** Preserve other settings; never echo key material. The previous file is backed up. */
export function saveLocalEnvironment(values, file = ".env.local") {
  mkdirSync("data", { recursive: true });
  const old = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (old) copyFileSync(file, `data/env-before-local-${Date.now()}.backup`);
  const entries = Object.entries(values);
  const names = new Set(entries.map(([name]) => name));
  const kept = old
    .split(/\r?\n/)
    .filter(
      (line) =>
        !names.has(
          line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=/)?.[1],
        ),
    )
    .filter(Boolean);
  writeFileSync(
    file,
    [
      ...kept,
      ...entries.map(
        ([name, value]) => `${name}=${JSON.stringify(String(value))}`,
      ),
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
}
