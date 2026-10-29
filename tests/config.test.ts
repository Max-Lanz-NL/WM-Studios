import { afterEach, it, expect, vi } from "vitest";
import { configuration } from "../src/lib/config";
afterEach(() => vi.unstubAllEnvs());
it("weigert een productieomgeving", () => {
  vi.stubEnv("APP_ENV", "production");
  expect(() => configuration()).toThrow("Productie");
});
it("weigert een externe database in lokale modus", () => {
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("SUPABASE_URL", "https://unrelated.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-key");
  expect(() => configuration()).toThrow("Lokale");
});
it("vereist een expliciet overeenkomende stagingref", () => {
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("SUPABASE_URL", "https://wrong.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-key");
  vi.stubEnv("SUPABASE_STAGING_PROJECT_REF", "correct");
  expect(() => configuration()).toThrow("projectref");
  vi.stubEnv("SUPABASE_URL", "https://correct.supabase.co");
  expect(configuration().environment).toBe("staging");
});
