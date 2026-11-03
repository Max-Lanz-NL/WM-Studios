import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import {
  database,
  asRole,
  owner,
  designer,
  warehouse,
  outsider,
  product,
} from "./helpers/database";
import { saleable, date, productSchema } from "../src/lib/model";
let db: PGlite;
beforeAll(async () => {
  db = await database();
}, 60000);
afterAll(async () => {
  await db?.close();
});
async function create(overrides: Record<string, unknown> = {}) {
  const p = product(overrides);
  const id = randomUUID();
  await db.query("select private.persist_product($1::jsonb,$2::uuid)", [
    JSON.stringify(p),
    id,
  ]);
  return { ...p, id };
}
function input(p: Awaited<ReturnType<typeof create>>, quantity = 1) {
  return {
    key: randomUUID(),
    email: "test@example.invalid",
    name: "Demo Test",
    address: "Teststraat 1, Teststad",
    items: [{ productId: p.id, sku: p.variants[0].sku, quantity }],
  };
}
async function checkout(payload: unknown, reserve = false) {
  return (
    await asRole<{ result: { id: string; total: number; status: string } }>(
      db,
      "service_role",
      null,
      "select public.checkout_staging($1::jsonb,$2) result",
      [JSON.stringify(payload), reserve],
    )
  )[0].result;
}
describe("genormaliseerde PostgreSQL-checkout", () => {
  it("berekent serverprijzen en bewaart snapshots", async () => {
    const p = await create();
    const order = await checkout({ ...input(p), price: 1 });
    expect(order.total).toBe(6995);
    await db.query("update products set price_cents=9000 where id=$1", [p.id]);
    expect(
      (
        await db.query<{ price_cents: number }>(
          "select price_cents from order_items where order_id=$1",
          [order.id],
        )
      ).rows[0].price_cents,
    ).toBe(6500);
  });
  it("verwerkt dezelfde sleutel eenmaal en weigert andere inhoud", async () => {
    const p = await create(),
      body = input(p);
    const a = await checkout(body),
      b = await checkout(body);
    expect(a.id).toBe(b.id);
    await expect(
      checkout({ ...body, name: "Different customer" }),
    ).rejects.toThrow("andere bestelling");
  });
  it("rolt de hele order terug bij onvoldoende voorraad", async () => {
    const p = await create({
      variants: [
        { size: "M", color: "Black", sku: randomUUID(), stock: 1 },
        { size: "L", color: "Black", sku: randomUUID(), stock: 0 },
      ],
    });
    const b = input(p);
    b.items.push({ productId: p.id, sku: p.variants[1].sku, quantity: 1 });
    await expect(checkout(b)).rejects.toThrow("Onvoldoende");
    expect(
      (
        await db.query<{ on_hand: number }>(
          "select on_hand from inventory join product_variants v on v.id=variant_id where v.sku=$1",
          [p.variants[0].sku],
        )
      ).rows[0].on_hand,
    ).toBe(1);
  });
  it("verkoopt het laatste exemplaar niet tweemaal", async () => {
    const p = await create({
      variants: [{ size: "M", color: "Black", sku: randomUUID(), stock: 1 }],
    });
    const results = await Promise.allSettled([
      checkout(input(p)),
      checkout(input(p)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("blokkeert voortijdige en ongepubliceerde aankopen", async () => {
    for (const status of ["draft", "review", "approved", "archived"]) {
      const p = await create({ status });
      await expect(checkout(input(p))).rejects.toThrow("nog niet beschikbaar");
    }
    const p = await create({
      status: "scheduled",
      releaseAt: "2099-01-01T00:00:00Z",
    });
    await expect(checkout(input(p))).rejects.toThrow("nog niet beschikbaar");
  });
  it("weigert dubbele regels en ongeldige aantallen", async () => {
    const p = await create(),
      b = input(p);
    b.items.push({ ...b.items[0] });
    await expect(checkout(b)).rejects.toThrow("Dubbele");
    await expect(checkout(input(p, -1))).rejects.toThrow("Ongeldig");
  });
});
describe("reserveringen en publicatietaken", () => {
  it("reserveert fysiek aanwezige voorraad en geeft mislukte betaling eenmaal vrij", async () => {
    const p = await create({
      variants: [{ size: "M", color: "Black", sku: randomUUID(), stock: 1 }],
    });
    const o = await checkout(input(p), true);
    expect(o.status).toBe("pending_payment");
    await expect(checkout(input(p))).rejects.toThrow("Onvoldoende");
    await asRole(
      db,
      "service_role",
      null,
      "select public.settle_reservation($1,$2)",
      [o.id, "failed"],
    );
    await asRole(
      db,
      "service_role",
      null,
      "select public.settle_reservation($1,$2)",
      [o.id, "failed"],
    );
    await expect(checkout(input(p))).resolves.toHaveProperty(
      "status",
      "paid_demo",
    );
  });
  it("verbruikt een betaalde reservering eenmaal", async () => {
    const p = await create(),
      o = await checkout(input(p), true);
    await asRole(
      db,
      "service_role",
      null,
      "select public.settle_reservation($1,$2)",
      [o.id, "paid"],
    );
    await asRole(
      db,
      "service_role",
      null,
      "select public.settle_reservation($1,$2)",
      [o.id, "paid"],
    );
    const rows = await db.query<{ on_hand: number; reserved: number }>(
      "select on_hand,reserved from inventory join product_variants v on v.id=variant_id where v.sku=$1",
      [p.variants[0].sku],
    );
    expect(rows.rows[0]).toEqual({ on_hand: 3, reserved: 0 });
  });
  it("haalt verlopen reserveringen in en weigert late betaling", async () => {
    const p = await create(),
      o = await checkout(input(p), true);
    await db.query(
      "update orders set expires_at=now()-interval '1 minute' where id=$1",
      [o.id],
    );
    await db.query("select private.run_maintenance()");
    const r = await asRole<{ result: string }>(
      db,
      "service_role",
      null,
      "select public.settle_reservation($1,$2) result",
      [o.id, "paid"],
    );
    expect(r[0].result).toBe("expired");
  });
  it("publiceert verschuldigde releases idempotent en laat concepten staan", async () => {
    const p = await create({
        status: "scheduled",
        releaseAt: "2026-01-01T00:00:00Z",
      }),
      draft = await create({
        status: "draft",
        releaseAt: "2026-01-01T00:00:00Z",
      });
    await db.query("select private.run_maintenance()");
    await db.query("select private.run_maintenance()");
    const r = await db.query<{ id: string; status: string }>(
      "select id,status from products where id=any($1::uuid[])",
      [[p.id, draft.id]],
    );
    expect(r.rows.find((x) => x.id === p.id)?.status).toBe("published");
    expect(r.rows.find((x) => x.id === draft.id)?.status).toBe("draft");
  });
});
describe("RLS en medewerkersrechten", () => {
  it("verbergt concepten en klantgegevens voor anonieme bezoekers", async () => {
    const p = await create({ status: "draft" });
    expect(
      await asRole(db, "anon", null, "select * from catalog where id=$1", [
        p.id,
      ]),
    ).toHaveLength(0);
    await expect(
      asRole(db, "anon", null, "select * from orders"),
    ).rejects.toThrow("permission denied");
  });
  it("geeft een gewone ingelogde gebruiker geen beheertoegang", async () => {
    expect(
      await asRole(db, "authenticated", outsider, "select * from orders"),
    ).toHaveLength(0);
    await expect(
      asRole(
        db,
        "authenticated",
        outsider,
        "select public.save_product($1,$2,null)",
        [JSON.stringify(product()), randomUUID()],
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("laat een designer producten beheren zonder orders te lekken", async () => {
    const p = product(),
      id = randomUUID();
    await asRole(
      db,
      "authenticated",
      designer,
      "select public.save_product($1,$2,null)",
      [JSON.stringify(p), id],
    );
    expect(
      await asRole(
        db,
        "authenticated",
        designer,
        "select * from catalog where id=$1",
        [id],
      ),
    ).toHaveLength(1);
    expect(
      await asRole(
        db,
        "authenticated",
        designer,
        "select * from order_overview",
      ),
    ).toHaveLength(0);
  });
  it("weigert privilege escalation en directe voorraadwijzigingen", async () => {
    await expect(
      asRole(
        db,
        "authenticated",
        designer,
        "update staff_members set role='owner' where user_id=$1",
        [designer],
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      asRole(db, "authenticated", owner, "update inventory set on_hand=999"),
    ).rejects.toThrow("permission denied");
    await expect(
      asRole(
        db,
        "authenticated",
        owner,
        "select public.checkout_staging($1,false)",
        [JSON.stringify({})],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("weigert een warehouse-medewerker cataloguswijzigingen", async () => {
    await expect(
      asRole(
        db,
        "authenticated",
        warehouse,
        "select public.save_product($1,$2,null)",
        [JSON.stringify(product()), randomUUID()],
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("blokkeert onveilige statusovergangen en bewaart de orderhistorie", async () => {
    const p = await create(),
      o = await checkout(input(p));
    await expect(
      asRole(
        db,
        "authenticated",
        owner,
        "select public.staff_action('order',$1)",
        [JSON.stringify({ id: o.id, status: "shipped" })],
      ),
    ).rejects.toThrow("statusovergang");
    for (const status of ["packed", "shipped"])
      await asRole(
        db,
        "authenticated",
        warehouse,
        "select public.staff_action('order',$1)",
        [JSON.stringify({ id: o.id, status })],
      );
    expect(
      (await db.query("select * from order_events where order_id=$1", [o.id]))
        .rows,
    ).toHaveLength(3);
  });
  it("controleert medewerkerrechten opnieuw na deactiveren", async () => {
    await db.query("update staff_members set active=false where user_id=$1", [
      designer,
    ]);
    await expect(
      asRole(
        db,
        "authenticated",
        designer,
        "select public.save_product($1,$2,null)",
        [JSON.stringify(product()), randomUUID()],
      ),
    ).rejects.toThrow("FORBIDDEN");
    await db.query("update staff_members set active=true where user_id=$1", [
      designer,
    ]);
  });
  it("weigert een verouderde producteditor na een verkoop", async () => {
    const p = await create();
    await checkout(input(p));
    await expect(
      asRole(
        db,
        "authenticated",
        owner,
        "select public.save_product($1,$2,$3)",
        [JSON.stringify(p), p.id, 1],
      ),
    ).rejects.toThrow("gewijzigd");
  });
  it("schakelt RLS op elke applicatietabel in en beveiligt views", async () => {
    const r = await db.query(
      "select tablename from pg_tables join pg_class on relname=tablename join pg_namespace n on n.oid=relnamespace and n.nspname=schemaname where schemaname in ($1,$2) and not relrowsecurity",
      ["public", "private"],
    );
    expect(r.rows).toHaveLength(0);
  });
});
describe("validatie en tijdzones", () => {
  it("ondersteunt de exacte verkoopgrens", () => {
    const p = {
      status: "scheduled" as const,
      releaseAt: "2026-10-25T01:00:00Z",
    };
    expect(saleable(p, Date.parse(p.releaseAt) - 1)).toBe(false);
    expect(saleable(p, Date.parse(p.releaseAt))).toBe(true);
  });
  it("verwerkt zomer- en wintertijd", () => {
    expect(date("2026-10-25T00:30:00Z")).toContain("02:30");
    expect(date("2026-10-25T01:30:00Z")).toContain("02:30");
    expect(date("2026-07-01T12:00:00Z")).toContain("14:00");
  });
  it("valideert release, media en voorraad", () => {
    expect(
      productSchema.safeParse(product({ status: "scheduled", releaseAt: null }))
        .success,
    ).toBe(false);
    expect(
      productSchema.safeParse(product({ image: "javascript:alert(1)" }))
        .success,
    ).toBe(false);
    expect(
      productSchema.safeParse(
        product({
          variants: [{ size: "M", color: "Black", sku: "X", stock: -1 }],
        }),
      ).success,
    ).toBe(false);
  });
});
