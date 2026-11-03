import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "node:util";
import {
  assertLocalUrl,
  parseLocalStatus,
  saveLocalEnvironment,
} from "../scripts/local-config.mjs";
it("weigert cloud-URL’s in lokale hulpmiddelen", () => {
  expect(() => assertLocalUrl("https://unrelated.supabase.co")).toThrow(
    "uitsluitend lokaal",
  );
  expect(() => assertLocalUrl("http://127.0.0.1:55321")).not.toThrow();
});
it("controleert de WM-poorten en complete status voordat sleutels worden gebruikt", () => {
  const status = {
    API_URL: "http://127.0.0.1:55321",
    DB_URL: "postgresql://postgres:test@127.0.0.1:55322/postgres",
    ANON_KEY: "test-public",
    SERVICE_ROLE_KEY: "test-service",
  };
  expect(parseLocalStatus(status).secret).toBe("test-service");
  expect(() =>
    parseLocalStatus({ ...status, API_URL: "http://127.0.0.1:54321" }),
  ).toThrow("WM Studio");
  expect(() => parseLocalStatus({ DB_URL: status.DB_URL })).toThrow(
    "Onvolledige",
  );
});
it("bewaart bestaande configuratie en vervangt uitsluitend aangewezen instellingen", () => {
  const file = join(mkdtempSync(join(tmpdir(), "wm-env-")), "test.env");
  writeFileSync(file, "# bestaand\nAPP_ENV = staging\nOTHER_SETTING=keep-me\n");
  saveLocalEnvironment(
    { APP_ENV: "local", LOCAL_MAX_PASSWORD: "only-test=+value" },
    file,
  );
  const actual = parseEnv(readFileSync(file, "utf8"));
  expect(actual).toEqual({
    APP_ENV: "local",
    OTHER_SETTING: "keep-me",
    LOCAL_MAX_PASSWORD: "only-test=+value",
  });
  expect(readFileSync(file, "utf8")).toContain("# bestaand");
});
