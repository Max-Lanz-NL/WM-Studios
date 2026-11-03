import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
export const owner = randomUUID(),
  designer = randomUUID(),
  warehouse = randomUUID(),
  outsider = randomUUID();
const locks = new WeakMap<PGlite, Promise<void>>();
export async function database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of readdirSync("supabase/migrations").sort()) {
    const sql = readFileSync("supabase/migrations/" + file, "utf8").split(
      "-- SCHEDULER INSTALLATION",
    )[0];
    await db.exec(sql);
  }
  for (const [id, role] of [
    [owner, "owner"],
    [designer, "designer"],
    [warehouse, "warehouse"],
    [outsider, null],
  ]) {
    await db.query("insert into auth.users(id) values ($1)", [id]);
    if (role)
      await db.query(
        "insert into public.staff_members(user_id,role) values ($1,$2)",
        [id, role],
      );
  }
  return db;
}
export async function asRole<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  id: string | null,
  sql: string,
  params: unknown[] = [],
) {
  // One PGlite backend cannot carry two concurrent SET ROLE contexts.
  const previous = locks.get(db) || Promise.resolve();
  let unlock!: () => void;
  const lock = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  locks.set(
    db,
    previous.then(() => lock),
  );
  await previous;
  try {
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id || "",
    ]);
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub','',false)");
    }
  } finally {
    unlock();
  }
}
export const product = (overrides: Record<string, unknown> = {}) => ({
  name: "The Essential Tee",
  slug: "essential-" + randomUUID(),
  brand: "WM STUDIO",
  category: "T-shirts",
  gender: "Unisex",
  description: "Testproduct",
  price: 6500,
  status: "published",
  releaseAt: null,
  image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
  variants: [
    { size: "M", color: "Black", sku: "WM-" + randomUUID(), stock: 4 },
  ],
  ...overrides,
});
