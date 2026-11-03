import type { ProductInput } from "./model";

/** Editorial checks, not a legal or payment-readiness certification. */
export function productReadiness(p: ProductInput) {
  return [
    { label: "Product description", ready: Boolean(p.description.trim()) },
    {
      label: "Own primary photograph",
      ready: Boolean(p.image) && !p.image.includes("images.unsplash.com"),
    },
    {
      label: "Additional product views",
      ready: (p.gallery || []).some(
        (g) => g.url !== p.image && !g.url.includes("images.unsplash.com"),
      ),
    },
    { label: "Material composition", ready: Boolean(p.material?.trim()) },
    { label: "Fit information", ready: Boolean(p.fit?.trim()) },
    { label: "Care instructions", ready: Boolean(p.care?.trim()) },
    { label: "Size guide", ready: Boolean(p.sizeGuide?.trim()) },
    { label: "Stock available", ready: p.variants.some((v) => v.stock > 0) },
  ];
}
