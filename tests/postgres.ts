import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
export async function testDatabase() {
  const db = new PGlite();
  // Supabase supplies these roles/functions. This harness tests PostgreSQL SQL/RLS,
  // not hosted Supabase Auth or PostgREST availability.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
    'select coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb';
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.jwt() to anon,authenticated,service_role;`);
  for (const name of readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  return db;
}
export async function call<T>(
  db: PGlite,
  name: string,
  args: Record<string, unknown> = {},
) {
  if (
    !/^wm_[a-z_]+$/.test(name) ||
    Object.keys(args).some((k) => !/^[a-z_]+$/.test(k))
  )
    throw new Error("Invalid RPC");
  const entries = Object.entries(args);
  const result = await db.query<{ result: T }>(
    `select public.${name}(${entries.map(([k], i) => `${k} => $${i + 1}`).join(",")}) as result`,
    entries.map(([, v]) =>
      typeof v === "object" && v !== null ? JSON.stringify(v) : v,
    ),
  );
  return result.rows[0].result;
}
