import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
export default function ConfigurationNeeded() {
  return (
    <main className="info-page">
      <Link className="wordmark" href="/">
        <BrandLogo />
      </Link>
      <p className="eyebrow">STAGING / CONFIGURATIE</p>
      <h1>De studio wordt verbonden.</h1>
      <p>
        Configureer de lokale Supabase- of stagingverbinding via .env.local. De
        website gebruikt uitsluitend de centrale PostgreSQL-database. De
        oorspronkelijke SQLite-bestanden blijven beschikbaar voor een
        gecontroleerde import.
      </p>
      <p>
        Volg docs/SUPABASE-MIGRATION.md. Zet geen sleutels in broncode of
        GitHub.
      </p>
    </main>
  );
}
