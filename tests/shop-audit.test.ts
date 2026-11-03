import { it, expect } from "vitest";
import { reconcileCart, checkoutFingerprint } from "../src/lib/cart";
import { homeSchema } from "../src/lib/shop-content";
import type { Product } from "../src/lib/model";
const p: Product = {
  id: "test",
  createdAt: "2026-01-01T00:00:00Z",
  name: "Test piece",
  slug: "test-piece",
  brand: "WM STUDIO",
  category: "T-shirts",
  gender: "Unisex",
  description: "Test",
  price: 6500,
  status: "published",
  releaseAt: null,
  image: "/products/test.webp",
  variants: [{ size: "M", color: "White", sku: "TEST-M", stock: 3 }],
};
it("sanitises malformed and duplicate bag entries against availability", () => {
  const raw = [
    null,
    false,
    {},
    { productId: "test", sku: "TEST-M", quantity: 2 },
    { productId: "test", sku: "TEST-M", quantity: 50 },
    { productId: "missing", sku: "X", quantity: 1 },
  ];
  expect(reconcileCart(raw, [p])).toEqual({
    lines: [{ productId: "test", sku: "TEST-M", quantity: 3 }],
    changed: true,
  });
  expect(
    reconcileCart(
      [{ productId: "test", sku: "TEST-M", quantity: 1 }],
      [{ ...p, status: "scheduled", releaseAt: "2099-01-01T00:00:00Z" }],
    ).lines,
  ).toEqual([]);
  expect(
    reconcileCart(
      [{ productId: "test", sku: "TEST-M", quantity: 1 }],
      [{ ...p, variants: [{ ...p.variants[0], stock: 0 }] }],
    ).lines,
  ).toEqual([]);
  expect(reconcileCart({ invalid: true }, [p]).lines).toEqual([]);
});
it("keeps an already valid bag intact", () => {
  const lines = [{ productId: "test", sku: "TEST-M", quantity: 2 }];
  expect(reconcileCart(lines, [p])).toEqual({ lines, changed: false });
});
it("creates a stable non-readable checkout fingerprint and changes it with details", async () => {
  const data = {
    email: "demo@example.invalid",
    items: [{ sku: "TEST-M", quantity: 1 }],
  };
  const first = await checkoutFingerprint(data);
  expect(first).toMatch(/^[0-9a-f]{64}$/);
  expect(await checkoutFingerprint(data)).toBe(first);
  expect(
    await checkoutFingerprint({ ...data, email: "other@example.invalid" }),
  ).not.toBe(first);
});
it("validates public service content and rejects unsafe contact links", () => {
  expect(
    homeSchema.safeParse({
      headline: "Studio MW",
      subtitle: "",
      services: { contactEmail: "javascript:alert(1)" },
    }).success,
  ).toBe(false);
  expect(
    homeSchema.safeParse({
      headline: "Studio MW",
      subtitle: "",
      services: {
        contactEmail: "studio@example.invalid",
        returns: "Test returns",
      },
    }).success,
  ).toBe(true);
});
