import { visibleProducts, home } from "@/lib/db";
import Storefront from "@/components/storefront";
import { configured } from "@/lib/config";
import ConfigurationNeeded from "@/components/configuration-needed";
export const dynamic = "force-dynamic";
export const metadata = { title: "De collectie" };
export default async function Page() {
  if (!configured()) return <ConfigurationNeeded />;
  return (
    <Storefront
      products={await visibleProducts()}
      content={await home()}
      shopOnly
    />
  );
}
