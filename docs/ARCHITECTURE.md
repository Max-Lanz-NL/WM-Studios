# PostgreSQL-architectuur

## Opslag

De applicatie heeft geen SQLite-runtime meer. `src/lib/db.ts` leest Supabase-views en voert geautoriseerde RPC's uit. Alleen `scripts/export-sqlite.mjs` gebruikt SQLite voor de eenmalige bronmigratie.

Genormaliseerde tabellen: `brands`, `categories`, `products`, `product_variants`, `releases`, `inventory`, `inventory_reservations`, `inventory_movements`, `customers`, `orders`, `order_items`, `order_events`, `release_waitlist`, `content_settings`, `staff_members`, `roles`, `role_permissions` en `audit_logs`. `private` bevat platforminstellingen, rate limits en volledige importarchieven. Foreign keys, unieke SKU's/slugs, checks en indexen beschermen de relaties.

De views `catalog` en `order_overview` hebben `security_invoker=true`. Ze geven de bestaande React-componenten hun vertrouwde gegevensvorm terug terwijl RLS de onderliggende toegang beperkt. Geld wordt in eurocenten opgeslagen; historische ordernamen, SKU's, kleuren, maten, prijzen en adressen blijven snapshots.

## Authenticatie en rechten

Persoonlijke login gebruikt Supabase Auth. Een requestgebonden SSR-client bewaart tokens in HTTP-only, SameSite=Lax-cookies; staging gebruikt Secure. De Next.js-proxy ververst sessies en schrijft cookies en cacheheaders terug. Auth-routes zijn `private, no-store`; er is geen sessieclient op module-niveau. `getUser()` controleert de identiteit bij Auth, niet een onbetrouwbaar lokaal sessieobject.

| Rol | Catalogus | Orders lezen | Orders verwerken | Klanten | CMS | Medewerkers beheren |
|---|---|---|---|---|---|---|
| owner / admin | Ja | Ja | Ja | Ja | Ja | Rechten aanwezig; provisioning via beveiligd beheerscript |
| designer | Ja | Nee | Nee | Nee | Nee | Nee |
| warehouse | Nee | Ja | Ja | Alleen ordersnapshots voor logistiek | Nee | Nee |
| support | Nee | Ja | Nee | Ja | Nee | Nee |

Rechten komen uit actieve `staff_members` en `role_permissions`, nooit uit gebruikersmetadata. De server controleert opnieuw per actie; de databasecontrole doet dat ook. Het deactiveren van een medewerker blokkeert verdere writes en interne SELECT's onafhankelijk van een nog niet verlopen JWT. Uitloggen trekt de Auth-sessie in. Rechtstreekse Data API-JWT's kunnen tot hun vervaltijd voor publieke cataloguslezingen blijven werken, maar actieve medewerkerrechten worden in RLS opnieuw opgezocht.

De beperkte `SECURITY DEFINER`-functies staan in `private`, hebben een lege search_path en expliciete `auth.uid()`/rechtencontrole. Hun publieke RPC-wrappers zijn `SECURITY INVOKER`. Algemene interne schrijffuncties zijn niet uitvoerbaar door anon/authenticated. Gastcheckout en import zijn uitsluitend service-role RPC's; de servicekey blijft server-side. Directe clientwrites zijn ingetrokken. RLS staat op alle applicatietabellen.

## Voorraad en toekomstige betaling

`inventory.on_hand` is fysiek aanwezig; `reserved` is geblokkeerd. Beschikbaar is het verschil. Constraints voorkomen negatieve waarden en reserveringen boven fysieke voorraad. Checkout vergrendelt producten en voorraad in vaste UUID-volgorde en valideert de actuele prijs, actieve variant en verkoopstart in dezelfde transactie.

Elke checkout heeft een unieke idempotentiesleutel met SHA-256-fingerprint van de inhoud en checkoutmodus. Een herhaling met andere inhoud wordt geweigerd. De huidige staging-checkout maakt `paid_demo` aan en verwerkt een fictieve voorraadverkoop. De functie kan met `reserve_only=true` een pending order en actieve reserveringen van 15 minuten aanmaken zonder fysieke voorraad af te boeken.

Een toekomstige providerflow wordt: serverreservering → providerbetaling met serverbedrag en orderreferentie → geverifieerde providerstatus/webhook → service-only `settle_reservation` → voorraadconsumptie en betaalstatus. Mislukken, annuleren en expiratie geven reserveringen idempotent vrij. Late betaling na expiratie activeert de order niet opnieuw: de providerintegratie moet dit reconciliëren en zo nodig terugbetalen. Er is nog geen webhook- of betaalproviderimplementatie; geen publieke route kan `paid` instellen.

Producten hebben een versienummer. Checkout, reserveringsafhandeling en publicatie verhogen dit. Een oude producteditor wordt geweigerd in plaats van nieuwe voorraadwijzigingen te overschrijven. Bestaande reserveringen blijven bij voorraadcorrecties behouden. Varianten met actieve reserveringen kunnen niet worden verwijderd; historische varianten blijven inactief bestaan voor orderverwijzingen.

## Releases en taken

Releases gebruiken `timestamptz`, Amsterdam voor weergave en de databaseklok voor verkoop. Een pg_cron-job draait elke minuut, haalt gemiste releases in en ruimt verlopen orders op. Mutaties zijn transactioneel en herhaalbaar. De scheduler is niet nodig om voortijdige aankopen te blokkeren. Bestaande rollen en statussen blijven functioneel; de volledige collectie-/kalender-UI valt buiten deze migratie.

De Cron-migratie vereist de Supabase pg_cron-extensie en faalt als die niet kan worden geïnstalleerd. De lokale PGlite-tests voeren de taakfunctie uit, maar slaan de gemarkeerde extensie-installatie over. Monitoring op ontbrekende/mislukte runs moet op staging worden ingericht. Outbox/e-mailbezorging is nog niet geïmplementeerd.
