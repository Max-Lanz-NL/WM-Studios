import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { publicClient, sessionClient, serviceClient } from "./supabase";
import type { Product, ProductInput, Order } from "./model";
function fail(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "P0001") throw new Error(error.message);
  if (error.code === "42501") throw new Error("FORBIDDEN");
  if (error.code === "23505")
    throw new Error(
      "Deze URL, SKU of combinatie van maat en kleur bestaat al.",
    );
  if (["23514", "23502", "22P02"].includes(error.code || ""))
    throw new Error("Controleer de ingevulde gegevens.");
  throw new Error("De centrale database is tijdelijk niet beschikbaar.");
}
async function catalog(client: SupabaseClient): Promise<Product[]> {
  const { data, error } = await client.from("catalog").select("body");
  fail(error);
  return (data || []).map((r) => r.body as Product);
}
export async function products() {
  return catalog(await sessionClient());
}
export async function visibleProducts() {
  return catalog(publicClient());
}
export async function orders(): Promise<Order[]> {
  const { data, error } = await (
    await sessionClient()
  )
    .from("order_overview")
    .select("body");
  fail(error);
  return (data || [])
    .map((r) => r.body as Order)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function home() {
  const { data, error } = await publicClient()
    .from("content_settings")
    .select("body")
    .eq("id", "home")
    .single();
  fail(error);
  return data!.body as { headline: string; subtitle: string };
}
export async function saveProduct(input: ProductInput, id?: string) {
  const client = await sessionClient();
  const { data, error } = await client.rpc("save_product", {
    payload: input,
    target_id: id || randomUUID(),
    expected_version: input.version ?? null,
  });
  fail(error);
  const { data: row, error: readError } = await client
    .from("catalog")
    .select("body")
    .eq("id", data)
    .single();
  fail(readError);
  return row!.body as Product;
}
export async function staffAction(action: "home" | "order", payload: unknown) {
  const { error } = await (
    await sessionClient()
  ).rpc("staff_action", { action, payload });
  fail(error);
}
export async function waitlistCount() {
  const { count, error } = await (
    await sessionClient()
  )
    .from("release_waitlist")
    .select("id", { head: true, count: "exact" });
  fail(error);
  return count || 0;
}
export async function joinWaitlist(productId: string, email: string) {
  const { error } = await serviceClient().rpc("join_waitlist", {
    product: productId,
    email_address: email,
  });
  fail(error);
}
export type CheckoutInput = {
  key: string;
  email: string;
  name: string;
  address: string;
  items: { productId: string; sku: string; quantity: number }[];
};
export async function checkout(input: CheckoutInput) {
  const { data, error } = await serviceClient().rpc("checkout_staging", {
    payload: input,
    reserve_only: false,
  });
  fail(error);
  return data as { id: string; number: string; total: number; status: string };
}
