import { it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { demoProducts } from "../scripts/fixtures";
import { testDatabase } from "./postgres";
it("exports SQLite read-only and imports IDs, stock, releases, orders and settings atomically", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wm-import-"));
  const source = join(dir, "source.sqlite"),
    target = join(dir, "private.import.sql");
  const sqlite = new DatabaseSync(source);
  sqlite.exec(`create table products(id text,body text);create table orders(id text,idempotency text,body text);
 create table waitlist(id text,product_id text,email text,created_at text);create table audit(id text,action text,created_at text);
 create table settings(id text,body text);`);
  const p = demoProducts()[5];
  p.description = "Quote ' and SQL ; -- are data";
  const o = {
    id: randomUUID(),
    number: "WM-TEST",
    email: "test@example.invalid",
    name: "Test",
    address: "Teststraat 1",
    total: 6995,
    shipping: 495,
    status: "paid_demo",
    createdAt: new Date().toISOString(),
    items: [
      {
        productId: p.id,
        sku: p.variants[0].sku,
        price: 6500,
        quantity: 1,
        name: p.name,
        size: "M",
        color: "Stone",
      },
    ],
  };
  sqlite
    .prepare("insert into products values(?,?)")
    .run(p.id, JSON.stringify(p));
  sqlite
    .prepare("insert into orders values(?,?,?)")
    .run(o.id, randomUUID(), JSON.stringify(o));
  sqlite
    .prepare("insert into waitlist values(?,?,?,?)")
    .run(randomUUID(), p.id, "test@example.invalid", o.createdAt);
  sqlite
    .prepare("insert into audit values(?,?,?)")
    .run(randomUUID(), "Old audit", o.createdAt);
  sqlite
    .prepare("insert into settings values('home',?)")
    .run(
      JSON.stringify({
        headline: "Saved headline",
        subtitle: "Saved subtitle",
      }),
    );
  sqlite.close();
  const before = readFileSync(source);
  const exported = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/export-sqlite.ts", source, target],
    { encoding: "utf8" },
  );
  expect(exported.status, exported.stderr).toBe(0);
  expect(readFileSync(source)).toEqual(before);
  const db = await testDatabase();
  try {
    await db.exec(readFileSync(target, "utf8"));
    expect(
      (await db.query<{ body: unknown }>("select body from wm_products"))
        .rows[0].body,
    ).toEqual(p);
    expect(
      (await db.query<{ body: unknown }>("select body from wm_orders")).rows[0]
        .body,
    ).toEqual(o);
    expect((await db.query("select * from wm_waitlist")).rows).toHaveLength(1);
    expect((await db.query("select * from wm_audit")).rows).toHaveLength(1);
    expect(
      (
        await db.query<{ body: { headline: string } }>(
          "select body from wm_settings where id='home'",
        )
      ).rows[0].body.headline,
    ).toBe("Saved headline");
    await expect(db.exec(readFileSync(target, "utf8"))).rejects.toThrow(
      "empty target",
    );
    await db.exec("rollback");
    expect((await db.query("select * from wm_products")).rows).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 60000);
