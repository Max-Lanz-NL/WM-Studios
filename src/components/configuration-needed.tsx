import BrandLogo from "@/components/brand-logo";
import Link from "next/link";
export default function ConfigurationNeeded() {
  return (
    <main className="info-page">
      <Link className="wordmark" href="/">
        <BrandLogo />
      </Link>
      <p className="eyebrow">STAGING / CONFIGURATION</p>
      <h1>Connecting the studio.</h1>
      <p>
        Configure the local or staging Supabase connection in .env.local. The
        website uses the central PostgreSQL database. The original SQLite files
        remain available for a controlled import.
      </p>
      <p>
        Follow docs/SUPABASE-MIGRATION.md. Never put keys in source code or
        GitHub.
      </p>
    </main>
  );
}
