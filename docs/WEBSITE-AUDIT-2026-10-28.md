# Websitecontrole WM Studio Collective — 28 oktober 2026

## Oordeel
De nieuwste Vercel-deployment is bruikbaar als demonstratiewinkel, maar nog niet klaar voor echte verkoop. Er zijn concrete navigatie- en presentatieproblemen. De eerder gedeelde vaste branchlink werkt niet betrouwbaar over alle routes.

## Gecontroleerde omgevingen
- Nieuwste werkende deployment: https://wm-studios-hnye9igcn-schoolpulse.vercel.app/
- Eerder gedeelde branchlink: https://wm-studios-git-feat-supabase-staging-migration-schoolpulse.vercel.app/
- Broncode op branch feat/supabase-staging-migration.

Dit was een inspectie. Geen broncode, productinstellingen of productieomgeving gewijzigd. Eén fictieve wachtlijstregistratie met audit-release@example.test toegevoegd. De geslaagde fictieve checkout uit de direct voorafgaande publicatiecontrole is meegenomen; geen tweede bestelling geplaatst.

## Wat werkt
- Nieuwste deployment: homepage, shop en directe product-URL laden met centrale catalogus.
- Zes producten en bijbehorende prijzen/varianten zichtbaar.
- Desktopopmaak: samenhangende kleuren, typografie, duidelijke beelden en productvensters; geen kapotte afbeelding vastgesteld na laden van de bekeken catalogus.
- Zoeken op jacket levert één passend product.
- Favoriet toevoegen en favorietenfilter geven het geselecteerde product.
- Maat selecteren en winkelmand werken; vorige livecontrole bevestigde demo-order van EUR69,95 inclusief EUR4,95 verzending.
- Aankomende hoodie toont releasedatum, afteller en wachtlijst, zonder koopknop. Wachtlijstregistratie bevestigt succes en vermeldt dat mail niet is aangesloten.
- /admin toont zonder aanmelding uitsluitend het inlogscherm.
- Testomgeving is herkenbaar als demo; zoekmachine-indexering is uitgeschakeld.
- Opnieuw uitgevoerd: 39 tests in 6 testbestanden geslaagd.

## Bevindingen, op prioriteit

### 1. Hoog — vaste branchlink toont configuratiescherm op /shop
Twee keer rechtstreeks bezocht: de vaste branchlink met /shop toont ‘De studio wordt verbonden’. Dezelfde route op wm-studios-hnye9igcn-schoolpulse.vercel.app werkt. De homepage van de branchlink was wel zichtbaar. De exacte oorzaak (alias, routecache of oudere deployment) is nog niet bewezen; eerst de domeintoewijzing en routegedrag controleren. Mijn eerdere bevestiging van de vaste link was daardoor te beperkt.
Bewijs: data/audit-stable-shop.png.

### 2. Hoog — online beheer nog niet afgetest
Er zijn nog geen afzonderlijke online medewerkersaccounts ingericht. De inlogpagina werkt, maar productbeheer, rollen, orderoverzicht en releasebeheer zijn hierdoor niet met online accounts geaccepteerd. Lokale geslaagde tests vervangen die controle niet.

### 3. Middel — twee headerlinks werken niet op de shop
‘The collective’ wijst op /shop naar #brands en ‘Our story’ naar #story. Deze onderdelen bestaan alleen op de homepage. De footer gebruikt wel /#brands en /#story. Reproduceerbaar via DOM-controle.
Bron: src/components/storefront.tsx, hoofdnavigatie.

### 4. Middel — privacytekst beschrijft verkeerde opslag
/info/privacy zegt dat testorders en wachtlijsten lokaal worden opgeslagen. Inmiddels staan die centraal in Supabase. Tekst moet de daadwerkelijke opslag en verwerkers beschrijven voordat persoonsgegevens worden gebruikt. Contact-, verzend- en voorwaardenteksten zijn bovendien nog expliciete concepten.
Bron: src/app/info/[slug]/page.tsx.

### 5. Middel — mobiele bediening mist mogelijkheden
Broncodecontrole: onder 560px verdwijnt de zoekknop; onder 800px verdwijnen wishlist en kledinglijnfilter. Het mobiele menu biedt hiervoor geen vervanging. Op /shop zijn ook de homepage-kledinglijntegels afwezig. Daarmee ontbreken op mobiel zoek-, favorieten- en kledinglijnbediening die desktop wel heeft.
Beperking: mobiele layout is via CSS en componentcode beoordeeld, niet op een echte telefoon of een aangepaste mobiele browserbreedte. Visuele mobiele acceptatie blijft open.
Bron: src/app/globals.css en src/components/storefront.tsx.

