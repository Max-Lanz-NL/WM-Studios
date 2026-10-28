import { NextResponse } from "next/server";
import { equal } from "@/lib/auth";
import { publishDue } from "@/lib/db";
import { required } from "@/lib/supabase";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const secret = required("CRON_SECRET");
    if (secret.length < 32)
      throw new Error("Configureer CRON_SECRET met minimaal 32 tekens");
    if (!equal(request.headers.get("authorization") || "", `Bearer ${secret}`))
      return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 });
    return NextResponse.json(
      { published: await publishDue() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Releasecontrole mislukt. Controleer configuratie en database.",
      },
      { status: 503 },
    );
  }
}
