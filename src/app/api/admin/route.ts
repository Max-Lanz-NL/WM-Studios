import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  equal,
  sign,
  isAdmin,
  requireAdmin,
  rateLimit,
  sameOrigin,
} from "@/lib/auth";
import { db, saveProduct, orders, audit } from "@/lib/db";
import { productSchema } from "@/lib/model";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const b = await request.json();
    if (b.action === "login") {
      rateLimit("admin-login");
      const password = process.env.ADMIN_PASSWORD;
      if (!password || password.length < 12)
        throw new Error("Configureer eerst een beheerwachtwoord (12+ tekens)");
      if (
        typeof b.password !== "string" ||
        !equal(sign(b.password), sign(password))
      )
        return NextResponse.json(
          { error: "Onjuist wachtwoord" },
          { status: 401 },
        );
      const exp = String(Date.now() + 8 * 3600000);
      (await cookies()).set("wm_admin", exp + "." + sign(exp), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 28800,
      });
      return NextResponse.json({ ok: true });
    }
    await requireAdmin();
    if (b.action === "logout") {
      (await cookies()).delete("wm_admin");
      return NextResponse.json({ ok: true });
    }
    if (b.action === "product")
      return NextResponse.json(
        saveProduct(
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
      const o = orders().find((o) => o.id === id);
      if (!o) throw new Error("Order niet gevonden");
      if (
        (status === "packed" && o.status !== "paid_demo") ||
        (status === "shipped" && o.status !== "packed")
      )
        throw new Error("Ongeldige statusovergang");
      o.status = status;
      db()
        .prepare("UPDATE orders SET body=? WHERE id=?")
        .run(JSON.stringify(o), id);
      audit(`${o.number}: ${status}`);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "home") {
      const content = z
        .object({
          headline: z.string().min(2).max(150),
          subtitle: z.string().max(500),
        })
        .parse(b.content);
      db()
        .prepare("UPDATE settings SET body=? WHERE id=?")
        .run(JSON.stringify(content), "home");
      audit("Homepage gewijzigd");
      return NextResponse.json({ ok: true });
    }
    throw new Error("Onbekende actie");
  } catch (e) {
    const unauthorized = e instanceof Error && e.message === "UNAUTHORIZED";
    return NextResponse.json(
      {
        error: unauthorized
          ? "Log eerst in"
          : e instanceof z.ZodError
            ? "Controleer de productgegevens"
            : e instanceof Error
              ? e.message
              : "Verzoek mislukt",
      },
      { status: unauthorized ? 401 : 400 },
    );
  }
}
