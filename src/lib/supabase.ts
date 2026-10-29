import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configuration } from "./config";
export function publicClient() {
  const { url, key } = configuration();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
export function serviceClient() {
  const { url } = configuration();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key)
    throw new Error(
      "Configureer SUPABASE_SECRET_KEY uitsluitend op de server.",
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function sessionClient() {
  const store = await cookies();
  const { url, key, environment } = configuration();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: environment === "staging",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Proxy persists refreshes for read-only Server Components. */
        }
      },
    },
  });
}
