import { visibleProducts, home } from "@/lib/db";
import Storefront from "@/components/storefront";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Storefront products={visibleProducts()} content={home()} shopOnly />;
}
