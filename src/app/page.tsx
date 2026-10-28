import { visibleProducts, home } from "@/lib/db";
import Storefront from "@/components/storefront";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <Storefront products={await visibleProducts()} content={await home()} />
  );
}
