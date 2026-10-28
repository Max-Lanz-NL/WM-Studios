import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { database, rpc, required, ConfigurationError } from "./supabase";
export const adminCookie =
  process.env.NODE_ENV === "production" ? "__Host-wm_access" : "wm_access";
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function isAdmin() {
  const token = (await cookies()).get(adminCookie)?.value;
  if (!token) return false;
  const { data, error } = await database().auth.getUser(token);
  return !error && data.user?.app_metadata?.role === "admin";
}
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("UNAUTHORIZED");
}
export async function rateLimit(key: string, max = 8) {
  const allowed = await rpc<boolean>("wm_rate_limit", {
    bucket: key,
    maximum: max,
  });
  if (!allowed)
    throw new Error("Te veel verzoeken. Probeer het over een minuut opnieuw.");
}
export function sameOrigin(request: Request) {
  // Next/Vercel may normalize request.url to an internal hostname. Authorize
  // against a trusted deployment setting, never Host / X-Forwarded-Host input.
  const configured = required("APP_ORIGIN");
  let expected: URL;
  try {
    expected = new URL(configured);
  } catch {
    throw new ConfigurationError("Ongeldige configuratie: APP_ORIGIN");
  }
  if (
    expected.origin !== configured ||
    (expected.protocol !== "https:" &&
      !(
        expected.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(expected.hostname) &&
        !process.env.VERCEL
      ))
  )
    throw new ConfigurationError(
      "APP_ORIGIN vereist de exacte HTTPS-origin zonder pad",
    );
  if (request.headers.get("origin") !== expected.origin)
    throw new Error("Ongeldige herkomst");
}
