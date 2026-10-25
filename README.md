# WM Studio Collective

Een werkende **lokale ontwikkelversie**, gebouwd op Next.js App Router, React en strict TypeScript. Deze eerste oplevering is bewust geen productieplatform. De volledige opdracht staat in `docs/MASTER-PROMPT.txt`; de resterende fasen staan in `docs/ROADMAP.md`.

## Starten

Vereist: Node.js 24.18 of nieuwer, npm en een lokale schijf waarop SQLite kan schrijven.

```sh
npm ci
npm run setup
npm run dev
```

Open http://127.0.0.1:3000. Het dashboard staat op http://127.0.0.1:3000/admin. Het willekeurig gegenereerde beheerwachtwoord staat in `.env.local` bij `ADMIN_PASSWORD`. Deze file wordt niet in Git opgeslagen. Beide oprichters kunnen deze lokale demo gebruiken; afzonderlijke accounts en rollen zijn nog niet geïmplementeerd.

Start in een tweede terminal de releaseworker:

```sh
npm run jobs
```

De worker controleert elke 15 seconden op verschuldigde releases. Na een herstart haalt hij achterstallige releases in. Tijdens checkout wordt de verkoopstart onafhankelijk hiervan altijd gecontroleerd. De worker verstuurt geen e-mails. Zonder draaiende worker verandert de opgeslagen publicatiestatus niet automatisch; verkoop wordt wel vanaf de juiste tijd toegestaan. Dit is een lokale worker, geen beheerde productie-jobdienst.

## Wat werkt

- Responsive modehomepage, shop, productdetails, merk- en categoriefilters, zoeken en wishlist.
- Winkelmand met maten, aantallen en lokale opslag.
- Demo-checkout met serverprijzen, voorraadcontrole, historische ordersnapshots en idempotente opslag.
- SQLite-transacties met schrijflock; geen gedeeltelijke afboekingen of negatieve voorraad door de checkout.
- Afgeschermd dashboard; producteditor met varianten, voorraad, SKU-validatie, status en UTC-releaseplanning.
- Coming Soon, countdown, toestemming en ontdubbelde wachtlijstregistratie.
- Achtergrondpublicatie met lokale worker; annuleren door de status op concept te zetten.
- Orderoverzicht, pickhulp, ingepakt/verzonden-demostatus en CSV-export zonder klantgegevens.
- Dashboardcijfers uit de database, voorraadlijst en bewerkbare hero-tekst.
- Ondertekende beheersessie, HTTP-only cookie, herkomstcontrole en eenvoudige persistente rate limiting.
- Juridische conceptpagina's, robots-blokkade en configuratieoverzicht met ontbrekende integraties.

## Belangrijke grenzen

Alle producten en beelden zijn tijdelijke demo-inhoud. Foto's komen van Unsplash en zijn geen foto's van eigen kleding; vervang en verifieer alle afbeeldingen voor publicatie. Het WM-woordmerk is een vervangbaar typografisch concept, geen goedgekeurd logo. Google Fonts en Unsplash worden extern geladen.

Er zijn **geen** echte betalingen, verzendlabels, refunds, klantaccounts, e-mails, printerkoppelingen of Supabase-verbinding. `paid_demo` betekent alleen dat de demo-order opgeslagen is. Er is geen betaling ontvangen. De client mag nooit de betaalstatus voor een toekomstige echte integratie bepalen.

Gebruik fictieve namen en adressen. De lokale database bevat de demo-orders en wachtlijst. De demo is bedoeld voor één lokale computer, niet voor een publiek gedeelde server. De gedeelde beheerlogin heeft geen MFA, aparte medewerkerstoegang of sessie-intrekking per medewerker. `APP_MODE` moet expliciet `demo` zijn; een onbekende of ontbrekende modus wordt geweigerd.

## Testen

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Playwright gebruikt standaard de geïnstalleerde Microsoft Edge-browser. Op andere systemen: installeer een geschikte Playwright-browser en stel `PLAYWRIGHT_CHANNEL=chromium` in. De E2E-server gebruikt poort 3001 en een nieuwe `data/e2e-<uuid>.sqlite` per run, afzonderlijk van de normale demo. De testdatabase blijft bestaan voor onderzoek. `E2E_DATABASE_PATH` kan een specifieke testdatabase aanwijzen.

Zie `docs/TEST-REPORT.md` voor de geverifieerde testresultaten.

## Opslag en herstel

SQLite-tabellen worden bij de eerste start aangemaakt; uitsluitend een lege database wordt met demo-inhoud gevuld. `products`, `orders`, `waitlist`, `settings`, `audit` en `attempts` vormen de lokale basis. Product- en ordergegevens zijn JSON-documenten; dit is niet het genormaliseerde PostgreSQL-productieschema uit de opdracht.

Voor een consistente lokale back-up: stop zowel de app als de worker en kopieer de volledige `data`-map naar een beveiligde locatie. Voor herstel: stop beide processen en herstel de complete map. Controleer daarna producten en een historische order voordat je verdergaat. Bewaar back-ups niet in Git. Productie vereist beheerde back-ups, hersteltests en een afzonderlijk bewaarbeleid.

## Hosting

Deze versie is niet geschikt voor Vercel: SQLite vereist hier een blijvend lokaal bestand en Node's SQLite-runtime. Er is bewust geen misleidende Vercel- of Supabase-deployconfiguratie. Vóór hosting moeten opslag en authenticatie worden gemigreerd en alle beveiligings- en bedrijfsworkflows worden afgerond. Er zijn geen accounts aangemaakt en geen externe productiegegevens gewijzigd.

Bronnen voor deze implementatie: [Next.js-installatie](https://nextjs.org/docs/app/getting-started/installation), de versiegebonden documentatie in `node_modules/next/dist/docs`, en [Node SQLite](https://nodejs.org/api/sqlite.html). Externe provider-API's moeten bij hun implementatie opnieuw tegen de actuele officiële documentatie worden gecontroleerd.
