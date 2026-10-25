# Architectuur en implementatieplan

## Repositoryanalyse

De opgegeven openbare GitHub-repository was leeg. Er was geen bestaande implementatie, database, deployment of functionaliteit om over te nemen. De eerste mijlpaal is een uitvoerbare verticale doorsnede: productconcept → release → verkoop → orderverwerking. Dit geeft de oprichters een concrete basis om vormgeving en dagelijkse workflow te beoordelen.

## Huidige structuur

- `src/app`: serverpagina's en gevalideerde mutatie-API's.
- `src/components`: interactieve webshop en afgeschermde beheerwerkruimte.
- `src/lib/model.ts`: validaties, geldbedragen in eurocenten en verkoopstartregels.
- `src/lib/db.ts`: lokale repository, transactiegrenzen, seed en auditgebeurtenissen.
- `src/lib/auth.ts`: beheerautorisatie, sessieondertekening, rate limiting en herkomstcontrole.
- `scripts/release-worker.ts`: onafhankelijke, herstartbare lokale releasecontrole.
- `tests` en `e2e`: regressies voor bedrijfsregels en complete gebruikersflows.

Alle mutaties worden op de server gecontroleerd. De browser levert SKU en aantallen, nooit een vertrouwde prijs of orderstatus. Orders bevatten een snapshot van naam, variant en prijs. Een `BEGIN IMMEDIATE`-transactie serialiseert voorraadwijzigingen tussen SQLite-verbindingen. Een unieke idempotentiesleutel voorkomt dubbele orderopslag bij opnieuw versturen van dezelfde checkout.

Producten in concept, review, goedgekeurd of gearchiveerd worden niet aan de publieke component doorgegeven. Geplande producten zijn bewust publieke Coming Soon-producten; geheime preview-releases zijn nog niet ondersteund. Elke toekomstige publicatiestatus moet daarom een afzonderlijke zichtbaarheidstoets krijgen.

## Productiearchitectuur: volgende implementatiefase

Vervang de lokale repository door services rond Supabase PostgreSQL met genormaliseerde tabellen en migraties. Modelleer eerst brands, collections, products, variants, media, releases, release_products, inventory_movements, reservations, orders, order_items en payment_events. Voeg ordersnapshots, unieke providersleutels, transactiefuncties, foreign keys en indexen toe. Alle blootgestelde tabellen krijgen RLS met expliciete rechten; kosten, klantgegevens en interne ontwerpen blijven afgeschermd.

Vervang de gedeelde demo-login door Supabase Auth, servergeverifieerde identiteit, medewerkerlidmaatschappen, configureerbare rechten en MFA voor beheerders. Geen bevoegdheid uit door gebruikers bewerkbare metadata afleiden. Beide eigenaren kunnen dezelfde volledige rechten krijgen.

Vervolgens: Mollie-testbetalingen met voorraadreservering en expiratie, geverifieerde providerstatus en idempotente webhookverwerking. Betaalredirects wijzigen nooit zelfstandig een order in betaald. Achtergrondtaken voor releases en e-mail moeten transactionele outbox-records claimen en veilig herhalen.

Daarna: Sendcloud-labelgeneratie met unieke shipment-sleutel, herdrukken van hetzelfde label, tracking en handmatige overdracht. Printertoegang gebeurt via de afdrukdialoog of een expliciet gekozen lokale printbridge. Retourontvangst, inspectie, voorraadterugplaatsing en providerrefund zijn afzonderlijke geautoriseerde gebeurtenissen.

De laatste fasen omvatten CMS-secties en revisies, marketingtoestemming, financieel onderscheid tussen omzet en marge, toegankelijkheid, monitoring, staging, back-ups en gecontroleerde productie-uitrol. Een livegang blijft geblokkeerd tot deze onderdelen aantoonbaar werken.
