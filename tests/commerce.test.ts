import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkout,
  products,
  saveProduct,
  orders,
  publishDue,
} from "../src/lib/db";
import { saleable, productSchema, date } from "../src/lib/model";
beforeAll(() => {
  process.env.APP_MODE = "demo";
  process.env.DATABASE_PATH = join(
    mkdtempSync(join(tmpdir(), "wm-test-")),
    "test.sqlite",
  );
});
const customer = () => ({
  key: randomUUID(),
  email: "test@example.invalid",
  name: "Demo Test",
  address: "Teststraat 1, 1000 AA, Teststad",
});
describe("releases en validatie", () => {
  it("blokkeert een directe aankoop vóór verkoopstart", () => {
    const p = products().find((p) => p.status === "scheduled")!;
    expect(() =>
      checkout({
        ...customer(),
        items: [{ productId: p.id, sku: p.variants[0].sku, quantity: 1 }],
      }),
    ).toThrow("nog niet beschikbaar");
  });
  it("laat verkoop precies op de releasegrens toe", () => {
    const p = {
      status: "scheduled" as const,
      releaseAt: "2026-10-25T01:00:00.000Z",
    };
    expect(saleable(p, Date.parse(p.releaseAt) - 1)).toBe(false);
    expect(saleable(p, Date.parse(p.releaseAt))).toBe(true);
  });
  it("blokkeert concepten, reviews en archieven", () => {
    for (const status of ["draft", "review", "approved", "archived"] as const)
      expect(saleable({ status, releaseAt: null })).toBe(false);
  });
  it("verwerkt wintertijd op de Amsterdamse datumgrens", () => {
    expect(date("2026-10-25T00:30:00.000Z")).toContain("02:30");
    expect(date("2026-10-25T01:30:00.000Z")).toContain("02:30");
    expect(date("2026-07-01T12:00:00.000Z")).toContain("14:00");
    expect(date("2026-12-01T12:00:00.000Z")).toContain("13:00");
  });
  it("vereist een releasedatum voor ingeplande producten", () => {
    const p = products()[0];
    expect(
      productSchema.safeParse({ ...p, status: "scheduled", releaseAt: null })
        .success,
    ).toBe(false);
  });
  it("publiceert verschuldigde releases eenmaal, ook zonder bezoeker", () => {
    const original = products()[0];
    const p = saveProduct({
      ...original,
      name: "Timed release",
      slug: "timed-release",
      status: "scheduled",
      releaseAt: "2026-01-01T12:00:00.000Z",
      variants: [{ size: "M", color: "Black", sku: "TIMED-M", stock: 5 }],
    });
    expect(publishDue(Date.parse("2026-01-01T11:59:59Z"))).toBe(0);
    expect(publishDue(Date.parse("2026-01-01T12:00:00Z"))).toBe(1);
    expect(products().find((x) => x.id === p.id)!.status).toBe("published");
    expect(publishDue(Date.parse("2026-01-01T12:00:01Z"))).toBe(0);
  });
  it("publiceert een geannuleerde release niet", () => {
    const original = products()[0];
    const p = saveProduct({
      ...original,
      name: "Cancelled release",
      slug: "cancelled-release",
      status: "scheduled",
      releaseAt: "2026-01-02T12:00:00.000Z",
      variants: [{ size: "M", color: "Black", sku: "CANCEL-M", stock: 5 }],
    });
    saveProduct({ ...p, status: "draft" }, p.id);
    publishDue(Date.parse("2026-01-02T12:00:01Z"));
    expect(products().find((x) => x.id === p.id)!.status).toBe("draft");
  });
  it("weigert negatieve voorraad en onveilige media", () => {
    const p = products()[0];
    expect(
      productSchema.safeParse({
        ...p,
        variants: [{ ...p.variants[0], stock: -1 }],
      }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ ...p, image: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
});
describe("transactionele demo-checkout", () => {
  it("berekent prijzen uit de database en bewaart een snapshot", () => {
    const p = products()[0],
      v = p.variants[0];
    const o = checkout({
      ...customer(),
      items: [{ productId: p.id, sku: v.sku, quantity: 2 }],
    });
    expect(o.total).toBe(p.price * 2 + (p.price * 2 >= 15000 ? 0 : 495));
    expect(products().find((x) => x.id === p.id)!.variants[0].stock).toBe(
      v.stock - 2,
    );
    saveProduct({ ...p, price: p.price + 1000 }, p.id);
    expect(orders().find((x) => x.id === o.id)!.items[0].price).toBe(p.price);
  });
  it("verwerkt dezelfde aanvraag exact één keer", () => {
    const p = products()[1],
      v = p.variants[0],
      c = {
        ...customer(),
        items: [{ productId: p.id, sku: v.sku, quantity: 1 }],
      };
    const a = checkout(c),
      b = checkout(c);
    expect(a.id).toBe(b.id);
    expect(products().find((x) => x.id === p.id)!.variants[0].stock).toBe(
      v.stock - 1,
    );
  });
  it("draait de volledige bestelling terug bij onvoldoende voorraad", () => {
    const p = products()[2],
      v = p.variants[0];
    const before = orders().length;
    expect(() =>
      checkout({
        ...customer(),
        items: [
          { productId: p.id, sku: v.sku, quantity: 1 },
          { productId: p.id, sku: p.variants[1].sku, quantity: 999999 },
        ],
      }),
    ).toThrow("Onvoldoende");
    expect(products().find((x) => x.id === p.id)!.variants[0].stock).toBe(
      v.stock,
    );
    expect(orders().length).toBe(before);
  });
  it("verwerkt meerdere maten van één product correct", () => {
    const p = products()[3],
      a = p.variants[0],
      b = p.variants[1];
    checkout({
      ...customer(),
      items: [
        { productId: p.id, sku: a.sku, quantity: 1 },
        { productId: p.id, sku: b.sku, quantity: 2 },
      ],
    });
    const updated = products().find((x) => x.id === p.id)!;
    expect(updated.variants[0].stock).toBe(a.stock - 1);
    expect(updated.variants[1].stock).toBe(b.stock - 2);
  });
  it("voorkomt dubbele SKU-regels", () => {
    const p = products()[0];
    const line = { productId: p.id, sku: p.variants[0].sku, quantity: 1 };
    expect(() => checkout({ ...customer(), items: [line, line] })).toThrow(
      "Dubbele",
    );
  });
  it("verkoopt het laatste artikel eenmaal", () => {
    const original = products()[0];
    const p = saveProduct({
      ...original,
      name: "Laatste exemplaar",
      slug: "laatste-exemplaar",
      variants: [{ size: "M", color: "Black", sku: "LAST-M", stock: 1 }],
    });
    checkout({
      ...customer(),
      items: [{ productId: p.id, sku: "LAST-M", quantity: 1 }],
    });
    expect(() =>
      checkout({
        ...customer(),
        items: [{ productId: p.id, sku: "LAST-M", quantity: 1 }],
      }),
    ).toThrow("Onvoldoende");
    expect(products().find((x) => x.id === p.id)!.variants[0].stock).toBe(0);
  });
  it("voorkomt dubbele slugs en SKU’s in productbeheer", () => {
    const p = products()[0];
    expect(() => saveProduct(p)).toThrow("URL");
    expect(() => saveProduct({ ...p, slug: "new-product" })).toThrow("SKU");
  });
});
