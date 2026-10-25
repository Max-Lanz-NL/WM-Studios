# Migratiecontroles — 25 oktober 2026

## Uitgevoerd

- 36 Vitest-controles geslaagd: daadwerkelijke PostgreSQL-migraties in PGlite, reserveringen, expiratie, snapshots, idempotentie, import/rollback, read-only export/back-up, RLS, rollen, versieconflicten, configbeveiliging en serverauth met testdubbels.
- 6 Playwright/Edge-browserregressies geslaagd tegen de nieuwe applicatie en een expliciete PostgreSQL/RLS-fixture: checkout/orderverwerking, productaanmaak, beheerafscherming, herkomstcontrole, twee overlappende HTTP-bestellingen, mobiel menu/Escape en desktopweergave.
- Strict TypeScript en de Next.js-build geslaagd.
- Echte lokale SQLite-export read-only uitgevoerd: 6 producten, 2 instellingen, 0 orders, 0 wachtlijsten. Consistente backup en checksum opgeslagen onder de genegeerde `data`-map.
- Die export in een geïsoleerde PostgreSQL-testengine geïmporteerd: 6 producten en 8 oorspronkelijke archiefrecords. Productvelden en variantvoorraden vergeleken zonder verlies. Geen bronwijzigingen.

## Grenzen van het bewijs

PGlite is een echte PostgreSQL-engine, maar gebruikt één backend. Overlappende HTTP-verzoeken in de browserfixture worden daarom geserialiseerd. Dit controleert de applicatieflow en transactieresultaten, maar bewijst geen lockinggedrag tussen meerdere PostgreSQL-backends. De rollen en RLS worden als daadwerkelijke PostgreSQL-rollen uitgevoerd; de Supabase Auth-schemafuncties zijn minimale fixtures.

De browserfixture emuleert Auth en PostgREST. Zij is uitsluitend testcode, geen runtimefallback. De tests bewijzen geen echte Supabase JWT-validatie, refresh-tokenrotatie, netwerk-/providerfouten of MFA. De lokale Docker/Supabase-stack kwam niet beschikbaar; er was geen WM Studio-stagingproject aangewezen. Er zijn geen remote migraties toegepast en geen live Supabase-advisors gedraaid.

De onderhoudsfunctie is getest; de pg_cron-extensie-installatie en echte scheduler zijn nog niet uitgevoerd. De testhulp slaat uitsluitend het gemarkeerde installatiegedeelte over. Dit moet in staging alsnog worden getest. Tijdens snelle navigatie meldde de devserver verbroken responsstreams; alle zes browserasserties slaagden. Dit is geen productie-loadtest.

Twee aanvullende tests voor echte afzonderlijke PostgreSQL-verbindingen staan in `tests/postgres.integration.ts`. Ze vallen buiten de standaardtest en zijn niet uitgevoerd omdat een expliciet aangewezen testdatabase ontbreekt. `npm run test:postgres` vereist een veilige test-URL en expliciete toestemming via configuratie; de tests ruimen alleen hun eigen unieke testrecords op.

De oude SQLite-tests zijn inhoudelijk vervangen en uitgebreid met PostgreSQL-regressies. De oorspronkelijke tests en broncode zijn via het Git-herstelpunt beschikbaar. Zie `SUPABASE-MIGRATION.md` voor aanvullende stagingacceptatie en herstel.
