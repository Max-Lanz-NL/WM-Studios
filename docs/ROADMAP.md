# Resterende werkzaamheden

De huidige migratie levert genormaliseerde Supabase-opslag, RLS, persoonlijke Auth-integratie, rollen, een bronexport/import, reserveringstransacties en databaseplanning. De bestaande webshop en basisbeheerflows zijn behouden.

Voor acceptatie van deze migratie zijn nog nodig:

- Een aangewezen leeg WM Studio-stagingproject of werkende volledige lokale Supabase-stack met veilig ingestelde sleutels.
- Migraties toepassen en echte Supabase advisors uitvoeren; RLS en functieprivileges controleren op de gekozen stack.
- Echte medewerkersaccounts instellen; onafhankelijke logins, refresh, sessie-intrekking en MFA-beleid verifiëren.
- pg_cron-installatie, jobhistorie, herstartgedrag en monitoring controleren.
- Gelijktijdige reserveringen en catalogusmutaties met meerdere echte PostgreSQL-backends testen.
- Stagingacceptatie van bronimport, productbeheer, winkelmand, testcheckout en orderverwerking.

Nog niet productieklaar: Mollie/providerwebhooks, echte financiële transacties, late-betalingreconciliatie, Sendcloud, labels/printers, retouren/refunds, klantaccounts, volledige CMS/marketing, media-upload, complete audit-UI, backups/PITR en hersteltest, juridische teksten en volledige toegankelijkheid/performance-audit. Productieconfiguratie is bewust geblokkeerd.

De originele volledige opdracht staat in `MASTER-PROMPT.txt`. Er zijn geen bestaande productieprojecten of productiegegevens gewijzigd.
