/** Test-only HTTP fixture. Uses real PostgreSQL SQL/RLS, but emulates Auth/PostgREST.
 * It is not a Supabase implementation or a production fallback.
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { database, asRole, owner, product } from "../../tests/helpers/database";
const db = await database();
for (const p of [
  product({
    name: "The Essential Tee",
    slug: "the-essential-tee",
    variants: ["XS", "S", "M", "L", "XL"].map((size) => ({
      size,
      color: "Off white",
      sku: "E2E-TEE-" + size,
      stock: 10,
    })),
  }),
  product({
    name: "Off Duty Hoodie",
    slug: "off-duty-hoodie",
    status: "scheduled",
    releaseAt: "2099-01-01T12:00:00.000Z",
  }),
])
  await db.query("select private.persist_product($1,$2)", [
    JSON.stringify(p),
    randomUUID(),
  ]);
const user = {
  id: owner,
  email: "e2e-owner@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const tokens = new Set<string>();
let queue = Promise.resolve();
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const input = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url!, "http://127.0.0.1:54329");
  const reply = (status: number, data: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/") {
    reply(200, { testFixture: true });
    return;
  }
  if (url.pathname === "/auth/v1/token") {
    if (
      input.email !== user.email ||
      input.password !== "local-e2e-test-password-only"
    ) {
      reply(400, {
        msg: "Invalid login credentials",
        error_code: "invalid_credentials",
      });
      return;
    }
    const access = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ),
      Buffer.from(
        JSON.stringify({
          sub: owner,
          aud: "authenticated",
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url"),
      "test-fixture-signature",
    ].join(".");
    tokens.add(access);
    reply(200, {
      access_token: access,
      refresh_token: randomUUID(),
      expires_in: 3600,
      token_type: "bearer",
      user,
    });
    return;
  }
  const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (url.pathname === "/auth/v1/user") {
    reply(
      tokens.has(token) ? 200 : 401,
      tokens.has(token) ? user : { msg: "Invalid JWT", error_code: "bad_jwt" },
    );
    return;
  }
  if (url.pathname === "/auth/v1/logout") {
    tokens.delete(token);
    reply(200, {});
    return;
  }
  const role =
    req.headers.apikey === "e2e-service-key"
      ? "service_role"
      : tokens.has(token)
        ? "authenticated"
        : "anon";
  const run = async () => {
    try {
      const execute = (sql: string, params: unknown[] = []) =>
        asRole<Record<string, unknown>>(
          db,
          role,
          role === "authenticated" ? owner : null,
          sql,
          params,
        );
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").at(-1);
        let rows: Record<string, unknown>[];
        switch (name) {
          case "check_rate_limit":
            rows = await execute(
              "select public.check_rate_limit($1,$2) result",
              [input.bucket, input.max_requests],
            );
            break;
          case "checkout_staging":
            rows = await execute(
              "select public.checkout_staging($1,$2) result",
              [JSON.stringify(input.payload), input.reserve_only],
            );
            break;
          case "save_product":
            rows = await execute(
              "select public.save_product($1,$2,$3) result",
              [
                JSON.stringify(input.payload),
                input.target_id,
                input.expected_version,
              ],
            );
            break;
          case "staff_action":
            rows = await execute("select public.staff_action($1,$2) result", [
              input.action,
              JSON.stringify(input.payload),
            ]);
            break;
          case "join_waitlist":
            rows = await execute("select public.join_waitlist($1,$2) result", [
              input.product,
              input.email_address,
            ]);
            break;
          default:
            throw new Error("Unsupported test RPC");
        }
        reply(200, rows[0].result);
        return;
      }
      const table = url.pathname.split("/").at(-1);
      let rows: Record<string, unknown>[];
      switch (table) {
        case "catalog":
          rows = await execute(
            "select body from public.catalog" +
              (url.searchParams.has("id") ? " where id=$1" : ""),
            url.searchParams.has("id")
              ? [url.searchParams.get("id")!.slice(3)]
              : [],
          );
          break;
        case "order_overview":
          rows = await execute("select body from public.order_overview");
          break;
        case "content_settings":
          rows = await execute(
            "select body from public.content_settings where id='home'",
          );
          break;
        case "staff_members":
          rows = await execute(
            "select role,active from public.staff_members where user_id=$1",
            [url.searchParams.get("user_id")!.slice(3)],
          );
          break;
        case "role_permissions":
          rows = await execute(
            "select permission from public.role_permissions where role=$1",
            [url.searchParams.get("role")!.slice(3)],
          );
          break;
        case "release_waitlist":
          rows = await execute("select id from public.release_waitlist");
          break;
        default:
          throw new Error("Unsupported test resource");
      }
      if (req.method === "HEAD") {
        res.writeHead(200, {
          "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
        });
        res.end();
        return;
      }
      const single = String(req.headers.accept || "").includes(
        "vnd.pgrst.object+json",
      );
      reply(200, single ? rows[0] || null : rows);
    } catch (error) {
      reply(400, {
        message: (error as Error).message,
        code: "P0001",
        details: null,
        hint: null,
      });
    }
  };
  // PGlite has one backend. Serialize role-scoped transactions; real multi-session races need staging.
  queue = queue.then(run, run);
});
server.listen(54329, "127.0.0.1", () =>
  console.log("PostgreSQL/RLS browser fixture ready (Auth is a test double)."),
);
process.on("SIGTERM", () => server.close(() => process.exit(0)));
