import { afterEach, describe, expect, it, vi } from "vitest";
const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (cookie.value ? { value: cookie.value } : undefined),
  }),
}));
import * as supabase from "../src/lib/supabase";
import { isAdmin, requireAdmin, sameOrigin } from "../src/lib/auth";
import { checkout } from "../src/lib/db";
const input = {
  key: "00000000-0000-4000-8000-000000000001",
  email: "test@example.invalid",
  name: "Test",
  address: "Teststraat 1",
  items: [],
};
afterEach(() => {
  cookie.value = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("server security and configuration", () => {
  it("fails closed without configuration, without exposing values", () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect(() => supabase.database()).toThrow(
      "Configuratie ontbreekt: SUPABASE_URL",
    );
    vi.stubEnv("SUPABASE_URL", "not-a-url-secret-value");
    expect(() => supabase.database()).toThrow(
      "Ongeldige configuratie: SUPABASE_URL",
    );
    vi.stubEnv("SUPABASE_URL", "http://example.com");
    expect(() => supabase.database()).toThrow("HTTPS");
  });
  it("requires a server-verified role, ignores user_metadata and forged tokens", async () => {
    expect(await isAdmin()).toBe(false);
    cookie.value = "forged-token";
    const getUser = vi
      .fn()
      .mockResolvedValue({ error: new Error("invalid"), data: { user: null } });
    vi.spyOn(supabase, "database").mockReturnValue({
      auth: { getUser },
    } as unknown as ReturnType<typeof supabase.database>);
    expect(await isAdmin()).toBe(false);
    await expect(requireAdmin()).rejects.toThrow("UNAUTHORIZED");
    getUser.mockResolvedValue({
      error: null,
      data: {
        user: {
          user_metadata: { role: "admin" },
          app_metadata: { role: "member" },
        },
      },
    });
    expect(await isAdmin()).toBe(false);
    getUser.mockResolvedValue({
      error: null,
      data: { user: { app_metadata: { role: "admin" } } },
    });
    expect(await isAdmin()).toBe(true);
    expect(getUser).toHaveBeenCalledWith("forged-token");
  });
  it("blocks missing/cross-site origins and ignores attacker Host headers", () => {
    vi.stubEnv("APP_ORIGIN", "https://shop.example");
    expect(() =>
      sameOrigin(
        new Request("https://shop.example/api/admin", {
          headers: { origin: "https://evil.example", host: "evil.example" },
        }),
      ),
    ).toThrow("herkomst");
    expect(() =>
      sameOrigin(new Request("https://shop.example/api/admin")),
    ).toThrow("herkomst");
    expect(() =>
      sameOrigin(
        new Request("https://shop.example/api/admin", {
          headers: { origin: "https://shop.example" },
        }),
      ),
    ).not.toThrow();
  });
  it("keeps production checkout disabled even when the test switch is set", () => {
    vi.stubEnv("DEPLOYMENT_ENV", "production");
    vi.stubEnv("ENABLE_TEST_CHECKOUT", "true");
    expect(() => checkout(input)).toThrow("Betalingen zijn uitgeschakeld");
    vi.stubEnv("DEPLOYMENT_ENV", "staging");
    vi.stubEnv("ENABLE_TEST_CHECKOUT", "false");
    expect(() => checkout(input)).toThrow("Betalingen zijn uitgeschakeld");
  });
});
