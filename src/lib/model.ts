import { z } from "zod";
// Browser-loaded assets only. Keep original demo URLs valid while allowing
// owned static assets and public Supabase Storage objects.
export const imageSchema = z
  .string()
  .max(2000)
  .refine((value) => {
    if (/^\/products\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|avif)$/i.test(value))
      return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.port &&
        (url.hostname === "images.unsplash.com" ||
          (/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) &&
            url.pathname.startsWith("/storage/v1/object/public/")))
      );
    } catch {
      return false;
    }
  }, "Use a /products/ image path, public Supabase Storage URL or Unsplash URL");
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
    releaseAt: z.iso.datetime({ offset: true }).nullable(),
    image: imageSchema,
    gallery: z
      .array(
        z.object({ url: imageSchema, alt: z.string().trim().min(1).max(200) }),
      )
      .max(8)
      .optional(),
    material: z.string().trim().max(2000).optional(),
    fit: z.string().trim().max(2000).optional(),
    care: z.string().trim().max(2000).optional(),
    sizeGuide: z.string().trim().max(4000).optional(),
    variants: z.array(variantSchema).min(1).max(100),
    version: z.number().int().positive().optional(),
  })
  .superRefine((p, c) => {
    if (p.status === "scheduled" && !p.releaseAt)
      c.addIssue({
        code: "custom",
        message: "A scheduled product requires a release date",
        path: ["releaseAt"],
      });
    if (new Set(p.variants.map((v) => v.sku)).size !== p.variants.length)
      c.addIssue({
        code: "custom",
        message: "SKUs must be unique",
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
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
export const date = (s: string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(s));
