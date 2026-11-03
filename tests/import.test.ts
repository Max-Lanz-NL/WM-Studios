import { beforeAll, afterAll, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { database, asRole, product } from "./helpers/database";
let db: PGlite;
beforeAll(async () => {
  db = await database();
}, 60000);
afterAll(async () => {
  await db?.close();
});
const p = {
  ...product(),
  id: randomUUID(),
  createdAt: "2026-10-01T12:00:00.000Z",
};
const order = {
  id: randomUUID(),
  number: "WM-OLD-001",
  email: "legacy@example.invalid",
  name: "Legacy Customer",
  address: "Teststraat 1, Teststad",
  total: 6995,
  shipping: 495,
  status: "packed",
  createdAt: "2026-10-02T12:00:00.000Z",
  items: [
    {
      productId: p.id,
      name: p.name,
      sku: p.variants[0].sku,
      size: "M",
      color: "Black",
      quantity: 1,
      price: 6500,
    },
  ],
};
const payload = {
  formatVersion: 1,
  sourceId: "test-sqlite-v1",
  tables: {
    products: [{ id: p.id, body: JSON.stringify(p) }],
    orders: [
      { id: order.id, idempotency: randomUUID(), body: JSON.stringify(order) },
    ],
    settings: [
      {
        id: "home",
        body: JSON.stringify({
          headline: "Legacy homepage",
          subtitle: "Ongewijzigde inhoud",
        }),
      },
    ],
    waitlist: [],
    audit: [],
    attempts: [{ id: "old-attempt", count: 1, reset: 123 }],
  },
};
const digest = createHash("sha256")
  .update(JSON.stringify(payload))
  .digest("hex");
it("importeert producten, voorraad, historische orders en alle originele records", async () => {
  const result = await asRole<{
    result: { products: number; orders: number; archivedRecords: number };
  }>(db, "service_role", null, "select public.import_legacy($1,$2) result", [
    JSON.stringify(payload),
    digest,
  ]);
  expect(result[0].result).toEqual({
    products: 1,
    orders: 1,
    archivedRecords: 4,
  });
  const actual = await db.query<{ body: Record<string, unknown> }>(
    "select body from catalog where id=$1",
    [p.id],
  );
  for (const key of ["id", "name", "slug", "description", "price", "variants"])
    expect(actual.rows[0].body[key]).toEqual(p[key as keyof typeof p]);
  const historical = await db.query<{ body: Record<string, unknown> }>(
    "select body from order_overview where id=$1",
    [order.id],
  );
  expect(historical.rows[0].body.status).toBe("packed");
  expect(historical.rows[0].body.total).toBe(6995);
  expect(
    (
      await db.query<{ original: unknown }>(
        "select original from private.legacy_imports",
      )
    ).rows[0].original,
  ).toEqual(payload);
});
it("kan dezelfde import veilig herhalen en blokkeert een gewijzigde bron", async () => {
  const r = await asRole<{ result: { alreadyImported: boolean } }>(
    db,
    "service_role",
    null,
    "select public.import_legacy($1,$2) result",
    [JSON.stringify(payload), digest],
  );
  expect(r[0].result.alreadyImported).toBe(true);
  await expect(
    asRole(db, "service_role", null, "select public.import_legacy($1,$2)", [
      JSON.stringify(payload),
      "a".repeat(64),
    ]),
  ).rejects.toThrow("gewijzigd");
});
it("overschrijft geen bestaande stagingcatalogus", async () => {
  await expect(
    asRole(db, "service_role", null, "select public.import_legacy($1,$2)", [
      JSON.stringify({ ...payload, sourceId: "other-source" }),
      digest,
    ]),
  ).rejects.toThrow("lege doelcatalogus");
});
it("weigert import door gewone gebruikers", async () => {
  await expect(
    asRole(db, "anon", null, "select public.import_legacy($1,$2)", [
      JSON.stringify(payload),
      digest,
    ]),
  ).rejects.toThrow("permission denied");
});
it("rolt een ongeldige import volledig terug", async () => {
  const fresh = await database();
  try {
    const invalid = {
      ...payload,
      tables: {
        ...payload.tables,
        products: [
          ...payload.tables.products,
          { id: randomUUID(), body: "{}" },
        ],
      },
    };
    await expect(
      asRole(
        fresh,
        "service_role",
        null,
        "select public.import_legacy($1,$2)",
        [JSON.stringify(invalid), digest],
      ),
    ).rejects.toThrow();
    expect((await fresh.query("select * from products")).rows).toHaveLength(0);
    expect(
      (await fresh.query("select * from private.legacy_imports")).rows,
    ).toHaveLength(0);
  } finally {
    await fresh.close();
  }
}, 30000);
