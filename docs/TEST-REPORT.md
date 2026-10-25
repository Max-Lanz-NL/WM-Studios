# Testoverzicht — 25 oktober 2026

| Controle | Resultaat |
|---|---|
| Next.js productiebuild | Geslaagd |
| Strict TypeScript | Geslaagd |
| Vitest unit-/integratiecontroles | 15 geslaagd, 0 mislukt |
| Playwright / Microsoft Edge | 6 geslaagd, 0 mislukt |
| Afhankelijkheden bij installatie | Geen bekende kwetsbaarheden gemeld door npm audit |
| Visuele controle | Desktopwebshop en dashboard bekeken; mobiele breedte 390 px gecontroleerd |

De tests dekken verkoopgrenzen, zomer-/wintertijdweergave, geplande publicatie, geannuleerde releases, statusafscherming, validatie, serverprijzen, snapshots, idempotentie, rollback bij onvoldoende voorraad, meerdere maten van één product, laatste exemplaar en unieke SKU's/slugs.

De browsertests controleren twee gelijktijdige aanvragen op één resterend exemplaar (precies één succes), manipulatie van clientprijzen, beheerweigering zonder sessie, herkomstcontrole, ongeldige checkout, klantcheckout gevolgd door inpakken, productaanmaak, mobiel menu en Escape-sluiting. Screenshots zijn lokaal beschikbaar in `test-results` en worden niet gecommit.

De eerste browserpoging werd door lokale netwerkbeperkingen geblokkeerd. De volgende run vond geen gebundelde Chromium en signaleerde een herkomstvergelijking met een genormaliseerde hostnaam. De testconfiguratie gebruikt nu de aanwezige Edge-browser en de herkomstcontrole vergelijkt de daadwerkelijke Host-header. De uiteindelijke runs zijn geslaagd. De screenshotvoorbereiding wacht op hydratie voordat lazy images worden geladen.

Niet getest en niet afgerond: Supabase/RLS, externe betaal- en verzendproviders, refunds, klantauthenticatie, printerhardware, productiehosting, volledige toegankelijkheid en belasting-/juridische juistheid. De geslaagde demo-tests verklaren het systeem niet productieklaar.
