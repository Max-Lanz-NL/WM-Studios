import { Product, ProductInput, Order } from "./model";
import { database, rpc } from "./supabase";

async function rows<T>(table: string, privileged = false): Promise<T[]> {
  const { data, error } = await database(privileged)
    .from(table)
    .select("body")
    .order("created_at", { ascending: false });
  if (error)
    throw new Error(
      "Databaseverbinding mislukt. Controleer de Supabase-configuratie en migraties.",
    );
  return data.map((r) => r.body as T);
}
// Privileged reads are only used after requireAdmin in the route/page.
export const products = () => rows<Product>("wm_products", true);
export const visibleProducts = () => rows<Product>("wm_products");
export const orders = () => rows<Order>("wm_orders", true);
export const saveProduct = (input: ProductInput, id?: string) =>
  rpc<Product>("wm_save_product", { input, product_id: id || null });
export async function home() {
  const { data, error } = await database()
    .from("wm_settings")
    .select("body")
    .eq("id", "home")
    .single();
  if (error)
    throw new Error(
      "Homepageconfiguratie ontbreekt. Controleer de Supabase-migraties.",
    );
  return data.body as { headline: string; subtitle: string };
}
export const publishDue = (now = Date.now()) =>
  rpc<number>("wm_publish_due", { at_time: new Date(now).toISOString() });
export const updateOrder = (id: string, status: "packed" | "shipped") =>
  rpc("wm_update_order", { order_id: id, next_status: status });
export const saveHome = (content: { headline: string; subtitle: string }) =>
  rpc("wm_save_home", { content });
export const waitlist = (productId: string, email: string) =>
  rpc("wm_join_waitlist", {
    product_id: productId,
    email_address: email.toLowerCase(),
  });
export async function waitlistCount() {
  const { count, error } = await database(true)
    .from("wm_waitlist")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error("Wachtlijst kon niet worden geladen");
  return count || 0;
}
export type CheckoutInput = {
  key: string;
  email: string;
  name: string;
  address: string;
  items: { productId: string; sku: string; quantity: number }[];
};
export function checkout(input: CheckoutInput) {
  if (
    process.env.DEPLOYMENT_ENV !== "staging" ||
    process.env.ENABLE_TEST_CHECKOUT !== "true"
  )
    throw new Error(
      "Bestellen is nog niet beschikbaar. Betalingen zijn uitgeschakeld.",
    );
  return rpc<Order>("wm_checkout", { input });
}
