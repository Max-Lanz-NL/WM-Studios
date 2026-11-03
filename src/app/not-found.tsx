import Link from "next/link";
export default function NotFound() {
  return (
    <main className="info-page">
      <p className="eyebrow">404 / OFF THE GRID</p>
      <h1>Out of sight for a moment.</h1>
      <p>This page does not exist or has not been published yet.</p>
      <Link href="/shop" className="button dark">
        Back to the collection ↗
      </Link>
    </main>
  );
}