### 6. Middel — kleurweergave en productlabels zijn decoratief
Kleurbolletjes zijn hard gecodeerd en niet gekoppeld aan varianten; ze zijn niet aanklikbaar. Productdetails tonen alleen de eerste kleur, ook als meerdere kleuren als varianten worden ingericht. De tekst ‘5 maten’ telt alle varianten en kan daardoor bij meerdere kleuren onjuist worden. In de bekeken catalogus sluiten witte/grijze foto's niet altijd aan op de kleur ‘Stone’.
Daarnaast krijgt elk eerste zoek- of filterresultaat automatisch het label THE ESSENTIAL; bij zoeken op jacket kreeg de jas dat label. Dit hoort productinhoud te zijn, geen positie in de lijst.
Bron: src/components/storefront.tsx.

### 7. Middel — aantal in winkelmand kan boven zichtbare voorraad komen
Broncodecontrole: toevoegen controleert voorraad, maar de plusknop in de winkelmand begrenst alleen op 20 en controleert niet de variantvoorraad. De database controleert bij afrekenen opnieuw, dus dit is geen aangetoonde overselling, maar leidt tot een vermijdbare fout pas tijdens checkout. Toevoegen heeft bovendien niet dezelfde grens van 20 als checkout.
Bron: add/update in src/components/storefront.tsx; servervalidatie src/app/api/store/route.ts.

### 8. Laag — productnavigatie en paginakoppen kunnen beter
Klikken op een product opent een venster zonder de URL te veranderen. Een directe product-URL bestaat wel, maar de normale klik levert geen deelbare product-URL en browser-teruggedrag op. De shop heeft geen h1. Alle pagina's gebruiken momenteel dezelfde algemene paginatitel.

### 9. Nog niet opgeleverd voor echte verkoop
Echte betaling, verzending, bevestigingsmails, wachtlijstmails, eigen productfotografie, productmaterialen/wasvoorschriften en definitieve bedrijfs-/serviceteksten ontbreken. De hero toont 01–03 alsof er meerdere beelden zijn, maar er is één statisch beeld. Dit zijn demo-/afwerkingspunten, geen storing in Supabase.

## Aanbevolen volgorde
1. Vaste Vercel-link en alle routes consequent naar de juiste deployment laten wijzen.
2. Navigatielinks, privacytekst en mobiele bediening herstellen.
3. Kleurvarianten, labels en voorraadfeedback corrigeren.
4. Persoonlijke online medewerkersaccounts inrichten en de beheerflows online nalopen.
5. Daarna verdere afwerking en voorbereidingen voor echte verkoop.

## Grenzen van deze controle
Geen volledige beveiligingsaudit, belastingtest, echte betaling of juridisch oordeel uitgevoerd. Geen ingelogde online beheertest mogelijk zonder ingerichte medewerkersaccounts. De 39 opnieuw uitgevoerde tests zijn unit-/SQL-/configuratietests; de eerdere lokale browser- en concurrencytests zijn tijdens deze inspectie niet opnieuw uitgevoerd.

## Herstel hoofdadres — 28 oktober 2026
Na afzonderlijke toestemming van de gebruiker is wm-studios.vercel.app hersteld. De eerdere publicatie in Vercel Production had geen Supabase-configuratie; de vijf bestaande testinstellingen zijn daar apart als Secret toegevoegd. APP_ENV blijft staging, met hetzelfde nieuwe WM Studio-testproject. De branchspecifieke Preview-instellingen zijn behouden.
Deployment 26fzf8Y6GNyGgGtUJNWK3JqERbNj (bron dd2ffcf) is Ready. Homepage, /shop en /products/the-essential-tee zijn rechtstreeks op https://wm-studios.vercel.app/ gecontroleerd en tonen de winkel in plaats van het configuratiescherm. Gebruik voortaan dit hoofdadres. Bewijs: data/vercel-main-restored.png. De overige auditbevindingen blijven open.

## Voorbereidingsverbeteringen — 28 oktober 2026
De gebruiker kiest voorlopig verkoopvoorbereiding zonder echte verkoop. In de vervolgaanpassing zijn de shoplinks, mobiele zoek-/favorietenbediening, mobiele kledinglijnfilter, voorraadbegrenzing in de winkelmand, kleurselectie, variantentelling, positiegebonden productbadge en privacy-opslagtekst gecorrigeerd. Productlinks gebruiken echte product-URL's. 39 tests en 9 browsertests slagen; typecheck en hostingbuild slagen. Zie SALES-READINESS.md voor de actuele openstaande werkzaamheden. Dit vervangt niet de open online beheeracceptatie of echte verkoopvoorbereiding met aangeleverde bedrijfsgegevens.
