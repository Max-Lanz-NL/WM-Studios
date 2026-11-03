# Studio MW — verkoopvoorbereiding, 3 november 2026

## Wat nu werkt
- Zelfstandige productpagina met eigen titel, kleur/maatkeuze, voorraadcontrole en winkelmand.
- Hoofdfoto en maximaal acht aanvullende foto's met beschrijvingen en toetsenbordbediening.
- Materiaal, pasvorm, verzorging en maatinformatie invullen via /admin → Products → product bewerken.
- Checklist in de producteditor laat ontbrekende inhoud zien. Dit is een inhoudscontrole, geen garantie dat foto's, voorraad of claims correct zijn.
- Collectie sorteren op prijs of naam; duidelijke geselecteerde maten en favorieten.
- Herstelpagina bij onverwachte laadfouten; aangepaste bewegingsvoorkeuren.
- Beheerlink uit het klantmenu verwijderd. /admin blijft rechtstreeks bereikbaar met je bestaande account.

## Foto's toevoegen
Deze versie bevat geen uploadformulier. Gebruik bestaande openbare Supabase Storage-afbeeldingen of laat de eigen bestanden in public/products/ plaatsen. Het beheer accepteert /products/naam.webp (ook jpg/jpeg/png/avif) of een URL op https://PROJECT.supabase.co/storage/v1/object/public/BUCKET/PAD. Er zijn geen nieuwe buckets of ruimere uploadrechten aangemaakt. Publiceer alleen bedoelde productfoto's, geen privébestanden. Unsplash blijft uitsluitend voor demonstraties ondersteund.

De hoofdfoto verschijnt in de collectie. Voeg voor- en achterkant, details en zo nodig de verschillende kleuren toe met concrete beschrijvingen. Er worden geen extra foto's of productclaims verzonnen.

## Database en herstel
Migratie 20261103161521_product_launch_content.sql is aanvullend: materiaal/pasvorm/verzorging/maatinformatie op products en een aparte product_images-tabel. De bestaande catalogus, versies, SKU's, voorraad en orders blijven intact. Foto's worden binnen dezelfde producttransactie opgeslagen. Weggelaten nieuwe velden blijven behouden voor oudere clients; gallery: [] wist alleen de extra foto's van dat artikel. RLS gebruikt de zichtbaarheid van het bijbehorende product. Directe clientwrites blijven gesloten.

Op 3 november toegepast op het afzonderlijke MW STUDIO-stagingproject svgvjzrixgrkolhrlbse, met expliciete toestemming voor de dashboardwaarschuwing. Voor/na: 6 producten, 1 testorder. Migratie geregistreerd; RLS aan; catalog-view security_invoker=true; anon INSERT en authenticated directe UPDATE geweigerd. Schoolpulse-projecten zijn niet gewijzigd.

Codeherstel: vorige commit 33fa8a6; werkbranch codex/launch-preparation. Oude code blijft met het uitgebreide schema werken. Draai de gegevensuitbreiding niet terug met DROP TABLE als er inhoud is ingevuld: exporteer of backup eerst.

## Wat echte verkoop nog blokkeert
1. Echte catalogus: juiste eigen foto's per kleur, materialen, maattabellen, definitieve prijzen en werkelijke voorraad.
2. Bedrijfs- en klantenservicegegevens: zakelijk adres/contact, registratiegegevens waar van toepassing, bezorglanden/tarieven/tijden en retourprocedure.
3. Definitieve service-, privacy- en voorwaardenpagina's op basis van die gegevens.
4. Gekozen en geteste betaalprovider inclusief webhooks, mislukte/afgebroken betalingen, terugbetalingen en ordermails. De huidige checkout verwerkt uitsluitend demo-orders.
5. Hosting die commerciële verkoop toestaat, afzonderlijke live database, backup/hersteltest, monitoring en eigen-accountacceptatie.

APP_ENV blijft staging; echte betalingen en indexering blijven uit. De testlink is geen live verkooppunt. Geen abonnementen afgesloten of kosten aangegaan. Het hoofdadres is niet opnieuw gepromoveerd.

## Controle
46 unit-/PostgreSQL-/configuratietests geslaagd. 15 lokale browsertests geslaagd: checkout, laatste-artikelcontrole, rechten, producteditor inclusief nieuwe inhoud/foto's, productpagina, gallery, maatinformatie, kleur/voorraad, mobiel, sorteren en favorieten. Build en TypeScript geslaagd. Lokale Auth/Data API-fixture gebruikt de echte migratie-SQL en RLS, maar vervangt geen acceptatie van betalingen of e-mail. Online catalogus en veiligheidsinstellingen apart gecontroleerd.

Documentatie voor RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
