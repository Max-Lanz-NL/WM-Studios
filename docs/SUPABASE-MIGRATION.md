# Veilige migratie naar Supabase

## 1. Herstelpunt en broninventaris

Baseline: `2f39425` op `main`. Alle wijzigingen staan op `feat/supabase-staging-migration`. De oude SQLite-tabellen waren `products`, `orders`, `waitlist`, `settings`, `audit` en `attempts`; producten en orders waren JSON-documenten. De bestaande lokale bron bevat zes producten, twee instellingen en geen orders of wachtlijstregistraties.

De oorspronkelijke checkout bepaalde prijzen server-side en gebruikte een SQLite-schrijftransactie. De oorspronkelijke auth was een gedeeld wachtwoord met een zelf ondertekende cookie. De nieuwe code gebruikt PostgreSQL-transacties, genormaliseerde relaties en Supabase Auth. Oude cookies of wachtwoorden worden niet overgenomen.

## 2. Kies uitsluitend een leeg test-/stagingproject

Er zijn geen Supabase-cloudprojecten gewijzigd of aangemaakt en geen migraties op afstand uitgevoerd. De aanwezige Schoolpulse-projecten zijn niet gebruikt. Alleen de afzonderlijke lokale WM Studio-omgeving is ingericht.

Update 28 oktober: de WM Studio-kernstack is nu lokaal ingericht en geverifieerd. De huidige opdracht blijft uitsluitend lokaal. WM Studio gebruikt poorten 55321–55324. De andere lokale stack gebruikt de standaardpoorten en is niet gewijzigd. Gebruik `npm run local:start`, `local:migrate` en `local:provision` voor de afzonderlijke WM Studio-omgeving; `local:stop` behoudt de data en stopt alleen dit project.

Voor lokaal gebruik: start Docker en `npx supabase start`. Voor cloud-staging: kies een nieuw, leeg WM Studio-stagingproject. Plaats URL, publishable key en secret key uitsluitend in `.env.local` of de geheime staging-hostinginstellingen. Zet de exacte projectref in `SUPABASE_STAGING_PROJECT_REF`. De applicatie weigert `APP_ENV=production`.

De serverkey is voor de gastcheckout, centrale rate limiting en eenmalige beheerhulpmiddelen. Publieke cataloguslezingen gebruiken de publishable key zonder medewerkerssessie. Beheeracties gebruiken het JWT van de medewerker en blijven onder RLS.

Gebruik een nieuwe serverkey voor deze omgeving en controleer vóór livegang keyrotatie, korte JWT-levensduur en het MFA-beleid. Dit zijn configuratie- en acceptatiestappen; de huidige login-UI biedt nog geen MFA-challenge.

## 3. Migraties en controles

De vier bestanden in `supabase/migrations` zijn door de Supabase-CLI aangemaakt:

1. `normalized_commerce`: tabellen, constraints, indexen, RLS en veilige views.
2. `commerce_transactions`: productmutaties, checkout, reserveringen en rechtencontrole.
3. `scheduled_maintenance`: inhaaltaken en één pg_cron-job per minuut.
4. `legacy_import`: transactionele, service-only import.

Gebruik `npx supabase db push --help` en de versiegebonden CLI-documentatie voordat je een doel selecteert. Koppel nooit blind een bestaand project en gebruik geen productiewachtwoord. Controleer projectnaam en projectref vóór een staging-apply. Voor lokale iteratie kan `supabase db query --local` worden gebruikt; een reset is alleen toegestaan op een expliciet wegwerpbare, lege lokale database. Deze repository voert geen automatische reset uit.

Na toepassen op de echte Supabase-stack:

```sh
npx supabase migration list --local
npx supabase db advisors --local --type all --fail-on warn
```

Gebruik voor cloud-staging de expliciete projectselectie die `--help` toont. Controleer op RLS, functieprivileges en view-instellingen. Verifieer dat `private` **niet** in de blootgestelde Data API-schema's staat. De migraties trekken standaard clientrechten in en verlenen alleen benodigde SELECT- en EXECUTE-rechten; directe voorraad-, order- en rolwrites zijn niet toegestaan.

Controleer in de database:

```sql
select * from cron.job where jobname='wm-commerce-maintenance';
select status,return_message,start_time,end_time
from cron.job_run_details order by start_time desc limit 10;
```

`npm run db:status` toont achterstallige releases, verlopen orders en aanwezigheid van pg_cron. De aanwezigheid van de extensie alleen bewijst niet dat de job succesvol draait: controleer ook het jobrecord en de runhistorie. Richt vóór livegang monitoring in op mislukte of uitblijvende runs.

## 4. Bevries en exporteer SQLite

