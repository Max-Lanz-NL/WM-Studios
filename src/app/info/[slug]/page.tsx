import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { notFound } from "next/navigation";
const pages: Record<string, { title: string; text: string }> = {
  shipping: {
    title: "Shipping & returns",
    text: "This test store only processes fictional orders. Shipping destinations, rates, delivery times and the returns policy must be configured and checked before launch. No physical items are shipped.",
  },
  contact: {
    title: "Contact",
    text: "Studio MW is being founded by Willemijn and Max. Business contact details, registration number, VAT number and business address have not been provided yet. These details will be added before launch.",
  },
  privacy: {
    title: "Privacy & cookies — draft",
    text: "This demo stores your bag and favourites locally in your browser. A strictly necessary cookie secures staff sessions. No marketing cookies are set. Product images may be loaded from Unsplash or public Supabase Storage, connecting your browser to the corresponding service. Test orders and waitlist entries are stored centrally in Studio MW's Supabase database. Vercel hosts this test version. Use fictional details. A final privacy notice with retention periods and contact details must be prepared before launch.",
  },
  terms: {
    title: "Terms & conditions — draft",
    text: "This is a draft, not a final legal document. The store is a test environment only and cannot accept real purchases. Terms, consumer rights, withdrawal information and business details must be finalised and legally reviewed before launch.",
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const page = pages[(await params).slug];
  return { title: page?.title || "Page not found" };
}
export default async function Info({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = pages[(await params).slug];
  if (!p) notFound();
  return (
    <main className="info-page">
      <Link className="wordmark" href="/">
        <BrandLogo />
      </Link>
      <p className="eyebrow">CLIENT SERVICES / CONCEPT</p>
      <h1>{p.title}</h1>
      <p>{p.text}</p>
      <Link className="button dark" href="/">
        Back to the studio ↗
      </Link>
    </main>
  );
}
