# WM Studio Collective

Next.js-webshop met Supabase PostgreSQL, Supabase Auth, RLS en een server-side releasescheduler. Homepage, shop, productdetails, winkelmand, productbeheer, releases, wachtlijst en orderverwerking blijven behouden. Echte betalingen zijn uitgeschakeld.

## Starten

Vereist: Node 24 LTS, pnpm 11.25.0 en een afzonderlijk Supabase-testproject.

```sh
pnpm install --frozen-lockfile
pnpm setup
# Vul .env.local en pas de schema-migratie toe; zie de deploymenthandleiding.
pnpm dev
```

Open `http://127.0.0.1:3000`; beheer staat op `/admin`. De beheerder logt in met een Supabase Auth-account met server-side `app_metadata.role=admin`.

Zie [configuratie, veilige datamigratie, Auth, scheduler en rollback](docs/DEPLOYMENT.md). De applicatie seedt nooit automatisch. `pnpm seed` is uitsluitend voor een lege, expliciet bevestigde stagingomgeving. `pnpm export:sqlite <bron.sqlite> <privaat-doel.sql>` maakt een read-only export voor bestaande gegevens.

## Testen

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

De PostgreSQL-tests voeren de echte SQL-migratie uit in PGlite. Playwright start een geïsoleerde lokale PostgreSQL-testbackend met gesimuleerde Auth/PostgREST op poort 54329 en de app op poort 3001. Dit gebruikt uitsluitend fictieve gegevens en heeft geen externe database nodig. De testbackend is geen Supabase-vervanger voor deployments. Playwright gebruikt standaard Microsoft Edge; stel indien nodig `PLAYWRIGHT_CHANNEL=chromium` in en installeer die Playwright-browser.

Zie [testresultaten en grenzen](docs/TEST-REPORT.md). Hosted Supabase Auth, Vercel runtime, cronjobs en daadwerkelijke databaseverbinding moeten ook op de goedgekeurde Preview worden gevalideerd.

## Grenzen

Geen echte betalingen, labels, refunds, e-mails, printerkoppelingen of klantaccounts. Testorders vereisen staging én een applicatie- én database-instelling. `paid_demo` is uitsluitend een teststatus en bewijst geen betaling. Gebruik alleen fictieve klantgegevens totdat de infrastructuur is gevalideerd.

Productinformatie, Unsplash-beelden, merkconcept en juridische teksten zijn concepten. Controleer en vervang deze vóór een openbare lancering. Google Fonts en Unsplash worden extern geladen. Volgende integratiefasen staan in [de roadmap](docs/ROADMAP.md).
