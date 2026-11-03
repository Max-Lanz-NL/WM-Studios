# Volledige webshopcontrole — 3 november 2026

Uitgangspunt: commit 26a1fae, herstelbranch codex/full-shop-audit. Uitsluitend test/staging. Geen nieuwe databaseprojecten, betaalde diensten, schemawijzigingen of ruimere toegangsrechten.

## Gevonden en verholpen

| Onderdeel | Bevinding en oplossing |
|---|---|
| Servicepagina's | Losse lege uitlegpagina's vervangen door een samenhangend servicedeel met navigatie, contact, bezorging/retouren, FAQ en conceptbeleid. Ontbrekende echte informatie wordt eerlijk als voorbereiding vermeld. |
| Websitebeheer | Bedrijfsnaam, zakelijk contactadres, e-mail, registratie, levering, retouren, privacy en voorwaarden zijn via Website te bewerken. Publicatie gebruikt bestaande centrale contentopslag en content.write-controle. Geen nieuwe SQL-migratie nodig. |
| Gegevensbehoud CMS | Oudere homepage-clients zonder services laten bestaande servicegegevens intact. Lege velden kunnen bewust worden opgeslagen. Tekst wordt als tekst weergegeven; contact-e-mail wordt gevalideerd. |
| Winkelmand | Corrupte regels, dubbele SKU's, verdwenen varianten, toekomstige artikelen en te grote aantallen worden bij laden met de huidige catalogus vergeleken. Aanpassingen worden gemeld. De server blijft de uiteindelijke voorraadcontrole. |
| Browseropslag | Geblokkeerde of volle opslag veroorzaakt geen crash. De klant krijgt een melding dat de mand mogelijk niet bewaard blijft. |
| Checkoutformulier | Een verbindingsfout wist de ingevulde gegevens niet meer. Er is een terugknop naar de mand; velden hebben passende lengtegrenzen. |
| Verloren bevestiging | Dezelfde checkoutinhoud hergebruikt een sleutel, ook na herladen. Een opgeslagen sleutel kan alleen een testbevestiging met nummer/totaal terughalen; geen klantgegevens. De lookup is same-origin, rate-limited en gebruikt de serverclient. Alleen paid_demo testorders worden teruggegeven. |
| Ontvangstbewijs | De laatste demobevestiging is in dezelfde browsertab opnieuw te openen. De tijdelijke referentie en hash staan in sessieopslag; naam/adres/e-mail worden daar niet leesbaar opgeslagen. |
| Dialogen | Wisselen van mobiel menu naar zoeken vernieuwt de toetsenbordfocus en focuslus. Het zoekveld krijgt focus; Escape sluit het actuele paneel. |
| Navigatie | De huidige volledig unisexcollectie toont Unisex in plaats van twee identieke Men/Women-filters. FAQ staat in de footer; de 404-knop leidt naar de collectie. |
| Beheer | Overgebleven Nederlandse labels vervangen. Omzet en omzetgrafiek tellen geen onbetaalde/geannuleerde orders mee. Ordermutaties zijn alleen zichtbaar met orders.write; serverrechten blijven ongewijzigd. |
| Releases | UTC-datum/tijdkiezer in plaats van handmatig typen van een volledige ISO-timestamp. De winkel blijft Amsterdamse tijd tonen. |
| Verkoopoverzicht | Instellingen toont product- en service-inhoud die nog ontbreekt. Dit is een inhoudscheck, geen verklaring dat verkoop juridisch of technisch live mag. |
| Laden en foutmeldingen | Eén echte main-landmark tijdens streamend laden. Niet-JSON-serverantwoorden en verbindingsproblemen krijgen begrijpelijke meldingen. |

## Controle
- 50 unit-/PostgreSQL-/configuratietests geslaagd.
- Volledige browsersuite met 20 scenario's geslaagd; daarna zes gerichte auditcontroles geslaagd, inclusief een nieuw scenario voor geblokkeerde opslag (21 unieke browserscenario's).
- Gecontroleerd: homepage, shop, deelbare productpagina, contact, verzending, FAQ, privacyconcept, voorwaardenconcept, beheerlogin en 404; zoeken, favorieten, filters, voorraad, checkout, ontvangstbewijsherstel, orderverwerking, producteditor, releases, voorraadtab, instellingen en servicebeheer.
- Verlies van een checkoutantwoord is bewust gesimuleerd: twee verzoeken gebruiken dezelfde sleutel en dezelfde order, daarna herladen en nummer/totaal terughalen zonder persoonlijke gegevens.
- Service-inhoud is in een geïsoleerde lokale fixture opgeslagen en vervolgens hersteld; geen fictieve bedrijfsgegevens in de online winkel ingevuld.
- Mobiele servicepagina en beheer visueel gecontroleerd; TypeScript en Next.js-build geslaagd.
- Browsertests gebruiken echte migratie-SQL/RLS met een lokale Auth/Data API-fixture. Dat vervangt geen live betaal-, mail- of herstelacceptatie.

## Nog niet productieklaar
Echte producten/foto's/voorraad en gecontroleerde claims ontbreken. Foto's zijn via toegestane URL's te koppelen; er is nog geen bestandsuploadformulier. Bedrijfs- en bezorg-/retourgegevens moeten door de eigenaar worden ingevuld. Beleidsstukken blijven concepten. Echte betalingen, webhooks, terugbetalingen, ordermails, medewerkersherstel/MFA-acceptatie, vervoerders/tracking, geschikte commerciële hosting, live-database, backup/hersteltest en monitoring zijn niet afgerond. APP_ENV blijft staging; geen echte verkoop of indexering ingeschakeld. Het hoofdadres is niet opnieuw gepromoveerd.

## Bediening
Beheer → Website voor bedrijfs- en service-inhoud. Beheer → Instellingen voor de resterende inhoudscheck. Producten → bewerken voor foto's en productinformatie. Gebruik uitsluitend bedoelde openbare bedrijfsgegevens in de servicevelden; nooit sleutels, wachtwoorden of privébestanden.
