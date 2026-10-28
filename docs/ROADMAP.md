# Status tegenover de masteropdracht

Deze oplevering is een geteste lokale tussenstand. Geen van de acht hoofdfasen is al volledig afgerond.

| Fase | Werkende tussenstand | Nog nodig |
|---|---|---|
| Fundament | Next.js, strict TS, validatie, Supabase PostgreSQL-migratie, Auth-adminrol en RLS | Hosted validatie, Storage, MFA en fijnmazige medewerkersrollen |
| Website | Homepage, shop, productdetails, filters, wishlist, responsive navigatie, conceptinformatie | Eigen productbeelden, aparte merk-/collectiepagina's, klantaccount, bestelgeschiedenis, alle definitieve informatiepagina's |
| Producten | CRUD zonder harde verwijdering, varianten, SKU's, voorraad en status | Upload, crop, media-volgorde, maatgroepen, SEO, kosten, leveranciers, bulkacties, paginering, dynamische merken/collecties |
| Releases | UTC-invoer, Amsterdam-weergave, Coming Soon, countdown, wachtlijst, SQL-publicatiefunctie en schedulerconfiguratie | Hosted schedulercontrole, lokale datumkiezer met DST-validatie, collectiedrops, kalender, preview, goedkeuringshistorie, afmelden, bevestigingsmails en notificatie-outbox |
| Verkoop | Persistente mand, demo-checkout, transactievoorraad, snapshots, idempotente demo-orders | Mollie-sandbox, reserveringen, expiratie, webhooks, korting, btw-specificatie, adresvalidatie, factuuradressen |
| Verwerking | Demo-orderlijst, lokale pickhulp, statusovergangen, CSV | Gedeeltelijke fulfillment, barcodes, Sendcloud, tracking, labels, printerdialoog/bridge, audit-tijdlijn in UI |
| Bedrijfsvoering | Databasecijfers, basisvoorraadlijst, hero-teksteditor | Retourportaal, refunds, klantenbeheer, marketing, financieel dashboard, CMS-secties, versiebeheer, transactiemail |
| Productieklaar | Unit- en integratietests, eerste E2E-tests, robots-blokkade, lokale herstelhandleiding | Securityreview, RLS-tests, provider-tests, toegankelijkheidsaudit, performancebudget, monitoring, juridisch definitieve teksten, Vercel/Supabase-deployment |

## Benodigde gegevens voor koppelingen

Vraag deze pas bij de daadwerkelijke implementatie op via veilige omgevingsinstellingen, nooit in broncode of openbare issues: Supabase-projectconfiguratie, Mollie-testsleutel, Sendcloud-testomgeving, e-mailprovider en geverifieerd afzenderdomein. Daarnaast zijn bedrijfsgegevens, vastgesteld beleid, echte productinformatie en het printermodel nodig.

Er zijn geen betaalaccounts of zakelijke contracten aangemaakt. Er is niets live gezet en er zijn geen echte financiële transacties uitgevoerd.
