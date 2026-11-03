import { currentStaff } from "@/lib/auth";
import { products, orders, home, waitlistCount } from "@/lib/db";
import { configured } from "@/lib/config";
import ConfigurationNeeded from "@/components/configuration-needed";
import Admin from "@/components/admin";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured()) return <ConfigurationNeeded />;
  const staff = await currentStaff();
  const can = (p: string) => !!staff?.permissions.includes(p);
  return (
    <Admin
      authorized={!!staff}
      staff={staff}
      products={can("catalog.write") ? await products() : []}
      orders={can("orders.read") ? await orders() : []}
      content={await home()}
      waitlist={can("catalog.write") ? await waitlistCount() : 0}
    />
  );
}
