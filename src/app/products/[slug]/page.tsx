import { visibleProducts, home } from "@/lib/db";
import Storefront from "@/components/storefront";
import { notFound } from "next/navigation";
import { cache } from "react";
import { brandText } from "@/components/brand-logo";
const catalog = cache(visibleProducts);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await catalog()).find((p) => p.slug === slug);
  if (!product) return { title: "Piece not found" };
  return {
    title: product.name,
    description: brandText(product.description).slice(0, 160),
  };
}
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ps = await catalog();
  const p = ps.find((p) => p.slug === slug);
  if (!p) notFound();
  return (
    <Storefront
      key={p.id}
      products={ps}
      content={await home()}
      selectedId={p.id}
    />
  );
}
