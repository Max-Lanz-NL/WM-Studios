import { saleable, type Product } from "./model";
export type CartLine = { productId: string; sku: string; quantity: number };

/** Treat browser storage as untrusted; reconcile against the current catalog. */
export function reconcileCart(
  raw: unknown,
  products: Product[],
  now = Date.now(),
) {
  const lines: CartLine[] = [];
  if (!Array.isArray(raw)) return { lines, changed: raw != null };
  for (const item of raw.slice(0, 100)) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.productId !== "string" ||
      typeof item.sku !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )
      continue;
    const product = products.find((p) => p.id === item.productId);
    const variant = product?.variants.find((v) => v.sku === item.sku);
    if (!product || !variant || !saleable(product, now) || variant.stock < 1)
      continue;
    const existing = lines.find((l) => l.sku === item.sku);
    const quantity = Math.min(
      20,
      variant.stock,
      item.quantity + (existing?.quantity || 0),
    );
    if (existing) existing.quantity = quantity;
    else if (lines.length < 30)
      lines.push({ productId: product.id, sku: variant.sku, quantity });
  }
  return { lines, changed: JSON.stringify(raw) !== JSON.stringify(lines) };
}

export function saveBrowserValue(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Stable across reloads after a lost response, without storing checkout PII. */
export async function checkoutFingerprint(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
