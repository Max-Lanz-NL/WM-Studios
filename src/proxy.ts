import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { configuration, configured } from "./lib/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!configured()) return response;
  const { url, key, environment } = configuration();
  const client = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: environment === "staging",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
