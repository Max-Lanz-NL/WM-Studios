// Local protocol simulator for E2E only. Real PostgreSQL via PGlite; fake Auth.
// Never deploy this harness and never use its credentials in Supabase.
import { createServer } from "node:http";
import { testDatabase, call } from "../tests/postgres";
import { demoProducts } from "./fixtures";
if (process.env.NODE_ENV === "production")
  throw new Error("Test harness cannot run in production");
const db = await testDatabase();
await call(db, "wm_seed", { catalog: demoProducts() });
await db.exec("update wm_settings set body='true' where id='test_checkout'");
const tokens = new Map<string, string>();
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://127.0.0.1:54329");
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/health") return send(200, { ok: true });
  let raw = "";
  for await (const c of req) raw += c;
  try {
    const b = raw ? JSON.parse(raw) : {};
    if (url.pathname === "/auth/v1/token") {
      if (
        b.password !== "local-e2e-test-password-only" ||
        !["admin@example.invalid", "member@example.invalid"].includes(b.email)
      )
        return send(400, {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        });
      const token = crypto.randomUUID();
      tokens.set(token, b.email);
      const user = {
        id: "00000000-0000-4000-8000-000000000001",
        email: b.email,
        app_metadata: {
          role: b.email.startsWith("admin") ? "admin" : "member",
        },
      };
      return send(200, {
        access_token: token,
        refresh_token: "test-unused-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    }
    if (url.pathname === "/auth/v1/user") {
      const email = tokens.get(
        req.headers.authorization?.replace("Bearer ", "") || "",
      );
      return email
        ? send(200, {
            id: "00000000-0000-4000-8000-000000000001",
            email,
            app_metadata: {
              role: email.startsWith("admin") ? "admin" : "member",
            },
          })
        : send(401, { message: "Invalid token" });
    }
    if (url.pathname === "/auth/v1/logout") {
      tokens.delete(req.headers.authorization?.replace("Bearer ", "") || "");
      return send(200, {});
    }
    // Serialize role switching on one test database connection, just like one backend.
    queue = queue.then(async () => {
      const privileged = req.headers.apikey === "test-secret";
      await db.exec(`set role ${privileged ? "service_role" : "anon"}`);
      try {
        if (url.pathname.startsWith("/rest/v1/rpc/"))
          return send(200, await call(db, url.pathname.split("/").pop()!, b));
        const table = url.pathname.split("/").pop()!;
        if (
          !["wm_products", "wm_orders", "wm_settings", "wm_waitlist"].includes(
            table,
          )
        )
          return send(404, {});
        if (req.method === "HEAD") {
          const result = await db.query<{ n: number }>(
            `select count(*)::int n from public.${table}`,
          );
          res.writeHead(200, { "Content-Range": `0-0/${result.rows[0].n}` });
          res.end();
          return;
        }
        const result = await db.query(
          `select body from public.${table}${table === "wm_settings" ? " where id='home'" : " order by created_at desc"}`,
        );
        return send(
          200,
          req.headers.accept?.includes("vnd.pgrst.object")
            ? result.rows[0]
            : result.rows,
        );
      } catch (e) {
        const err = e as { message: string; code: string };
        send(400, { message: err.message, code: err.code });
      } finally {
        await db.exec("reset role");
      }
    });
    await queue;
  } catch {
    send(500, { message: "Test backend failed" });
  }
});
let queue = Promise.resolve();
server.listen(54329, "127.0.0.1", () =>
  console.log("Local test backend ready"),
);
