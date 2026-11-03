import { beforeAll, afterAll, it, expect } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { database, asRole, owner, outsider, product } from "./helpers/database";
import { productSchema, imageSchema } from "../src/lib/model";
import { productReadiness } from "../src/lib/product-readiness";
let db: PGlite;
beforeAll(async () => {
  db = await database();
}, 60000);
afterAll(async () => {
  await db?.close();
});

it("preserves original product data while saving gallery and editorial fields atomically", async () => {
  const id = randomUUID();
  const original = product({ status: "draft" });
  await db.query("select private.persist_product($1,$2)", [
    JSON.stringify(original),
    id,
  ]);
  const content = {
    ...original,
    material: "100% test cotton",
    fit: "Relaxed",
    care: "Test care",
    sizeGuide: "M: 104 cm",
    image: "/products/test-front.webp",
    gallery: [{ url: "/products/test-back.webp", alt: "Back view" }],
  };
  await asRole(
    db,
    "authenticated",
    owner,
    "select public.save_product($1,$2,1)",
    [JSON.stringify(content), id],
  );
  const rows = await asRole<{ body: Record<string, unknown> }>(
    db,
    "authenticated",
    owner,
    "select body from catalog where id=$1",
    [id],
  );
  expect(rows[0].body).toMatchObject({ ...content, version: 2 });
  expect(
    await asRole(
      db,
      "anon",
      null,
      "select * from product_images where product_id=$1",
      [id],
    ),
  ).toHaveLength(0);
  await expect(
    asRole(
      db,
      "authenticated",
      outsider,
      "select public.save_product($1,$2,2)",
      [JSON.stringify(content), id],
    ),
  ).rejects.toThrow("FORBIDDEN");
  await expect(
    asRole(db, "authenticated", owner, "select public.save_product($1,$2,1)", [
      JSON.stringify({ ...content, material: "stale" }),
      id,
    ]),
  ).rejects.toThrow("gewijzigd");
  await expect(
    asRole(db, "authenticated", owner, "select public.save_product($1,$2,2)", [
      JSON.stringify({
        ...content,
        material: "must roll back",
        gallery: [
          { url: "https://untrusted.example/photo.jpg", alt: "Rejected" },
        ],
      }),
      id,
    ]),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ material: string }>(
        "select material from products where id=$1",
        [id],
      )
    ).rows[0].material,
  ).toBe(content.material);
  await asRole(
    db,
    "authenticated",
    owner,
    "select public.save_product($1,$2,2)",
    [JSON.stringify({ ...original, status: "published" }), id],
  );
  expect(
    await asRole(
      db,
      "anon",
      null,
      "select * from product_images where product_id=$1",
      [id],
    ),
  ).toHaveLength(1);
});

it("rejects unsafe media and incomplete image descriptions at the input boundary", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://localhost/a.jpg",
    "https://images.unsplash.com.evil.test/a.jpg",
    "/products/../secret.png",
    "//example.com/a.png",
  ])
    expect(imageSchema.safeParse(url).success).toBe(false);
  expect(
    imageSchema.safeParse(
      "https://abc123.supabase.co/storage/v1/object/public/catalog/front.webp",
    ).success,
  ).toBe(true);
  expect(
    productSchema.safeParse(
      product({ gallery: [{ url: "/products/photo.webp", alt: "" }] }),
    ).success,
  ).toBe(false);
});

it("does not mistake demo photos or missing buying information for completed content", () => {
  const p = productSchema.parse(product());
  expect(
    productReadiness(p)
      .filter((r) => r.ready)
      .map((r) => r.label),
  ).toEqual(["Product description", "Stock available"]);
});

it("accepts the offset timestamps returned by PostgreSQL when editing releases", () => {
  expect(
    productSchema.safeParse(
      product({ status: "scheduled", releaseAt: "2099-01-01T12:00:00+00:00" }),
    ).success,
  ).toBe(true);
  expect(
    productSchema.safeParse(
      product({ status: "scheduled", releaseAt: "2099-01-01T12:00:00" }),
    ).success,
  ).toBe(false);
});
