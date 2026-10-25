import { visibleProducts, home } from "@/lib/db";
import Storefront from "@/components/storefront";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ps = visibleProducts();
  const p = ps.find((p) => p.slug === slug);
  if (!p) notFound();
  return <Storefront products={ps} content={home()} selectedId={p.id} />;
}
