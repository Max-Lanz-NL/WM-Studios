# Supabase / Vercel reparatie

## Oorzaak en herstelpunt

`src/lib/db.ts` op commit `2f394252f0084bc78857d633b83085b3affe483e` vereiste `APP_MODE=demo` en opende SQLite op de lokale schijf. Vercel-instances delen die database niet. De foutmelding veroorzaakte de gemelde digest `1596871426`; een digest is geen stabiele foutcode.

Werkbranch: `fix/supabase-vercel`. Herstelbranch: `backup/pre-supabase-20261026`. De migratie verwijdert of wijzigt geen bestaande tabellen: alle objecten krijgen prefix `wm_`. Naamconflicten stoppen de migratie. Geen externe migratie, projectreset, betaling of productiedeployment wordt automatisch uitgevoerd.

## Apart Supabase-testproject voorbereiden

1. Gebruik een goedgekeurd, afzonderlijk WM-Studios-testproject; de bestaande Schoolpulse-projecten horen hier niet bij. Maak eerst een schema/data-backup en controleer tabellen, extensies en security advisories.
2. Installeer Node 24 LTS en `pnpm` 11.25.0. Voer `pnpm install --frozen-lockfile` uit. Alleen de esbuild-buildscript is expliciet toegestaan.
3. Link de Supabase CLI aan het goedgekeurde project met `pnpm exec supabase link --project-ref <ref>`. Controleer eerst `--help` voor de geïnstalleerde versie.
4. Bekijk pending migrations (`pnpm exec supabase migration list`) en de dry run (`pnpm exec supabase db push --dry-run`). Pas daarna de migratie toe met `pnpm exec supabase db push`. Gebruik nooit `db reset` op een extern project.
5. Verifieer alle zeven `wm_`-tabellen en voer security advisories uit. De migratie bevat RLS en expliciete grants; schrijf-RPC's zijn uitsluitend uitvoerbaar door `service_role`, met `SECURITY INVOKER` en vaste lege `search_path`.
6. Controleer Data API: schema `public` moet worden aangeboden. Anonieme clients mogen uitsluitend zichtbare catalogusproducten en de homepage lezen. Drafts, orders, audit, rate limits en wachtlijstgegevens mogen niet publiek uitlekken. Gewone ingelogde gebruikers krijgen geen beheerrechten.

## Omgevingsvariabelen

Alle instellingen zijn uitsluitend server-side, ook de publishable key. Plaats ze in `.env.local` en apart in Vercel Preview en Production. Gebruik nooit `NEXT_PUBLIC_` voor een secret.

| Variabele | Waarde / doel |
| --- | --- |
| `SUPABASE_URL` | HTTPS-project-URL, zonder credentials |
| `APP_ORIGIN` | Exacte website-origin, bijvoorbeeld `https://wm-studios.vercel.app`, zonder afsluitende slash; stel de juiste Preview-origin apart in |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable API-key van hetzelfde project |
| `SUPABASE_SECRET_KEY` | Server secret API-key; legacy service_role-key wordt technisch ook ondersteund |
| `CRON_SECRET` | Willekeurige waarde van minimaal 32 tekens |
| `DEPLOYMENT_ENV` | `production`; uitsluitend in een apart testproject `staging` |
| `ENABLE_TEST_CHECKOUT` | Standaard `false` |
| `SEED_CONFIRM_PROJECT_URL` | Alleen bij seed: exact dezelfde URL als het goedgekeurde testproject |

`APP_MODE`, `DATABASE_PATH`, `ADMIN_PASSWORD` en `SESSION_SECRET` zijn vervallen. Ontbrekende configuratie noemt alleen de variabelenaam. Databasefouten tonen geen SQL, credentials of klantdata. Runtime-configuratie is niet vereist tijdens `next build`, maar wel bij requests.

## Supabase Auth en beheerders

