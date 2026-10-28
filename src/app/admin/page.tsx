import { isAdmin } from "@/lib/auth";
import { products, orders, home, waitlistCount } from "@/lib/db";
import Admin from "@/components/admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  const authorized = await isAdmin();
  return (
    <Admin
      authorized={authorized}
      products={authorized ? await products() : []}
      orders={authorized ? await orders() : []}
      content={authorized ? await home() : { headline: "", subtitle: "" }}
      waitlist={authorized ? await waitlistCount() : 0}
    />
  );
}
