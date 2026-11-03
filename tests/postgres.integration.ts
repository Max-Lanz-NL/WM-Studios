/** Opt-in acceptance test for an explicitly selected disposable test/staging DB.
 * Uses two actual PostgreSQL connections; never runs in the default test suite.
 */
import { beforeAll, afterAll, it, expect } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { product } from "./helpers/database";
let pool: Pool;
const ids: string[] = [];
const run = randomUUID();
const email = `integration-${run}@example.invalid`;
beforeAll(async () => {
  const value = process.env.WM_TEST_DATABASE_URL;
  if (!value || process.env.WM_ALLOW_TEST_WRITES !== "yes")
    throw new Error(
      "Veilige testconfiguratie ontbreekt. Stel WM_TEST_DATABASE_URL en WM_ALLOW_TEST_WRITES=yes alleen voor een wegwerpbare test-/stagingdatabase in.",
    );
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !local &&
    (process.env.APP_ENV !== "staging" ||
      url.hostname !==
        `db.${process.env.SUPABASE_STAGING_PROJECT_REF}.supabase.co`)
  )
    throw new Error(
      "De database-URL is geen expliciet aangewezen test-/stagingdoel.",
    );
  pool = new Pool({
    connectionString: value,
    max: 3,
    ssl: local ? false : { rejectUnauthorized: true },
  });
  const r = await pool.query(
    "select environment from private.platform_settings where singleton",
  );
  if (!["local", "staging"].includes(r.rows[0]?.environment))
    throw new Error("Doeldatabase staat niet in test-/stagingmodus.");
});
async function create(stock: number) {
  const p = product({
    name: "WM integration " + run,
    variants: [{ size: "M", color: "Black", sku: randomUUID(), stock }],
  });
  const id = randomUUID();
  await pool.query("select private.persist_product($1,$2)", [
    JSON.stringify(p),
    id,
  ]);
  ids.push(id);
  return { ...p, id };
}
function body(p: Awaited<ReturnType<typeof create>>) {
  return {
    key: randomUUID(),
    email,
    name: "Integration Test",
    address: "Teststraat 1, Teststad",
    items: [{ productId: p.id, sku: p.variants[0].sku, quantity: 1 }],
  };
}
it("serialiseert twee echte PostgreSQL-backends voor het laatste exemplaar", async () => {
  const p = await create(1);
  const a = await pool.connect(),
    b = await pool.connect();
  try {
    const results = await Promise.allSettled([
      a.query("select public.checkout_staging($1,false)", [
        JSON.stringify(body(p)),
      ]),
      b.query("select public.checkout_staging($1,false)", [
        JSON.stringify(body(p)),
      ]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (
        await pool.query(
          "select on_hand,reserved from inventory join product_variants v on v.id=variant_id where v.product_id=$1",
          [p.id],
        )
      ).rows[0],
    ).toEqual({ on_hand: 0, reserved: 0 });
  } finally {
    a.release();
    b.release();
  }
});
it("geeft een mislukte reservering vrij op een echte database", async () => {
  const p = await create(1);
  const r = await pool.query("select public.checkout_staging($1,true) result", [
    JSON.stringify(body(p)),
  ]);
  await pool.query("select public.settle_reservation($1,'failed')", [
    r.rows[0].result.id,
  ]);
  expect(
    (
      await pool.query(
        "select on_hand,reserved from inventory join product_variants v on v.id=variant_id where v.product_id=$1",
        [p.id],
      )
    ).rows[0],
  ).toEqual({ on_hand: 1, reserved: 0 });
});
afterAll(async () => {
  if (!pool) return;
  if (ids.length) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      const orderIds = (
        await c.query(
          "select distinct order_id from order_items where product_id=any($1::uuid[])",
          [ids],
        )
      ).rows.map((r) => r.order_id);
      for (const table of [
        "order_events",
        "inventory_reservations",
        "inventory_movements",
        "order_items",
      ])
        await c.query(
          `delete from public.${table} where order_id=any($1::uuid[])`,
          [orderIds],
        );
      await c.query("delete from orders where id=any($1::uuid[])", [orderIds]);
      await c.query(
        "delete from customers where email=$1 and not exists(select 1 from orders where customer_id=customers.id)",
        [email],
      );
      await c.query(
        "delete from inventory_movements where variant_id in(select id from product_variants where product_id=any($1::uuid[]))",
        [ids],
      );
      await c.query(
        "delete from inventory where variant_id in(select id from product_variants where product_id=any($1::uuid[]))",
        [ids],
      );
      await c.query(
        "delete from product_variants where product_id=any($1::uuid[])",
        [ids],
      );
      await c.query("delete from products where id=any($1::uuid[])", [ids]);
      await c.query("delete from audit_logs where action=$1", [
        "Product opgeslagen: WM integration " + run,
      ]);
      await c.query("commit");
    } catch (error) {
      await c.query("rollback");
      throw error;
    } finally {
      c.release();
    }
  }
  await pool.end();
});