Maak de beheerder via Supabase Dashboard / vertrouwde Admin API, bevestig diens e-mail en zet server-side `app_metadata.role` op `admin`. Gebruik **geen** `user_metadata` voor autorisatie. Schakel publieke registratie uit als die niet nodig is. Stel password policy, Auth-rate limits en e-mailvoorziening in. Er is geen publieke signup- of rolwijzigingsroute.

Het dashboard vraagt e-mail en wachtwoord en gebruikt `signInWithPassword`. Het access token staat uitsluitend in een HttpOnly, SameSite=Strict cookie, met Secure en `__Host-` prefix in productie. Elke beheeraanvraag valideert opnieuw via `getUser`, inclusief actuele `app_metadata`. Beheercookies en antwoorden worden niet gedeeld/gecached. De sessie duurt maximaal één uur; daarna opnieuw inloggen. Refresh tokens worden niet opgeslagen. Uitloggen verwijdert de cookie. Zoals gebruikelijk blijven reeds gekopieerde JWTs tot hun vervaldatum geldig: gebruik een korte JWT-levensduur en trek bij een incident ook Auth-sessies in. RLS-claims veranderen pas na tokenverversing; de beheer-API controleert de actuele rol bij iedere mutatie.

## Producten en bestaande data behouden

Nieuwe tabellen bewaren het bestaande JSON-product/orderformaat zodat varianten, voorraad, releasedata en ordersnapshots behouden blijven. Een aparte SKU-index dwingt catalogusbrede uniciteit af. Checkout, productwijzigingen en releases worden met een transactionele commerce-lock geserialiseerd. Dit voorkomt overselling, gedeeltelijke orders en gelijktijdige voorraadoverschrijvingen door de backend. De lock beperkt de maximale schrijfdoorvoer; beoordeel dit opnieuw bij een grote catalogus.

SQLite wordt nooit tijdens een Vercel-request geopend. Voor een bestaande SQLite-database:

1. Stop schrijvers en maak een consistente backup van de database inclusief eventuele WAL. Bewaar de oorspronkelijke bestanden buiten de repository.
2. Maak een offline export met `pnpm export:sqlite <bron.sqlite> <beveiligde-map>/catalog.import.sql`. De exporter opent de bron read-only, valideert producten, bewaart IDs en schrijft alleen een nieuw doelbestand.
3. De export bevat mogelijk persoonsgegevens. Commit of upload deze niet naar GitHub. Test de import eerst op een leeg testproject na de schema-migratie. Het script gebruikt één transactie, faalt op conflicten en overschrijft geen bestaande catalogus/orders/wachtlijst.
4. Vergelijk aantallen, IDs, slugs, SKU's, voorraad, releasedata en ordertotalen met de backup vóór omschakeling. De oorspronkelijke database is niet meegeleverd in de repository; daadwerkelijke data-import is daarom een aparte beheerhandeling.
5. Geïmporteerde order-idempotentiesleutels blijven gereserveerd. Herhalen van een oude aanvraag wordt geweigerd omdat de oorspronkelijke requestfingerprint niet beschikbaar is.

Voor fictieve data op een **leeg** testproject: zet `DEPLOYMENT_ENV=staging`, bevestig de project-URL en voer `pnpm seed` uit. Seed gebeurt in één transactie en stopt als de catalogus niet leeg is. Seed wordt nooit automatisch gestart.

## Bestellen en betalingen

Er is geen Mollie-integratie en geen live-betaalpad. Productiecheckout wordt expliciet geweigerd. Testcheckout vereist drie controles: `DEPLOYMENT_ENV=staging`, `ENABLE_TEST_CHECKOUT=true`, en in de afzonderlijke testdatabase:

```sql
update public.wm_settings set body='true'::jsonb where id='test_checkout';
```

Zet de databasecontrole na testen weer op `false`. Doe dit nooit in productie. Testorders behouden status `paid_demo`; die status betekent **geen echte betaling**. Prijzen en voorraad komen uitsluitend uit de database. Een idempotentiesleutel mag alleen voor exact dezelfde aanvraag worden hergebruikt.

