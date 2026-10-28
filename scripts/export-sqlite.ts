// Offline, read-only exporter. Never connects to Supabase or changes the source.
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { productSchema } from "../src/lib/model";
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error(
    "Gebruik: pnpm export:sqlite <bron.sqlite> <privaat-doel.sql>",
  );
if (resolve(source) === resolve(destination))
  throw new Error("Bron en doel moeten verschillen");
const db = new DatabaseSync(resolve(source), { readOnly: true });
const quote = (value: unknown) =>
  "'" + String(value).replaceAll("'", "''") + "'";
const json = (value: unknown) => quote(JSON.stringify(value)) + "::jsonb";
const uuid = z.string().uuid();
const sql = [
  "begin;",
  "set local standard_conforming_strings = on;",
  `do $$ begin
 if exists(select 1 from public.wm_products) or exists(select 1 from public.wm_orders) or exists(select 1 from public.wm_waitlist)
 then raise exception 'Import requires an empty target'; end if; end $$;`,
];
try {
  for (const row of db.prepare("select id,body from products").all()) {
    const p = JSON.parse(String(row.body));
    productSchema.parse(p);
    uuid.parse(p.id);
    if (p.id !== row.id) throw new Error("Product-ID komt niet overeen");
    sql.push(
      `insert into public.wm_products(id,body,created_at) values(${quote(p.id)},${json(p)},${quote(z.string().datetime().parse(p.createdAt))});`,
    );
    for (const v of p.variants)
      sql.push(
        `insert into public.wm_skus(sku,product_id) values(${quote(v.sku)},${quote(p.id)});`,
      );
  }
  for (const row of db
    .prepare("select id,idempotency,body from orders")
    .all()) {
    const o = JSON.parse(String(row.body));
    uuid.parse(o.id);
    uuid.parse(row.id);
    uuid.parse(row.idempotency);
    if (o.id !== row.id) throw new Error("Order-ID komt niet overeen");
    sql.push(
      `insert into public.wm_orders(id,idempotency,request_hash,body,created_at) values(${quote(row.id)},${quote(row.idempotency)},'legacy-import',${json(o)},${quote(z.string().datetime().parse(o.createdAt))});`,
    );
  }
  for (const r of db.prepare("select * from waitlist").all()) {
    uuid.parse(r.id);
    uuid.parse(r.product_id);
    sql.push(
      `insert into public.wm_waitlist(id,product_id,email,created_at) values(${quote(r.id)},${quote(r.product_id)},${quote(r.email)},${quote(r.created_at)});`,
    );
  }
  for (const r of db.prepare("select * from audit").all()) {
    uuid.parse(r.id);
    sql.push(
      `insert into public.wm_audit(id,action,created_at) values(${quote(r.id)},${quote(r.action)},${quote(r.created_at)});`,
    );
  }
  const home = db.prepare("select body from settings where id='home'").get();
  if (home)
    sql.push(
      `update public.wm_settings set body=${json(JSON.parse(String(home.body)))} where id='home';`,
    );
  sql.push("commit;");
  writeFileSync(resolve(destination), sql.join("\n"), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Export aangemaakt. Bevat mogelijk persoonsgegevens: beveilig het bestand en voer eerst een staging-import uit.",
  );
} finally {
  db.close();
}
