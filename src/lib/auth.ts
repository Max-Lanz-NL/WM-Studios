import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("Configureer SESSION_SECRET (32+ tekens)");
  return s;
}
export function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function isAdmin() {
  const c = (await cookies()).get("wm_admin")?.value;
  if (!c) return false;
  const [exp, sig] = c.split(".");
  return Number(exp) > Date.now() && equal(sign(exp), sig || "");
}
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("UNAUTHORIZED");
}
export function rateLimit(key: string, max = 8) {
  const d = db(),
    now = Date.now();
  const r = d.prepare("SELECT count,reset FROM attempts WHERE id=?").get(key);
  if (!r || Number(r.reset) < now) {
    d.prepare(
      "INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=1,reset=excluded.reset",
    ).run(key, now + 60000);
    return;
  }
  if (Number(r.count) >= max)
    throw new Error("Te veel verzoeken. Probeer het over een minuut opnieuw.");
  d.prepare("UPDATE attempts SET count=count+1 WHERE id=?").run(key);
}
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  if (request.headers.get("origin") !== `${url.protocol}//${host}`)
    throw new Error("Ongeldige herkomst");
}