## Releasescheduler

Schakel [Supabase Cron](https://supabase.com/docs/guides/cron/install) in op het goedgekeurde project. Inspecteer bestaande jobs en voer daarna `supabase/scheduler.sql` uit als `postgres`. De job `wm-studios-publish-releases` roept iedere minuut `wm_publish_due()` aan zonder HTTP/secrets. Een gelijknamige bestaande job wordt niet overschreven. Controleer `cron.job` en `cron.job_run_details`; stel monitoring/alerts in op mislukte jobs. Na uitval verwerkt de volgende succesvolle run alle verschuldigde releases. Geen externe notificaties worden verstuurd.

`vercel.json` bevat daarnaast een dagelijkse beveiligde HTTP-cron als vangnet. Dit past op Hobby; [Vercel beperkt Hobby tot dagelijks](https://vercel.com/docs/cron-jobs/usage-and-pricing). Pro/Enterprise kunnen de HTTP-cron desgewenst naar `* * * * *` wijzigen als alternatief voor Supabase Cron. [Vercel stuurt CRON_SECRET als Bearer-header](https://vercel.com/docs/cron-jobs/manage-cron-jobs). Dubbele runs zijn veilig. Previews moeten handmatig of via een expliciet ingerichte testjob worden gecontroleerd.

De shop controleert releasedata ook bij lezen/aankopen, zodat geen vroege verkoop ontstaat als de scheduler later draait. Publicatiestatus en audit worden door de scheduler bijgewerkt. Gebruik UTC-releasedata; de interface toont Europe/Amsterdam.

## Vercel instellen en valideren

Importeer de reparatiebranch als Next.js-project/Preview. Gebruik Node 24, install `pnpm install --frozen-lockfile`, build `pnpm build`. Er zijn geen lokale databasebestanden of permanente workers nodig. Configureer de bovenstaande Preview-variabelen voor het testproject, stel Auth Site URL/toegestane redirect-URL's in en houd Production op een afzonderlijk project.

Controleer na een nieuwe deployment:

- `/`, `/shop` en `/products/<slug>` laden met status 200; ontbrekend product geeft 404; geen digest `1596871426` of oude APP_MODE-fout in Runtime Logs.
- Adminlogin: fout wachtwoord en gewone gebruiker geweigerd; juiste beheerder kan producten/homepage wijzigen en testorders verwerken; uitloggen blokkeert vervolgmutaties.
- Ontbrekende/ongeldige configuratie geeft een duidelijke fout zonder secrets. Cross-origin mutaties en cron zonder geldige Bearer-header worden geweigerd.
- Plan een testrelease kort vooruit, verifieer blokkering vóór de datum, publicatie na de datum en precies één auditregel. Controleer cronlogs en herhaal de run.
- Plaats uitsluitend testorders; controleer prijsberekening, dubbele aanvraag, onvoldoende voorraad en twee gelijktijdige aankopen van het laatste artikel.
- Controleer Supabase databaseverbinding, Auth-logs, RLS/grants en security advisories. Bekijk Vercel build/runtime logs en leg de deployment-URL vast.

Deze hosted controles kunnen pas met een goedgekeurd WM-project en deploymentrechten worden uitgevoerd. Een lokale build of protocolsimulatie bewijst geen werkende productieverbinding.

## Rollback

Bewaar vóór omschakeling zowel de oude SQLite-backup als een Supabase-backup. De oude codebranch blijft bestaan, maar was alleen geschikt voor een lokale demo: rol productie niet blind terug naar de oorspronkelijke foutieve Vercel-build. Zet bij problemen checkout uit, pauzeer uitsluitend de WM-releasejob en herstel de laatst gevalideerde deployment/configuratie. Verwijder geen tabellen en draai geen destructieve down-migratie. Bewaar nieuwe orders voordat dataherstel wordt overwogen.
