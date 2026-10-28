# Resterende werkzaamheden

De huidige migratie levert genormaliseerde Supabase-opslag, RLS, persoonlijke Auth-integratie, rollen, een bronexport/import, reserveringstransacties en databaseplanning. De bestaande webshop en basisbeheerflows zijn behouden.

Op 28 oktober 2026 lokaal uitgevoerd: vier migraties toegepast, zes oorspronkelijke producten en volledig bronarchief gecontroleerd, afzonderlijke eigenaaraccounts aangemaakt, daadwerkelijke logins/sessieverversing/RLS getest, twee PostgreSQL-backends op de laatste voorraad getest en Cron-publicatie/expiratie waargenomen. Supabase advisors melden geen problemen.

Voor verdere acceptatie en livegang zijn nog nodig:

- Alleen na nieuwe toestemming: een afzonderlijk cloud-stagingproject configureren en daar acceptatie herhalen. De huidige voorkeur is uitsluitend lokaal.
- MFA-challenge en beleid voor echte medewerkers implementeren.
- Monitoring en waarschuwingen bij uitblijvende/mislukte Cron-runs, herstart- en hersteltests onder belasting.
- Uitgebreide multi-user-tests voor gelijktijdige catalogusmutaties, volledige toegankelijkheid en productie-loadtests.

Nog niet productieklaar: Mollie/providerwebhooks, echte financiële transacties, late-betalingreconciliatie, Sendcloud, labels/printers, retouren/refunds, klantaccounts, volledige CMS/marketing, media-upload, complete audit-UI, backups/PITR en hersteltest, juridische teksten en volledige toegankelijkheid/performance-audit. Productieconfiguratie is bewust geblokkeerd.

De originele volledige opdracht staat in `MASTER-PROMPT.txt`. Er zijn geen bestaande productieprojecten of productiegegevens gewijzigd.
