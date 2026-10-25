import { z } from "zod";
export const variantSchema = z.object({
  size: z.string().min(1).max(20),
  color: z.string().min(1).max(40),
  sku: z.string().min(1).max(80),
  stock: z.coerce.number().int().min(0).max(100000),
});
export const productSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120),
    brand: z.enum(["WM STUDIO", "FORM", "OFF HOURS"]),
    category: z.enum(["T-shirts", "Knitwear", "Outerwear", "Trousers"]),
    gender: z.enum(["Unisex", "Men", "Women"]),
    description: z.string().max(5000),
    price: z.coerce.number().int().min(100).max(1000000),
    status: z.enum([
      "draft",
      "review",
      "approved",
      "scheduled",
      "published",
      "archived",
    ]),
    releaseAt: z.string().datetime().nullable(),
    image: z
      .string()
      .url()
      .refine(
        (v) => v.startsWith("https://images.unsplash.com/"),
        "Gebruik een Unsplash-afbeelding",
      ),
    variants: z.array(variantSchema).min(1).max(100),
    version: z.number().int().positive().optional(),
  })
  .superRefine((p, c) => {
    if (p.status === "scheduled" && !p.releaseAt)
      c.addIssue({
        code: "custom",
        message: "Een ingepland product vereist een releasedatum",
        path: ["releaseAt"],
      });
    if (new Set(p.variants.map((v) => v.sku)).size !== p.variants.length)
      c.addIssue({
        code: "custom",
        message: "SKU’s moeten uniek zijn",
        path: ["variants"],
      });
  });
export type ProductInput = z.infer<typeof productSchema>;
export type Product = ProductInput & { id: string; createdAt: string };
export type Order = {
  id: string;
  number: string;
  email: string;
  name: string;
  address: string;
  total: number;
  shipping: number;
  status:
    | "pending_payment"
    | "paid_demo"
    | "paid"
    | "cancelled"
    | "expired"
    | "packed"
    | "shipped";
  createdAt: string;
  items: {
    productId: string;
    name: string;
    sku: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }[];
};
export function saleable(
  p: Pick<Product, "status" | "releaseAt">,
  now = Date.now(),
) {
  return (
    (p.status === "published" || p.status === "scheduled") &&
    (!p.releaseAt || Date.parse(p.releaseAt) <= now)
  );
}
export const euro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
export const date = (s: string) =>
  new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(s));
