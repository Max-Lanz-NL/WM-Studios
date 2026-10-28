# Architectuur

## Requestpad

Next.js Server Components lezen de publieke catalogus en homepage via de Supabase Data API met publishable key en RLS. Serverroutes valideren alle mutaties met Zod en controleren de Origin. Beheerroutes controleren bij elke aanvraag het Supabase Auth-token via `getUser` en de actuele `app_metadata.role`. Alleen servercode kan de Supabase secret key gebruiken.

De beheerinterface blijft een clientcomponent. Die ontvangt alleen de voor die geauthenticeerde beheerder geladen data. Een ongeautoriseerde `/admin`-aanvraag laadt geen catalogusbeheer, orders of wachtlijstgegevens. De authsessie wordt niet gedeeld tussen requests en antwoorden zijn niet cachebaar.

## Opslag

`supabase/migrations` bevat het namespaced schema: producten, SKU-index, orders, wachtlijst, audit, settings en rate limits. Het bestaande JSON-product/orderformaat blijft bewaard om de webshopflows en historische snapshots te behouden. Unieke slugs, SKU's, idempotentiesleutels en relaties zijn databaseconstraints. Iedere blootgestelde tabel heeft RLS en expliciete grants.

Schrijf-RPC's zijn `SECURITY INVOKER`, met lege `search_path`, en alleen uitvoerbaar door `service_role`. De server geeft die bevoegdheid pas na autorisatie door, behalve de specifiek begrensde publieke checkout/wachtlijst/rate-limitflows. Anonieme clients kunnen deze functies niet rechtstreeks oproepen. Checkout is standaard zowel in de app als database uitgeschakeld.

Productwijzigingen, releases en checkout gebruiken dezelfde transactionele advisory lock. Alle stockwijzigingen, snapshots en auditregels van een checkout worden samen gecommit of teruggedraaid. De server gebruikt de opgeslagen prijzen. Een idempotentiesleutel levert alleen voor een identieke aanvraag dezelfde order op. Orders worden met een rijlock van `paid_demo` naar `packed` naar `shipped` verwerkt.

Geplande producten zijn bewust publiek zichtbaar als Coming Soon. Concept, review, approved en archived blijven verborgen. Verkoopstart gebruikt UTC en wordt bij checkout opnieuw gecontroleerd. De interface toont Europe/Amsterdam.

## Achtergrondpublicatie

Supabase Cron kan `wm_publish_due()` iedere minuut in de database uitvoeren. `supabase/scheduler.sql` is een apart infrastructuurscript: geen extensies of externe jobs worden automatisch in bestaande projecten veranderd. Een dagelijkse Vercel-cron is een beveiligd vangnet, passend binnen Hobby. Pro kan de HTTP-route ook iedere minuut inroepen. Herhaling en overlappende runs zijn veilig en halen achterstand in.

## Migratie en herstel

De oorspronkelijke commit en herstelbranch blijven bewaard. De SQLite-exporter opent de bron uitsluitend read-only en produceert een transactiescript dat alleen een lege doelcatalogus accepteert. Er is geen automatische dataverwijdering of migratie bij applicatiestart. Zie [deployment en rollback](DEPLOYMENT.md).

## Volgende fasen

Mollie vereist eerst testbetalingen, voorraadreserveringen met expiratie, webhookverificatie en idempotente provider-events. Betaalredirects mogen geen betaalstatus bepalen. Shipping, e-mail/outbox, returns, MFA en fijnmazige medewerkersrechten blijven afzonderlijke fasen. De huidige implementatie heeft geen live-betaalpad.
