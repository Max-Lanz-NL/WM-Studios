import { NextResponse } from "next/server";
import { z } from "zod";
import { checkout, waitlist } from "@/lib/db";
import { rateLimit, sameOrigin } from "@/lib/auth";
import { ConfigurationError } from "@/lib/supabase";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const b = await request.json();
    if (b.action === "checkout") {
      await rateLimit("checkout", 60);
      const input = z
        .object({
          key: z.string().uuid(),
          email: z.string().email().max(200),
          name: z.string().trim().min(2).max(100),
          address: z.string().trim().min(10).max(500),
          items: z
            .array(
              z.object({
                productId: z.string().uuid(),
                sku: z.string().max(80),
                quantity: z.number().int().min(1).max(20),
              }),
            )
            .min(1)
            .max(30),
        })
        .parse(b);
      const o = await checkout(input);
      return NextResponse.json({ number: o.number, total: o.total });
    }
    if (b.action === "waitlist") {
      await rateLimit("waitlist", 30);
      const input = z
        .object({
          productId: z.string().uuid(),
          email: z.string().email().max(200),
          consent: z.literal(true),
        })
        .parse(b);
      await waitlist(input.productId, input.email);
      return NextResponse.json({ ok: true });
    }
    throw new Error("Onbekende actie");
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Controleer de ingevulde gegevens"
            : e instanceof Error
              ? e.message
              : "Verzoek mislukt",
      },
      {
        status: e instanceof ConfigurationError ? 503 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
