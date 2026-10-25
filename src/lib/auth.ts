import { sessionClient, serviceClient } from "./supabase";
export type Staff = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
};
export async function currentStaff(): Promise<Staff | null> {
  const client = await sessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: member, error: membershipError } = await client
    .from("staff_members")
    .select("role,active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError)
    throw new Error("Medewerkerrechten konden niet worden gecontroleerd.");
  if (!member?.active) return null;
  const { data, error: permissionError } = await client
    .from("role_permissions")
    .select("permission")
    .eq("role", member.role);
  if (permissionError)
    throw new Error("Medewerkerrechten konden niet worden gecontroleerd.");
  return {
    id: user.id,
    email: user.email || "",
    role: member.role,
    permissions: (data || []).map((p) => p.permission),
  };
}
export async function requireAdmin(permission?: string) {
  const staff = await currentStaff();
  if (!staff) throw new Error("UNAUTHORIZED");
  if (permission && !staff.permissions.includes(permission))
    throw new Error("FORBIDDEN");
  return staff;
}
export async function rateLimit(key: string, max = 8) {
  const { data, error } = await serviceClient().rpc("check_rate_limit", {
    bucket: key,
    max_requests: max,
  });
  if (error) throw new Error("Verzoekcontrole tijdelijk niet beschikbaar");
  if (!data)
    throw new Error("Te veel verzoeken. Probeer het over een minuut opnieuw.");
}
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  const expected =
    process.env.APP_ORIGIN ||
    `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (request.headers.get("origin") !== expected)
    throw new Error("Ongeldige herkomst");
}
