import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, currentStaff, rateLimit, sameOrigin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase";
import { saveProduct, staffAction } from "@/lib/db";
import { productSchema } from "@/lib/model";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const b = await request.json();
    const client = await sessionClient();
    if (b.action === "login") {
      const input = z
        .object({
          email: z.string().email().max(200),
          password: z.string().min(8).max(200),
        })
        .parse(b);
      await rateLimit("login:" + input.email.toLowerCase(), 8);
      const { error } = await client.auth.signInWithPassword(input);
      if (error)
        return NextResponse.json(
          { error: "Inloggen mislukt. Controleer je gegevens." },
          { status: 401, headers: { "Cache-Control": "private, no-store" } },
        );
      if (!(await currentStaff())) {
        await client.auth.signOut();
        return NextResponse.json(
          { error: "Dit account heeft geen actieve medewerkerstoegang." },
          { status: 403 },
        );
      }
    } else if (b.action === "logout") {
      await client.auth.signOut();
    } else if (b.action === "product") {
      await requireAdmin("catalog.write");
      return NextResponse.json(
        await saveProduct(
          productSchema.parse(b.product),
          b.id ? z.string().uuid().parse(b.id) : undefined,
        ),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } else if (b.action === "order") {
      await requireAdmin("orders.write");
      await staffAction(
        "order",
        z
          .object({
            id: z.string().uuid(),
            status: z.enum(["packed", "shipped"]),
          })
          .parse(b),
      );
    } else if (b.action === "home") {
      await requireAdmin("content.write");
      await staffAction(
        "home",
        z
          .object({
            headline: z.string().min(2).max(150),
            subtitle: z.string().max(500),
          })
          .parse(b.content),
      );
    } else {
      await requireAdmin();
      throw new Error("Onbekende actie");
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verzoek mislukt";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Controleer de ingevulde gegevens"
            : status === 401
              ? "Log eerst in"
              : status === 403
                ? "Je hebt geen rechten voor deze actie"
                : message,
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
