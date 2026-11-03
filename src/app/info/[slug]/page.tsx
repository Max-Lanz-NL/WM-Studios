import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { configured } from "@/lib/config";
import { home } from "@/lib/db";
import { servicesSchema } from "@/lib/shop-content";

export const dynamic = "force-dynamic";
const titles: Record<string, string> = {
  shipping: "Shipping & returns",
  contact: "Contact",
  faq: "Frequently asked questions",
  privacy: "Privacy & cookies — draft",
  terms: "Terms & conditions — draft",
};
const faqs = [
  [
    "Can I place a real order?",
    "Not yet. Studio MW is a test store. Demo checkout takes no payment and no physical goods are sent. Use fictional details when testing.",
  ],
  [
    "How do I choose my size?",
    "Open the product page, choose your colour and select an available size. A size guide appears when measurements have been added for that item. Please do not rely on the demo photographs or descriptions as a real product specification.",
  ],
  [
    "What are the demo shipping charges?",
    "Demo checkout uses €4.95 shipping below €150 and free shipping from €150. These are test calculations; final delivery destinations, rates and times are still being prepared.",
  ],
  [
    "Will I receive a confirmation email?",
    "Your demo order number appears on screen and the order is saved in the studio dashboard. Order and waitlist emails are not connected yet.",
  ],
  [
    "Can I return an item?",
    "No items are delivered in this test store. The actual returns address, procedure and costs will be published before real sales.",
  ],
  [
    "Where is my bag saved?",
    "Your bag and favourites are saved in this browser when browser storage is available. Clearing browser data removes them. A temporary checkout reference helps recover a demo confirmation after a lost connection.",
  ],
];
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return { title: titles[(await params).slug] || "Page not found" };
}
export default async function Info({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!titles[slug]) notFound();
  const parsed = servicesSchema.safeParse(
    configured() ? (await home()).services || {} : {},
  );
  const services = parsed.success ? parsed.data : {};
  const section = (title: string, text: string) => (
    <section className="service-section">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="service-header">
        <Link className="wordmark" href="/" aria-label="Studio MW home">
          <BrandLogo />
        </Link>
        <Link className="text-link" href="/shop">
          Explore the collection ↗
        </Link>
      </header>
      <main id="main" className="service-page">
        <aside className="service-navigation" aria-label="Customer service">
          <p className="eyebrow">CLIENT SERVICES</p>
          <nav>
            {Object.entries(titles).map(([key, label]) => (
              <Link
                key={key}
                href={"/info/" + key}
                aria-current={key === slug ? "page" : undefined}
              >
                {label.replace(" — draft", "")}
              </Link>
            ))}
          </nav>
        </aside>
        <article className="service-content">
          <p className="eyebrow">HERE TO HELP</p>
          <h1>{titles[slug]}</h1>
          <p className="service-test-note">
            Studio MW is currently a test store. No real payments or deliveries.
          </p>
          {slug === "contact" && (
            <>
              <p>
                Studio MW is being founded by Willemijn and Max. We are
                preparing our first collection and customer service.
              </p>
              {services.businessName &&
                section("Business", services.businessName)}
              {services.contactEmail ? (
                <section className="service-section">
                  <h2>Get in touch</h2>
                  <a
                    className="text-link"
                    href={"mailto:" + services.contactEmail}
                  >
                    {services.contactEmail} ↗
                  </a>
                </section>
              ) : (
                section(
                  "Customer service",
                  "Our business contact details are being prepared. Please check back before placing a real order. Do not send payment or personal documents through this test store.",
                )
              )}
              {services.businessAddress &&
                section("Business contact address", services.businessAddress)}
              {services.registration &&
                section("Registration details", services.registration)}
              <Link className="text-link" href="/info/faq">
                Browse common questions ↗
              </Link>
            </>
          )}
          {slug === "shipping" && (
            <>
              {section(
                "Delivery",
                services.delivery ||
                  "No physical items are shipped during testing. Final delivery countries, shipping rates and delivery times will be published before launch.",
              )}
              {section(
                "Demo checkout rates",
                "€4.95 below €150. Free shipping from €150. These amounts are calculated again by the server when you place a demo order.",
              )}
              {section(
                "Returns",
                services.returns ||
                  "Our returns address, procedure, costs and processing information are being prepared. The final policy will be available before real sales.",
              )}
              <Link className="text-link" href="/info/contact">
                Contact the studio ↗
              </Link>
            </>
          )}
          {slug === "faq" && (
            <div className="service-faq">
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          )}
          {slug === "privacy" && (
            <>
              {section(
                "Draft notice",
                services.privacy ||
                  "This draft explains the current test setup. The final privacy notice, retention periods and contact point must be reviewed before real sales.",
              )}
              {section(
                "Browser storage",
                "Your bag and favourites are stored locally when browser storage is available. A temporary checkout key and a fingerprint help recover a confirmation after a connection failure. The fingerprint does not contain your readable contact details. A necessary cookie secures staff sessions. No marketing cookies are set by this application.",
              )}
              {section(
                "Test orders and images",
                "Test orders and waitlist entries are stored centrally in Studio MW’s Supabase database. Vercel hosts this test version. Product images may connect your browser to Unsplash or public Supabase Storage. Use fictional details in test forms.",
              )}
            </>
          )}
          {slug === "terms" && (
            <>
              {section(
                "Draft terms",
                services.terms ||
                  "This test environment cannot accept real purchases. No payment is taken and no goods are delivered. Business details and the final conditions of sale must be completed and reviewed before launch.",
              )}
              {section(
                "Demo catalogue",
                "Photographs, descriptions, prices and availability are for testing. They do not represent a finished collection available for purchase.",
              )}
            </>
          )}
          <div className="service-bottom">
            <Link href="/shop" className="button dark">
              Back to the collection ↗
            </Link>
          </div>
        </article>
      </main>
      <footer className="service-footer">
        <span>STUDIO MW · INDEPENDENT BY DESIGN</span>
        <Link href="/info/contact">Contact</Link>
        <Link href="/info/privacy">Privacy & cookies</Link>
      </footer>
    </>
  );
}
