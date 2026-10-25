import { beforeEach, it, expect, vi } from "vitest";
const mocked = vi.hoisted(() => ({ client: vi.fn(), service: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({
  sessionClient: mocked.client,
  serviceClient: mocked.service,
}));
import {
  currentStaff,
  requireAdmin,
  sameOrigin,
  rateLimit,
} from "../src/lib/auth";
function session({
  user = { id: "staff-1", email: "designer@example.invalid" },
  active = true,
  role = "designer",
  permissions = ["catalog.write"],
  error = null,
}: {
  user?: { id: string; email: string } | null;
  active?: boolean;
  role?: string;
  permissions?: string[];
  error?: unknown;
} = {}) {
  const query = (table: string) => ({
    select: () => ({
      eq: () =>
        table === "staff_members"
          ? {
              maybeSingle: async () => ({
                data: { active, role },
                error: null,
              }),
            }
          : Promise.resolve({
              data: permissions.map((permission) => ({ permission })),
              error: null,
            }),
    }),
  });
  const getUser = vi.fn(async () => ({ data: { user }, error }));
  mocked.client.mockResolvedValue({ auth: { getUser }, from: query });
  return getUser;
}
beforeEach(() => vi.clearAllMocks());
it("valideert identiteit bij Auth en leest rollen uit de database", async () => {
  const getUser = session();
  const staff = await currentStaff();
  expect(getUser).toHaveBeenCalledOnce();
  expect(staff?.role).toBe("designer");
  expect(staff?.permissions).toEqual(["catalog.write"]);
});
it("weigert een ongeldige of ingetrokken sessie", async () => {
  session({ user: null, error: { message: "invalid token" } });
  expect(await currentStaff()).toBeNull();
  await expect(requireAdmin()).rejects.toThrow("UNAUTHORIZED");
});
it("weigert gedeactiveerde medewerkers en ontbrekende rechten", async () => {
  session({ active: false });
  expect(await currentStaff()).toBeNull();
  session();
  await expect(requireAdmin("orders.write")).rejects.toThrow("FORBIDDEN");
});
it("controleert herkomst ook bij een afwijkende interne Next-hostnaam", () => {
  const request = new Request("http://localhost:3000/api/admin", {
    headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
  });
  expect(() => sameOrigin(request)).not.toThrow();
  expect(() =>
    sameOrigin(
      new Request("http://localhost:3000/api/admin", {
        headers: { origin: "https://evil.invalid" },
      }),
    ),
  ).toThrow("herkomst");
});
it("faalt gesloten als de centrale rate-limitcontrole niet werkt", async () => {
  mocked.service.mockReturnValue({
    rpc: async () => ({ data: null, error: { message: "offline" } }),
  });
  await expect(rateLimit("test")).rejects.toThrow("niet beschikbaar");
  mocked.service.mockReturnValue({
    rpc: async () => ({ data: false, error: null }),
  });
  await expect(rateLimit("test")).rejects.toThrow("Te veel");
});
