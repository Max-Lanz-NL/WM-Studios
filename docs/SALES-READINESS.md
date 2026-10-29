# Verkoopvoorbereiding — nog geen echte verkoop

## Besluit van 28 oktober 2026
De gebruiker wil de winkel voorlopig alleen verkoopklaar maken. Geen echte verkoop, betaalde abonnementen of live betaalintegratie inschakelen. APP_ENV blijft staging; de bestaande productieblokkade blijft actief. Het publieke hoofdadres is een demonstratie met fictieve producten en bestellingen.

## Afgeronde basis
- Centrale PostgreSQL-database, toegangsregels, persoonlijke medewerkersaccounts en rolcontrole.
- Online staging op het hoofdadres; vijf configuratievariabelen als Vercel Secret.
- Persoonlijk beheerdersaccount ingericht; online beheer nog afzonderlijk accepteren met de gebruiker.
- Voorraadreserveringen, servercontrole tegen overselling en automatische releaseplanning.

## Verbeteringen in deze branch
- Shopnavigatie verwijst naar de juiste homepage-onderdelen.
- Productlinks openen een deelbare product-URL; snelle productvoorvertoning blijft beschikbaar.
- Mobiel menu biedt zoeken en favorieten; kledinglijnfilter is ook mobiel beschikbaar.
- Echte kleurkeuze bij meerdere kleuren en maatkeuze per kleur; aantallen kleuren/maten komen uit de varianten.
- Plusknop en toevoegen begrensd op bekende voorraad en maximaal 20 per variant. De database blijft de uiteindelijke controle uitvoeren bij bestellen.
- Filters kunnen gezamenlijk worden gewist. Decoratieve kleurbollen en onjuist positiegebonden productlabel verwijderd.
- Privacyconcept aangepast aan centrale opslag. Shop en informatiepagina's krijgen specifiekere paginatitels.

## Nodig van de oprichters, vóór echte verkoop
Lever deze gegevens aan in een privé werkdocument; geen wachtwoorden/API-sleutels in documenten, chat of GitHub.

| Onderdeel | Nog aan te leveren |
|---|---|
| Producten | Definitieve naam, beschrijving, materiaal, verzorging, maattabel, eigen/toegestane foto's, prijs en btw, kleur/maat/SKU, werkelijke voorraad |
| Bedrijf | Handelsnaam, KvK- en btw-gegevens indien van toepassing, zakelijk contactadres, contact-e-mail, klantenservicetermijn |
| Levering | Landen, tarieven, gratis-verzendgrens, levertijden, vervoerder of handmatige werkwijze |
| Retouren | Retouradres, retourprocedure, kosten en afhandeling |
| Betaling | Keuze provider met transactiekosten of handmatige overschrijving; geen echte bankgegevens in openbare repo |
| Privacy | Bewaartermijnen, contactpunt en definitieve informatie over gebruikte diensten |

## Technische stappen die daarna nog openstaan
- Online beheeracceptatie met eigen account: product maken/bewerken, voorraad aanpassen, release plannen en order verwerken. Geen wachtwoord door de agent laten invoeren of delen.
- Echte betaling en webhooks of handmatige betaalstatusflow; demo-orders mogen nooit automatisch als echt betaald gelden.
- Werkende transactionele e-mail, herstel/uitnodigingsflow en afmeldproces voor notificaties.
- Afzonderlijke live database en gecontroleerde overdracht van uitsluitend echte catalogusgegevens; demo-orders/accounts niet blind kopiëren.
- Herstelbare backups, hersteltest, foutmeldingen/monitoring en accountbeveiliging.
- Definitieve service- en privacyteksten, foto-/claimcontrole en laatste mobiele/toegankelijkheidscontrole.
- Hostingkeuze voor commerciële verkoop: Vercel Hobby is uitsluitend persoonlijk/niet-commercieel. Geen betaalde upgrade of verhuizing uitgevoerd.

Verwijder demo-aanduidingen en schakel live checkout pas in nadat deze onderdelen daadwerkelijk zijn ingevuld, gebouwd en gecontroleerd. Demo-teksten verbergen maakt de winkel niet verkoopklaar.

Bronnen: https://vercel.com/docs/plans/hobby en https://supabase.com/docs/guides/platform/free-project-pausing (gecontroleerd 28 oktober 2026).

## Controle van deze verbeteringen
28 oktober 2026: 39 unit-/SQL-/configuratietests en 9 lokale browsertests geslaagd. De browsercontroles gebruiken een tijdelijke Auth/Data API-fixture met PostgreSQL/RLS; dit is geen vervanging van de afzonderlijke echte Supabase-acceptatie. Nieuw gecontroleerd: mobiel zoeken/favorieten/kledinglijnfilter, deelbare productlinks, kleurselectie bij gelijke maat en voorraadbegrenzing na herladen. Bestaande checkout, orderverwerking, conceptproduct opslaan, CSRF en laatste-artikel-concurrency blijven slagen. De eerste kleurtest vond een onvolledig expliciet formulierlabel; dit is gecorrigeerd en de volledige browsersuite is daarna opnieuw geslaagd.
