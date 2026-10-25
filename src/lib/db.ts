import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { Product, ProductInput, Order, saleable } from "./model";
let connection: DatabaseSync;
export function db() {
  if (process.env.APP_MODE !== "demo")
    throw new Error(
      "Alleen de lokale demomodus is beschikbaar. Stel APP_MODE=demo in.",
    );
  if (connection) return connection;
  const path = process.env.DATABASE_PATH || "./data/wm-demo.sqlite";
  mkdirSync(dirname(path), { recursive: true });
  connection = new DatabaseSync(path);
  connection.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, idempotency TEXT UNIQUE NOT NULL, body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS waitlist(id TEXT PRIMARY KEY, product_id TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(product_id,email));
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, action TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY, body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);`);
  if (
    !connection.prepare("SELECT id FROM settings WHERE id=?").get("initialized")
  ) {
    const images = [
      "photo-1521572163474-6864f9cf17ab",
      "photo-1576566588028-4147f3842f27",
      "photo-1551028719-00167b16eac5",
      "photo-1473966968600-fa801b869a1a",
      "photo-1620799140408-edc6dcb6d633",
      "photo-1556821840-3a63f95609a7",
    ];
    const names = [
      "The Essential Tee",
      "Studio Heavyweight Tee",
      "The Everyday Jacket",
      "Relaxed Studio Trouser",
      "Signature Crewneck",
      "Off Duty Hoodie",
    ];
    const prices = [6500, 7900, 18900, 12900, 11900, 13900];
    connection.exec("BEGIN IMMEDIATE");
    try {
      // Another app/worker may have initialized the file while this process waited.
      if (
        connection
          .prepare("SELECT id FROM settings WHERE id=?")
          .get("initialized")
      ) {
        connection.exec("COMMIT");
        return connection;
      }
      names.forEach((name, i) => {
        const p: Product = {
          id: randomUUID(),
          name,
          slug: name.toLowerCase().replaceAll(" ", "-"),
          brand: i === 5 ? "OFF HOURS" : i === 3 ? "FORM" : "WM STUDIO",
          category:
            i < 2
              ? "T-shirts"
              : i === 2
                ? "Outerwear"
                : i === 3
                  ? "Trousers"
                  : "Knitwear",
          gender: "Unisex",
          description:
            "Een doordacht silhouet voor je dagelijkse ritme. Een veelzijdige basis met een ontspannen pasvorm en verfijnde details. Dit is fictieve productinformatie voor de ontwikkelomgeving.",
          price: prices[i],
          status: i === 5 ? "scheduled" : "published",
          releaseAt:
            i === 5 ? new Date(Date.now() + 86400000 * 7).toISOString() : null,
          image: `https://images.unsplash.com/${images[i]}?auto=format&fit=crop&w=1200&q=85`,
          variants: ["XS", "S", "M", "L", "XL"].map((size, j) => ({
            size,
            color: i === 0 ? "Off white" : i === 1 ? "Ink black" : "Stone",
            sku: `WM-00${i + 1}-${size}`,
            stock: 8 + j * 2,
          })),
          createdAt: new Date().toISOString(),
        };
        connection
          .prepare("INSERT INTO products VALUES (?,?)")
          .run(p.id, JSON.stringify(p));
      });
      connection
        .prepare("INSERT INTO settings VALUES (?,?)")
        .run("initialized", "true");
      connection.prepare("INSERT INTO settings VALUES (?,?)").run(
        "home",
        JSON.stringify({
          headline: "Made for your\neveryday extraordinary.",
          subtitle:
            "Een onafhankelijke kijk op de garderobe van morgen. Ontdek de eerste editie van WM Studio Collective.",
        }),
      );
      connection.exec("COMMIT");
    } catch (e) {
      connection.exec("ROLLBACK");
      throw e;
    }
  }
  return connection;
}
export function products(): Product[] {
  return db()
    .prepare("SELECT body FROM products")
    .all()
    .map((r) => JSON.parse(r.body as string));
}
export function visibleProducts() {
  return products().filter((p) => saleable(p) || p.status === "scheduled");
}
export function orders(): Order[] {
  return db()
    .prepare("SELECT body FROM orders ORDER BY rowid DESC")
    .all()
    .map((r) => JSON.parse(r.body as string));
}
export function audit(action: string) {
  db()
    .prepare("INSERT INTO audit VALUES (?,?,?)")
    .run(randomUUID(), action, new Date().toISOString());
}
export function saveProduct(input: ProductInput, id?: string) {
  const old = id ? products().find((p) => p.id === id) : undefined;
  if (id && !old) throw new Error("Product niet gevonden");
  if (products().some((p) => p.id !== id && p.slug === input.slug))
    throw new Error("Deze URL bestaat al");
  const otherSkus = products()
    .filter((p) => p.id !== id)
    .flatMap((p) => p.variants.map((v) => v.sku));
  if (input.variants.some((v) => otherSkus.includes(v.sku)))
    throw new Error("Een SKU is al in gebruik");
  const p: Product = {
    ...input,
    id: old?.id || randomUUID(),
    createdAt: old?.createdAt || new Date().toISOString(),
  };
  db()
    .prepare(
      "INSERT INTO products VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body",
    )
    .run(p.id, JSON.stringify(p));
  audit(`Product opgeslagen: ${p.name}`);
  return p;
}
export function home() {
  return JSON.parse(
    db().prepare("SELECT body FROM settings WHERE id=?").get("home")!
      .body as string,
  ) as { headline: string; subtitle: string };
}
export function publishDue(now = Date.now()) {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const due = products().filter(
      (p) =>
        p.status === "scheduled" &&
        p.releaseAt &&
        Date.parse(p.releaseAt) <= now,
    );
    for (const p of due) {
      p.status = "published";
      d.prepare("UPDATE products SET body=? WHERE id=?").run(
        JSON.stringify(p),
        p.id,
      );
      audit(`Release gepubliceerd: ${p.name}`);
    }
    d.exec("COMMIT");
    return due.length;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
export function checkout(input: {
  key: string;
  email: string;
  name: string;
  address: string;
  items: { productId: string; sku: string; quantity: number }[];
}) {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const existing = d
      .prepare("SELECT body FROM orders WHERE idempotency=?")
      .get(input.key);
    if (existing) {
      d.exec("COMMIT");
      return JSON.parse(existing.body as string) as Order;
    }
    const seen = new Set<string>();
    const items = input.items.map((line) => {
      if (seen.has(line.sku)) throw new Error("Dubbele variant");
      seen.add(line.sku);
      const p = products().find((p) => p.id === line.productId);
      if (!p || !saleable(p))
        throw new Error("Dit product is nog niet beschikbaar");
      const v = p.variants.find((v) => v.sku === line.sku);
      if (!v || v.stock < line.quantity)
        throw new Error("Onvoldoende voorraad voor " + p.name);
      return {
        productId: p.id,
        name: p.name,
        sku: v.sku,
        size: v.size,
        color: v.color,
        quantity: line.quantity,
        price: p.price,
      };
    });
    // Re-read each product after each update: several variants can share one product.
    for (const line of items) {
      const p = products().find((p) => p.id === line.productId)!;
      p.variants.find((v) => v.sku === line.sku)!.stock -= line.quantity;
      d.prepare("UPDATE products SET body=? WHERE id=?").run(
        JSON.stringify(p),
        p.id,
      );
    }
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    const shipping = subtotal >= 15000 ? 0 : 495;
    const o: Order = {
      id: randomUUID(),
      number: "WM-" + randomUUID().slice(0, 8).toUpperCase(),
      email: input.email,
      name: input.name,
      address: input.address,
      total: subtotal + shipping,
      shipping,
      status: "paid_demo",
      createdAt: new Date().toISOString(),
      items,
    };
    d.prepare("INSERT INTO orders VALUES (?,?,?)").run(
      o.id,
      input.key,
      JSON.stringify(o),
    );
    audit(`Demo-order geplaatst: ${o.number}`);
    d.exec("COMMIT");
    return o;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
