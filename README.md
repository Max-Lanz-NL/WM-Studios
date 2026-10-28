# WM Studio Collective

Next.js App Router, React en strict TypeScript, met **Supabase PostgreSQL als enige applicatiedatabase**. De bestaande webshop en beheerwerkruimte zijn behouden. Persoonlijke Supabase Auth-accounts vervangen de gedeelde demo-login. Deze branch ondersteunt uitsluitend **local en staging**; echte betalingen, verzending en productie zijn niet ingeschakeld.

De werkende SQLite-versie blijft beschikbaar op commit `2f39425` op `main`. De migratie is geïsoleerd op `feat/supabase-staging-migration`.

## Installeren

Node.js 24.18+ en npm zijn vereist. Een volledige lokale Supabase-stack vereist daarnaast Docker Desktop met een werkende Linux-engine.

```sh
npm ci
npm run setup
npm run local:start
```

Voor lokaal gebruik verzorgt `npm run local:provision` de veilige configuratie na het toepassen van de migraties. `.env.example` beschrijft de instellingen. De huidige scope is uitsluitend lokaal; cloud-staging vereist een afzonderlijke opdracht. Plaats serverkeys nooit in `NEXT_PUBLIC_*`, broncode of GitHub.

De app maakt of reset geen database bij het starten. Pas eerst de versiebeheerbare migraties gecontroleerd toe; zie [de migratiehandleiding](docs/SUPABASE-MIGRATION.md). Een lege catalogus krijgt geen automatische demo-seed.

```sh
npm run dev
```

Webshop: http://127.0.0.1:3000. Dashboard: http://127.0.0.1:3000/admin. Ontbreekt de configuratie, dan toont de app een configuratiescherm. Er is geen verborgen SQLite-fallback.

## Gecontroleerde lokale omgeving

De lokale kernstack is op 28 oktober 2026 met echte Supabase-diensten gevalideerd. WM Studio gebruikt eigen poorten **55321–55324**, zodat een ander lokaal project op de standaardpoorten kan blijven draaien. De kernstack bevat PostgreSQL, Auth, Data API, gateway en lokale testmail; ongebruikte realtime/storage/edge-diensten worden niet gestart.

```sh
npm run local:start
npm run local:migrate
npm run local:provision
npm run db:import -- --apply
npm run local:verify-import
npm run dev
```

`local:provision` leest uitsluitend de CLI-status van dit project en controleert loopback én WM Studio-poorten. Het stelt twee afzonderlijke lokale testaccounts in: `max@wm-studio.test` en `willemijn@wm-studio.test`. De willekeurige wachtwoorden staan bij `LOCAL_MAX_PASSWORD` en `LOCAL_WILLEMIJN_PASSWORD` in `.env.local`. Ze worden niet afgedrukt. Een vorige configuratie wordt eerst naar de genegeerde `data`-map gekopieerd. Deze accounts en instellingen zijn uitsluitend voor lokaal testen; er wordt geen e-mail verstuurd.

`local:stop` stopt uitsluitend de WM Studio-stack met behoud van gegevens. Er is geen automatische reset of volume-verwijdering. Als een eerdere onderbroken start alleen PostgreSQL heeft achtergelaten, voer dan eerst `local:stop` en daarna `local:start` uit. Voor een verse checkout moet de SQLite-export aanwezig zijn voordat de importstap kan worden uitgevoerd; de repository bevat geen persoonsgegevens of databaseback-ups.

## Bestaande gegevens migreren

Stop de oude app en de oude worker. Maak dan een consistente back-up en export:

```sh
npm run db:export
npm run db:import
npm run db:verify-export
```

De standaardimport is een dry run. De verificatie vergelijkt de zes bestaande productvelden en varianten in een geïsoleerde PostgreSQL-testengine. Import in de echte **lege** lokale/stagingdatabase:

```sh
npm run db:import -- --apply
```

Product-ID's, SKU's, slugs, voorraad en historische orders blijven behouden. Het volledige originele exportdocument wordt privé gearchiveerd. De import is transactioneel, herhaalbaar met dezelfde checksum en weigert gewijzigde bronnen of een reeds gevulde doelcatalogus. De SQLite-bronbestanden worden niet verwijderd of gewijzigd.

## Medewerkers

Maak afzonderlijke Auth-accounts voor de oprichters in het **test-/stagingproject**. Openbare accountregistratie staat in de lokale configuratie uit. Een Auth-account krijgt pas toegang na een actieve rij in `staff_members`. Beide oprichters kunnen `owner` krijgen; daarnaast zijn `admin`, `designer`, `warehouse` en `support` beschikbaar.

Stel `STAFF_USER_ID` en `STAFF_ROLE` veilig lokaal in voor een bestaand Auth-account:

```sh
npm run staff:grant
npm run staff:grant -- --apply
```

Dit stuurt geen e-mail. Bevoegdheden komen uit de database en worden bij ieder verzoek gecontroleerd. Gebruikersmetadata verleent geen rechten. Lees [de architectuur](docs/ARCHITECTURE.md) voor de rechtenmatrix en sessiebeveiliging.

## Releases en voorraad

Supabase Cron voert elke minuut `private.run_maintenance()` uit. Die publiceert verstreken releases en geeft verlopen voorraadreserveringen vrij. De lokale pollingworker is verwijderd. Checkout controleert onafhankelijk van de scheduler de publicatiestatus, releasestatus en verkoopstart op basis van de databasetijd.

Checkout werkt nog als expliciete **testbestelling**. De databasefunctie ondersteunt daarnaast een `reserve_only`-pad met een vervaltijd van 15 minuten. Er is nog geen echte betaalprovider verbonden; browsergebruikers kunnen reserveringen niet zelf als betaald markeren. Zie [ARCHITECTURE.md](docs/ARCHITECTURE.md) voor de toekomstige providerflow.

## Testen

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
npm run test:postgres
npm run test:local
```

De standaard SQL-tests gebruiken PGlite. `test:e2e` blijft een snelle browserregressie met expliciete Auth/PostgREST-testdubbels. `test:postgres` gebruikt twee echte PostgreSQL-verbindingen; `test:local` gebruikt echte lokale Supabase Auth, sessies, RLS, checkout en Cron. De laatste twee opdrachten vereisen de geprovisioneerde lokale kernstack. Microsoft Edge wordt standaard gebruikt; `PLAYWRIGHT_CHANNEL` kan een andere geïnstalleerde browser aanwijzen.

Zie [TEST-REPORT.md](docs/TEST-REPORT.md) voor de resultaten en verificatiegrenzen. [ROADMAP.md](docs/ROADMAP.md) bevat de resterende livegangvereisten.

Voor twee echte PostgreSQL-backends: configureer uitsluitend voor een wegwerpbare testdatabase `WM_TEST_DATABASE_URL` en `WM_ALLOW_TEST_WRITES=yes` in de veilige lokale omgeving en voer `npm run test:postgres` uit. Lokale doelen moeten loopback zijn; externe doelen moeten de expliciet aangewezen stagingref volgen. De test gebruikt eigen unieke records en verwijdert die na afloop.
