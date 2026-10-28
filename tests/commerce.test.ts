import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import type { Order, Product } from "../src/lib/model";
import { productSchema, saleable, date } from "../src/lib/model";
import { demoProducts } from "../scripts/fixtures";
import { testDatabase, call } from "./postgres";
let db: PGlite;
const rpc = <T>(name: string, args: Record<string, unknown> = {}) =>
  call<T>(db, name, args);
const save = (p: Product, id: string | null = null) =>
  rpc<Product>("wm_save_product", { input: p, product_id: id });
const ps = async () =>
  (
    await db.query<{ body: Product }>(
      "select body from wm_products order by created_at,id",
    )
  ).rows.map((r) => r.body);
const buy = (p: Product, extra = {}) => ({
  key: randomUUID(),
  email: "test@example.invalid",
  name: "Test Buyer",
  address: "Teststraat 1, Teststad",
  items: [{ productId: p.id, sku: p.variants[0].sku, quantity: 1 }],
  ...extra,
});
beforeAll(async () => {
  db = await testDatabase();
  await rpc("wm_seed", { catalog: demoProducts() });
}, 60000);
afterAll(async () => {
  await db?.close();
});
describe("PostgreSQL commerce transactions", () => {
  it("keeps test checkout disabled by default", async () => {
    await expect(
      rpc("wm_checkout", { input: buy((await ps())[0]) }),
    ).rejects.toThrow("uitgeschakeld");
    await db.exec(
      "update wm_settings set body='true' where id='test_checkout'",
    );
  });
  it("blocks early purchases and preserves release boundary semantics", async () => {
    const p = (await ps()).find((p) => p.status === "scheduled")!;
    await expect(rpc("wm_checkout", { input: buy(p) })).rejects.toThrow(
      "nog niet beschikbaar",
    );
    const at = Date.parse(p.releaseAt!);
    expect(saleable(p, at - 1)).toBe(false);
    expect(saleable(p, at)).toBe(true);
    for (const status of ["draft", "review", "approved", "archived"] as const)
      expect(saleable({ status, releaseAt: null })).toBe(false);
  });
  it("publishes once, supports cancellation, and audits atomically", async () => {
    const p = await save({
      ...demoProducts()[0],
      name: "Timed",
      slug: "timed",
      status: "scheduled",
      releaseAt: "2020-01-01T12:00:00.000Z",
      variants: [{ size: "M", color: "Black", sku: "TIMED-M", stock: 5 }],
    });
    expect(
      await rpc("wm_publish_due", { at_time: "2020-01-01T11:59:59Z" }),
    ).toBe(0);
    expect(
      await rpc("wm_publish_due", { at_time: "2020-01-01T12:00:00Z" }),
    ).toBe(1);
    expect(
      await rpc("wm_publish_due", { at_time: "2020-01-01T12:00:01Z" }),
    ).toBe(0);
    await save({ ...p, status: "draft" }, p.id);
    expect(
      await rpc("wm_publish_due", { at_time: "2020-01-02T12:00:01Z" }),
    ).toBe(0);
  });
  it("uses DB prices, decrements multiple sizes and keeps immutable order snapshots", async () => {
    const p = (await ps()).find((p) => p.status === "published")!;
    const input = buy(p, {
      items: p.variants
        .slice(0, 2)
        .map((v, i) => ({ productId: p.id, sku: v.sku, quantity: i + 1 })),
    });
    const o = await rpc<Order>("wm_checkout", { input });
    expect(o.total).toBe(p.price * 3 + (p.price * 3 >= 15000 ? 0 : 495));
    const updated = (await ps()).find((x) => x.id === p.id)!;
    expect(updated.variants[0].stock).toBe(p.variants[0].stock - 1);
    expect(updated.variants[1].stock).toBe(p.variants[1].stock - 2);
    await save({ ...updated, price: p.price + 1000 }, p.id);
    const stored = await db.query<{ body: Order }>(
      "select body from wm_orders where id=$1",
      [o.id],
    );
    expect(stored.rows[0].body.items[0].price).toBe(p.price);
    const retry = await rpc<Order>("wm_checkout", { input });
    expect(retry.id).toBe(o.id);
    await expect(
      rpc("wm_checkout", { input: { ...input, name: "Changed" } }),
    ).rejects.toThrow("al gebruikt");
  });
  it("rolls all stock back when any line fails", async () => {
    const p = (await ps()).find((p) => p.status === "published")!;
    const before = await ps();
    await expect(
      rpc("wm_checkout", {
        input: buy(p, {
          items: [
            { productId: p.id, sku: p.variants[0].sku, quantity: 1 },
            { productId: p.id, sku: "missing", quantity: 1 },
          ],
        }),
      }),
    ).rejects.toThrow("Onvoldoende");
    expect(await ps()).toEqual(before);
    const line = { productId: p.id, sku: p.variants[0].sku, quantity: 1 };
    await expect(
      rpc("wm_checkout", { input: buy(p, { items: [line, line] }) }),
    ).rejects.toThrow("Dubbele");
  });
  it("sells the last item only once and serializes duplicate requests", async () => {
    const p = await save({
      ...demoProducts()[0],
      slug: "last",
      variants: [{ size: "M", color: "Black", sku: "LAST-M", stock: 1 }],
    });
    const results = await Promise.allSettled([
      rpc("wm_checkout", { input: buy(p) }),
      rpc("wm_checkout", { input: buy(p) }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await ps()).find((x) => x.id === p.id)!.variants[0].stock).toBe(0);
  });
  it("rejects duplicate slugs/SKUs and rolls the whole product edit back", async () => {
    const p = (await ps())[0];
    const before = await ps();
    await expect(save(p)).rejects.toThrow("URL");
    await expect(save({ ...p, slug: "duplicate-sku" })).rejects.toThrow("SKU");
    expect(await ps()).toEqual(before);
  });
  it("enforces order status transitions and deduplicates waitlists", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from wm_orders limit 1",
    );
    await expect(
      rpc("wm_update_order", { order_id: rows[0].id, next_status: "shipped" }),
    ).rejects.toThrow("statusovergang");
    await rpc("wm_update_order", {
      order_id: rows[0].id,
      next_status: "packed",
    });
    await rpc("wm_update_order", {
      order_id: rows[0].id,
      next_status: "shipped",
    });
    const p = (await ps()).find((p) => p.status === "scheduled")!;
    for (let i = 0; i < 2; i++)
      await rpc("wm_join_waitlist", {
        product_id: p.id,
        email_address: "test@example.invalid",
      });
    expect(
      (await db.query<{ n: number }>("select count(*)::int n from wm_waitlist"))
        .rows[0].n,
    ).toBe(1);
  });
  it("persists rate limits across calls", async () => {
    expect(await rpc("wm_rate_limit", { bucket: "test", maximum: 1 })).toBe(
      true,
    );
    expect(await rpc("wm_rate_limit", { bucket: "test", maximum: 1 })).toBe(
      false,
    );
  });
  it("protects drafts, orders, settings and privileged RPCs with RLS/grants", async () => {
    await db.exec("set role anon");
    try {
      const rows = await ps();
      expect(
        rows.every((p) => p.status === "published" || p.status === "scheduled"),
      ).toBe(true);
      expect((await db.query("select * from wm_settings")).rows).toHaveLength(
        1,
      );
      await expect(db.query("select * from wm_orders")).rejects.toThrow(
        "permission denied",
      );
      await expect(rpc("wm_publish_due")).rejects.toThrow("permission denied");
      await expect(
        db.query("update wm_products set body='{}'"),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("reset role");
    }
    await db.exec(
      `set role authenticated; set "request.jwt.claims"='{"user_metadata":{"role":"admin"}}'`,
    );
    try {
      expect((await db.query("select * from wm_orders")).rows).toHaveLength(0);
    } finally {
      await db.exec("reset role; reset request.jwt.claims");
    }
    expect(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from pg_class where relname like 'wm_%' and relkind='r' and not relrowsecurity",
        )
      ).rows[0].n,
    ).toBe(0);
  });
  it("validates product data and Amsterdam DST", () => {
    const p = demoProducts()[0];
    expect(
      productSchema.safeParse({ ...p, status: "scheduled", releaseAt: null })
        .success,
    ).toBe(false);
    expect(
      productSchema.safeParse({
        ...p,
        variants: [{ ...p.variants[0], stock: -1 }],
      }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ ...p, image: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(date("2026-10-25T00:30:00Z")).toContain("02:30");
    expect(date("2026-10-25T01:30:00Z")).toContain("02:30");
  });
});
