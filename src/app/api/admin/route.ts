import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminCookie, requireAdmin, rateLimit, sameOrigin } from "@/lib/auth";
import { saveProduct, updateOrder, saveHome } from "@/lib/db";
import { database, ConfigurationError } from "@/lib/supabase";
import { productSchema } from "@/lib/model";
export const runtime = "nodejs";
function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const b = await request.json();
    if (b.action === "login") {
      await rateLimit("admin-login");
      const input = z
        .object({
          email: z.string().email().max(200),
          password: z.string().min(1).max(200),
        })
        .parse(b);
      const client = database();
      const { data, error } = await client.auth.signInWithPassword(input);
      if (error || !data.session || data.user?.app_metadata?.role !== "admin") {
        if (data.session) await client.auth.signOut();
        return json(
          { error: "Onjuiste inloggegevens of geen beheertoegang" },
          401,
        );
      }
      // Server-only, short session. No refresh token is stored or returned to JS.
      (await cookies()).set(adminCookie, data.session.access_token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.min(data.session.expires_in, 3600),
      });
      return json({ ok: true });
    }
    if (b.action === "logout") {
      // __Host- cookies must retain Secure even when being expired.
      (await cookies()).set(adminCookie, "", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      return json({ ok: true });
    }
    await requireAdmin();
    if (b.action === "product")
      return json(
        await saveProduct(
          productSchema.parse(b.product),
          b.id ? z.string().uuid().parse(b.id) : undefined,
        ),
      );
    if (b.action === "order") {
      const { id, status } = z
        .object({
          id: z.string().uuid(),
          status: z.enum(["packed", "shipped"]),
        })
        .parse(b);
      await updateOrder(id, status);
      return json({ ok: true });
    }
    if (b.action === "home") {
      await saveHome(
        z
          .object({
            headline: z.string().min(2).max(150),
            subtitle: z.string().max(500),
          })
          .parse(b.content),
      );
      return json({ ok: true });
    }
    throw new Error("Onbekende actie");
  } catch (e) {
    const unauthorized = e instanceof Error && e.message === "UNAUTHORIZED";
    return json(
      {
        error: unauthorized
          ? "Log eerst in"
          : e instanceof z.ZodError
            ? "Controleer de ingevulde gegevens"
            : e instanceof Error
              ? e.message
              : "Verzoek mislukt",
      },
      unauthorized ? 401 : e instanceof ConfigurationError ? 503 : 400,
    );
  }
}
