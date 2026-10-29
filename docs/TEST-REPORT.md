# Migratiecontroles — 28 oktober 2026

## Echte lokale Supabase-acceptatie

- De kernstack draait geïsoleerd op WM Studio-poorten 55321–55324 met PostgreSQL, Auth, Data API, gateway en lokale testmail. Een ander lokaal project is niet aangepast.
- Alle vier migraties zijn lokaal toegepast; de migratiegeschiedenis komt overeen met de repository.
- De zes oorspronkelijke producten en het volledige bronarchief zijn via de echte Data API/PostgreSQL met de SQLite-export vergeleken, inclusief ID's, varianten, voorraad en tijdstippen. Geen afwijkingen.
- Twee afzonderlijke lokale eigenaaraccounts zijn ingesteld. Willekeurige wachtwoorden blijven uitsluitend in `.env.local`; de vorige configuratie is als lokale back-up behouden.
- 39 unit-/SQL-/auth-/export-/configuratiecontroles geslaagd.
- 2 tests met afzonderlijke echte PostgreSQL-verbindingen geslaagd: laatste exemplaar eenmaal verkopen en voorraad na een mislukte reservering vrijgeven.
- 6 echte Auth-/browseracceptatietests geslaagd: onafhankelijke logins, HTTP-only/SameSite-cookies, uitloggen, refresh-tokenrotatie en intrekking, serververversing van een verouderde sessiecookie, RLS ondanks vervalste gebruikersmetadata, deactiveren van een medewerker, checkout en orderverwerking, Cron-publicatie en reserveringsexpiratie.
- De database-Cron is daadwerkelijk waargenomen: publicatie zonder browser en vrijgave van een verlopen reservering; de jobhistorie toont een geslaagde run.
- Echte Supabase advisors (`--local --type all --fail-on warn`) melden geen problemen.
- Strict TypeScript en de Next.js-build slagen. De ontwikkelserver kan bij snelle navigatie een verbroken responsstream melden; dit wordt niet als geslaagde productie-loadtest gepresenteerd.

De lokale browserconfiguratie is `playwright.local.config.ts`; er worden geen Auth-/PostgREST-testdubbels gebruikt. Bij de SSR-refreshcontrole wordt de lokale sessievervaltijd bewust in het verleden gezet; de echte Auth-service roteert vervolgens het refresh-token via de serverproxy. Dit is geen claim dat een volledige JWT-levensduur van een uur is afgewacht.

## Overblijvende grenzen

Dit bewijst lokale functionaliteit, geen cloud- of productieacceptatie. Cloudhosting, MFA-challenge, ramp-/hersteltests, langdurige belasting, providerbetalingen en verzenddiensten zijn niet getest. Alleen de eerste native concurrency-scenario's zijn afgedekt; uitgebreide gelijktijdige catalogusmutaties en chaostests blijven open.

## Eerdere controles op 25 oktober

## Uitgevoerd

- 36 Vitest-controles geslaagd: daadwerkelijke PostgreSQL-migraties in PGlite, reserveringen, expiratie, snapshots, idempotentie, import/rollback, read-only export/back-up, RLS, rollen, versieconflicten, configbeveiliging en serverauth met testdubbels.
- 6 Playwright/Edge-browserregressies geslaagd tegen de nieuwe applicatie en een expliciete PostgreSQL/RLS-fixture: checkout/orderverwerking, productaanmaak, beheerafscherming, herkomstcontrole, twee overlappende HTTP-bestellingen, mobiel menu/Escape en desktopweergave.
- Strict TypeScript en de Next.js-build geslaagd.
- Echte lokale SQLite-export read-only uitgevoerd: 6 producten, 2 instellingen, 0 orders, 0 wachtlijsten. Consistente backup en checksum opgeslagen onder de genegeerde `data`-map.
- Die export in een geïsoleerde PostgreSQL-testengine geïmporteerd: 6 producten en 8 oorspronkelijke archiefrecords. Productvelden en variantvoorraden vergeleken zonder verlies. Geen bronwijzigingen.

## Grenzen van het bewijs

PGlite is een echte PostgreSQL-engine, maar gebruikt één backend. Overlappende HTTP-verzoeken in de browserfixture worden daarom geserialiseerd. Dit controleert de applicatieflow en transactieresultaten, maar bewijst geen lockinggedrag tussen meerdere PostgreSQL-backends. De rollen en RLS worden als daadwerkelijke PostgreSQL-rollen uitgevoerd; de Supabase Auth-schemafuncties zijn minimale fixtures.

De snelle browserfixture emuleert Auth en PostgREST. Zij blijft uitsluitend testcode, geen runtimefallback. Op 25 oktober was Docker nog niet beschikbaar. Die verificatiegrens is voor de hierboven beschreven lokale scenario's inmiddels opgeheven; cloud- en productieprojecten zijn niet gewijzigd.

De PGlite-testhulp slaat het gemarkeerde pg_cron-installatiegedeelte over. De echte extensie en scheduler zijn nu aanvullend op de lokale stack getest, zoals hierboven beschreven. De oorspronkelijke zes browserregressies met fixtures blijven een snelle aanvulling.

De twee tests in `tests/postgres.integration.ts` zijn inmiddels uitgevoerd op de expliciet aangewezen lokale WM Studio-database. Ze ruimen alleen hun eigen unieke testrecords op. De browseracceptatie archiveert haar eigen testproducten en bewaart fictieve demo-orders voor controle.

De oude SQLite-tests zijn inhoudelijk vervangen en uitgebreid met PostgreSQL-regressies. De oorspronkelijke tests en broncode zijn via het Git-herstelpunt beschikbaar. Zie `SUPABASE-MIGRATION.md` voor aanvullende stagingacceptatie en herstel.
