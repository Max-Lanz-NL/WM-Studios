import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, currentStaff, rateLimit, sameOrigin } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase";
import { saveProduct, staffAction, home as readHome } from "@/lib/db";
import { productSchema } from "@/lib/model";
import { homeSchema } from "@/lib/shop-content";
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
          { error: "Sign-in failed. Check your details." },
          { status: 401, headers: { "Cache-Control": "private, no-store" } },
        );
      if (!(await currentStaff())) {
        await client.auth.signOut();
        return NextResponse.json(
          { error: "This account does not have active staff access." },
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
      const content = homeSchema.parse(b.content);
      if (content.services === undefined)
        content.services = (await readHome()).services;
      await staffAction("home", content);
    } else {
      await requireAdmin();
      throw new Error("Unknown action");
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Please check the details you entered"
            : status === 401
              ? "Please sign in first"
              : status === 403
                ? "You do not have permission to perform this action"
                : message,
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
