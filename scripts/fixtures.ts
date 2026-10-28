import { randomUUID } from "node:crypto";
import type { Product } from "../src/lib/model";
export function demoProducts(): Product[] {
  const names = [
    "The Essential Tee",
    "Studio Heavyweight Tee",
    "The Everyday Jacket",
    "Relaxed Studio Trouser",
    "Signature Crewneck",
    "Off Duty Hoodie",
  ];
  const images = [
    "photo-1521572163474-6864f9cf17ab",
    "photo-1576566588028-4147f3842f27",
    "photo-1551028719-00167b16eac5",
    "photo-1473966968600-fa801b869a1a",
    "photo-1620799140408-edc6dcb6d633",
    "photo-1556821840-3a63f95609a7",
  ];
  return names.map((name, i) => ({
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
    description: "Fictief testproduct voor ontwikkeling en staging.",
    price: [6500, 7900, 18900, 12900, 11900, 13900][i],
    status: i === 5 ? "scheduled" : "published",
    releaseAt:
      i === 5 ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
    image: `https://images.unsplash.com/${images[i]}?auto=format&fit=crop&w=1200&q=85`,
    variants: ["XS", "S", "M", "L", "XL"].map((size, j) => ({
      size,
      color: i === 0 ? "Off white" : "Stone",
      sku: `WM-00${i + 1}-${size}`,
      stock: 8 + j * 2,
    })),
    createdAt: new Date().toISOString(),
  }));
}
