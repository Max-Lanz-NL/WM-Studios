"use client";
import Link from "next/link";
import BrandLogo from "@/components/brand-logo";

export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="info-page">
      <Link href="/" aria-label="Studio MW home">
        <BrandLogo />
      </Link>
      <p className="eyebrow">A MOMENT, PLEASE</p>
      <h1>The studio needs a moment.</h1>
      <p>
        We could not load this page. Please try again. Your shopping bag stays
        in this browser.
      </p>
      <button className="button dark" onClick={retry}>
        Try again ↗
      </button>
      <Link className="text-link" href="/shop">
        Back to the collection
      </Link>
    </main>
  );
}