Stop de oude app en worker om wijzigingen na het exportmoment te voorkomen. `npm run db:export` opent de bron read-only en maakt via SQLite's backup-API een consistente back-up inclusief WAL-inhoud. De JSON-export wordt uit diezelfde back-up gelezen. Beide staan standaard onder de genegeerde `data`-map. Bestaande exportnamen worden niet overschreven.

```sh
npm run db:export -- data/wm-demo.sqlite data/legacy-export.json wm-local-demo-v1
npm run db:import -- data/legacy-export.json
npm run db:verify-export -- data/legacy-export.json
```

Een SHA-256-checksum beschermt tegen onbedoeld wijzigen van het exportdocument. Het importscript valideert producten vóór verzending. De database bewaart het volledige originele document en alle originele records in private archieftabellen, inclusief velden zonder nieuwe genormaliseerde tegenhanger.

## 5. Apply en verificatie

Voer uitsluitend op een lege lokale/stagingcatalogus `npm run db:import -- data/legacy-export.json --apply` uit. De hele import is één RPC-transactie. Een ongeldige SKU, verwijzing, prijs of variant rolt alles terug. Bij dezelfde bron/checksum volgt een veilige no-op; een gewijzigde bron of gevulde doelcatalogus wordt geweigerd. Historische orders blijven snapshots; hun voorraad wordt niet nogmaals afgeboekt.

Vergelijk product-, variant-, order- en archiefaantallen. Vergelijk per product ID, slug, kledinglijn, categorie, beschrijving, prijs, status, releasedatum, afbeelding, aanmaakdatum en elke SKU/maat/kleur/voorraad. Tijdstippen worden als `timestamptz` opgeslagen, dus een andere tekstnotatie kan hetzelfde tijdstip betekenen. Open meerdere productpagina's en controleer dat concepten publiek onzichtbaar blijven. Controleer een historische order indien aanwezig.

Bewaar back-up en export beveiligd buiten Git. De bron bevat mogelijk persoonsgegevens. Verwijder oude gegevens pas na een afzonderlijke bewaarbeleidbeslissing; deze migratie verwijdert niets.

## 6. Persoonlijke accounts en stagingacceptatie

Maak Auth-accounts via het gekozen project en ken beide oprichters afzonderlijk owner-rechten toe. Gebruik `STAFF_USER_ID`, `STAFF_ROLE` en `npm run staff:grant -- --apply` voor de eenmalige toekenning. Verwijder die tijdelijke instellingen daarna. Servicekeys horen nooit in de browser.

Controleer met echte stagingaccounts: twee onafhankelijke logins, uitloggen, sessieverversing, gedeactiveerde medewerker, verkeerde rol, toegang via directe Data API, conceptafscherming, productwijziging na gelijktijdige verkoop, demo-checkout, orderverwerking en geplande publicatie zonder browser. Test met twee afzonderlijke PostgreSQL-verbindingen de laatste voorraad en een rollback. De lokale fixtures vervangen deze acceptatie niet.

Deze basisscenario's zijn op 28 oktober aanvullend met echte lokale Auth/Data API en PostgreSQL getest. Voer ze opnieuw uit met `npm run test:local` en `npm run test:postgres`. `npm run local:verify-import` vergelijkt de oorspronkelijke producten en het private bronarchief rechtstreeks met de echte lokale database.

De lokale testaccounts zijn `max@wm-studio.test` en `willemijn@wm-studio.test`. Hun wachtwoorden staan in de genegeerde `.env.local`. Ze zijn geen cloudaccounts en er zijn geen uitnodigingen of echte e-mails verstuurd.

## 7. Terugrollen

De migratie wijzigt de bron niet. Stop de nieuwe app, schakel terug naar `2f39425` en herstel de bijbehorende oude lokale configuratie om de vorige demo te openen. De nieuwe branch gebruikt die oude configuratie niet. Voor een afgekeurde stagingimport: bewaar eerst export en logs; verwijder of reset uitsluitend het afzonderlijke wegwerpproject na controle van de doelidentiteit. Er is geen destructieve automatische down-migratie.

Ontstaan er na de overstap nieuwe stagingorders, exporteer die vóór herstel. De oude SQLite-back-up bevat die nieuwe orders niet. Een onvoorwaardelijke terugrol naar de oude database zou die wijzigingen verliezen.

## Officiële referenties

De implementatie is gecontroleerd tegen [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [sessiebeveiliging](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) en [Cron](https://supabase.com/docs/guides/cron). De changelog van oktober 2026 is bekeken; de aangekondigde wijziging van TLS-ciphers vereist hier geen downgrade of onveilige TLS-instellingen.
