import Link from "next/link";
export default function NotFound() {
  return (
    <main className="info-page">
      <p className="eyebrow">404 / OFF THE GRID</p>
      <h1>Even uit beeld.</h1>
      <p>Deze pagina bestaat niet of is nog niet gepubliceerd.</p>
      <Link href="/" className="button dark">
        Terug naar de collectie ↗
      </Link>
    </main>
  );
}
