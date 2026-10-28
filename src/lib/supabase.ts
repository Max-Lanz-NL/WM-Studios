import { createClient } from "@supabase/supabase-js";

export class ConfigurationError extends Error {}
export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigurationError(`Configuratie ontbreekt: ${name}`);
  return value;
}
// Create clients per request: never share user sessions on warm instances.
export function database(privileged = false) {
  const url = required("SUPABASE_URL");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConfigurationError("Ongeldige configuratie: SUPABASE_URL");
  }
  if (
    parsed.protocol !== "https:" &&
    !(
      ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      !process.env.VERCEL
    )
  )
    throw new ConfigurationError("SUPABASE_URL vereist HTTPS");
  return createClient(
    url,
    required(privileged ? "SUPABASE_SECRET_KEY" : "SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    },
  );
}
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await database(true).rpc(name, args);
  if (error) {
    if (error.code === "P0001")
      throw new Error(
        error.message.startsWith("WM:")
          ? error.message.slice(3)
          : "Databaseverzoek geweigerd",
      );
    throw new Error(
      "Databaseverzoek mislukt. Controleer de verbinding en migraties.",
    );
  }
  return data as T;
}
