import { isAdmin } from "@/lib/auth";
import { products, orders, home, db } from "@/lib/db";
import Admin from "@/components/admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  const authorized = await isAdmin();
  return (
    <Admin
      authorized={authorized}
      products={authorized ? products() : []}
      orders={authorized ? orders() : []}
      content={authorized ? home() : { headline: "", subtitle: "" }}
      waitlist={
        authorized
          ? Number(db().prepare("SELECT COUNT(*) as n FROM waitlist").get()!.n)
          : 0
      }
    />
  );
}
