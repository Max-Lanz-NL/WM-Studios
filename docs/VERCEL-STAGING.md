# WM Studio via Vercel

De online omgeving bestaat uit het bestaande Vercel-project en een **nieuw, afzonderlijk Supabase-stagingproject in de eigen WM Studio-organisatie**. Schoolpulse-projecten worden niet gebruikt. Een Vercel-deployment heeft geen toegang tot de lokale Docker-database of `.env.local` op een computer.

## Voorbereiding

1. Maak of selecteer de eigen WM Studio-organisatie in Supabase. Controleer het tarief voordat een project wordt aangemaakt; een betaalde organisatie of project vereist afzonderlijke kosteninstemming.
2. Maak een leeg `wm-studio-staging`-project in een Europese regio.
3. Pas de vier gecontroleerde migraties toe en voer de Supabase security/performance-advisors uit. Inspecteer eerst de tabellen om te bevestigen dat dit het nieuwe lege project is.
4. Importeer uitsluitend de zes fictieve catalogusproducten. Kopieer geen lokale testaccounts, sessies, wachtwoorden, demo-orders of privé-back-ups naar de online omgeving. Maak afzonderlijke stagingaccounts voor beheer.

## Vercel-instellingen

Selecteer alleen het WM Studios-project. Koppel de migratiebranch aan een Preview-deployment. De hostingomgeving kan Preview of later Production heten, maar de applicatiemodus blijft **staging** zolang er uitsluitend testbestellingen worden verwerkt.

| Instelling | Waarde |
|---|---|
| `APP_ENV` | `staging` |
| `SUPABASE_URL` | HTTPS-URL van het nieuwe WM Studio-stagingproject |
| `SUPABASE_STAGING_PROJECT_REF` | Exact de projectref uit die URL |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key van hetzelfde stagingproject |
| `SUPABASE_SECRET_KEY` | Serverkey van hetzelfde stagingproject, als geheime Vercel-variabele |
| `APP_ORIGIN` | Alleen instellen bij een vaste HTTPS-staging-URL; laat weg voor wisselende Preview-URL's |

Geen serverkey krijgt een `NEXT_PUBLIC_`-prefix. Er zijn geen Mollie-, Sendcloud- of echte betalingsinstellingen nodig. Vercel krijgt de variabelen via de beveiligde projectinstellingen, nooit via GitHub, chat of een bronbestand. `.vercelignore` sluit lokale configuratie, back-ups, databases en testuitvoer uit bij een CLI-upload.

De app gebruikt Node.js 24.x. Na wijziging van omgevingsvariabelen is een nieuwe deployment nodig; een oude, onveranderlijke deployment-URL blijft de oude configuratie gebruiken. Deel daarom pas de geverifieerde nieuwe URL of een stabiele projectalias.

## Acceptatie vóór delen

Controleer op de nieuwe HTTPS-URL: homepage met producten, directe productpagina, cookiebeveiliging, inloggen/uitloggen, toegang per rol, productbeheer, expliciete demo-checkout, orderoverzicht en automatische releases. Controleer dat de secrets niet in clientbestanden of logs terechtkomen. De lokale acceptatieresultaten blijven relevant, maar vervangen deze online controles niet.

Dit maakt de testomgeving via Vercel bereikbaar. Echte betalingen, verzending, MFA-uitwerking, monitoring en verdere livegangvereisten blijven afzonderlijke werkzaamheden.

Referenties: [Vercel-omgevingsvariabelen](https://vercel.com/docs/environment-variables), [Node.js-versies](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) en [Supabase deployment-checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
