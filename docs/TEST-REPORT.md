# Testverslag Supabase/Vercel-reparatie

## Gecontroleerd

| Controle | Resultaat |
| --- | --- |
| PostgreSQL-migratie, commerce en RLS in PGlite | 11 tests geslaagd |
| Configuratie, actuele Auth-rol, Origin en productie-betaalblokkade | 4 tests geslaagd |
| Read-only SQLite-export en transactionele import | 1 test geslaagd |
| Productiebuild (Next.js 16.4.3, Node 24) | Geslaagd, inclusief TypeScriptcontrole |
| Afzonderlijk `tsc --noEmit` | Geslaagd |
| `pnpm install --frozen-lockfile --offline` | Geslaagd |
| `pnpm audit --prod` | Geen bekende kwetsbaarheden gevonden |
| Browsertests tegen de gebouwde productieversie | 8 tests geslaagd |

De browsertests testen de echte applicatie, de Supabase JavaScript-client en de echte SQL-functies in PGlite. Auth en de HTTP/Data API zijn lokaal gesimuleerd. Er zijn geen echte klantgegevens of betalingen gebruikt.

De ontwikkelserver heeft zeven volledige browsertests doorlopen. De definitieve productieversie heeft acht tests doorlopen: shop/productdetails, loginrollen/cronbeveiliging, gelijktijdige kopers van het laatste artikel, onbevoegde/cross-origin mutaties, testbestelling en orderverwerking, producteditor, mobiele/desktopweergave en verwijdering van de Secure-beheercookie bij uitloggen. Alle acht slagen.

## Gedekte regressies

- Voorraad en order worden volledig teruggedraaid bij een fout in een bestelregel.
- Meerdere maten van één product worden correct afgeboekt; prijzen komen uit de database en orders bewaren een snapshot.
- Dubbele aanvragen geven dezelfde order; een gewijzigde aanvraag met dezelfde sleutel wordt geweigerd.
- Dubbele slugs/SKU's, negatieve voorraad, onveilige media en vroege aankopen worden geweigerd.
- Releases worden eenmaal gepubliceerd, annulering blijft concept en Amsterdamse wintertijd blijft correct.
- Publieke RLS verbergt conceptproducten en privégegevens; gewone gebruikers kunnen geen beheerrechten uit `user_metadata` verkrijgen.
- Rechtstreekse anonieme schrijf-RPC's en tabelmutaties zijn geweigerd.
- Persistente rate limits, orderstatusovergangen en ontdubbelde wachtlijstregistraties werken.
- SQLite-export verandert het bronbestand niet; import behoudt product-ID, varianten, voorraad, release, order, audit, wachtlijst en homepage. Een niet-lege doelcatalogus wordt geweigerd.

## Grenzen / nog te valideren

Er is geen geschikt WM-Studios-project beschikbaar in de gekoppelde Supabase-account en er is geen Vercel-deployment geconfigureerd. Bestaande Schoolpulse-projecten zijn niet gewijzigd. De GitHub-connector weigert schrijfacties met `403 Resource not accessible by integration`; lokaal Git heeft geen bruikbare GitHub-aanmelding. De reparatiebranch en het herstelpunt bestaan lokaal.

Hosted Supabase Auth, Data API, security/performance advisories, pg_cron, echte netwerkverbinding en productie-runtime zijn niet gevalideerd. PGlite gebruikt één lokale verbinding: gelijktijdige HTTP-aanvragen zijn getest, maar lockcontention tussen meerdere echte PostgreSQL-verbindingen moet nog in staging worden gecontroleerd. De CI-workflow is toegevoegd maar kon niet op GitHub worden gestart.

De oude APP_MODE-fout is uit de runtimecode verwijderd en de gebouwde applicatie laadt lokaal. Dit bewijst **niet** dat digest `1596871426` al uit de live Vercel-logs verdwenen is. De publieke site kon via de webtool niet worden opgehaald. Voer na deployment de controles uit [DEPLOYMENT.md](DEPLOYMENT.md) uit en leg URL en logresultaten vast.

De openbare repository bevatte geen bestaande SQLite-database. Werkelijke product-/orderdata zijn daarom niet geïmporteerd; daarvoor is een beveiligde bronbackup nodig. Seeddata en alle uitgevoerde tests zijn fictief.
