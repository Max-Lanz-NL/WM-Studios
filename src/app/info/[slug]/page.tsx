import Link from "next/link";
import { notFound } from "next/navigation";
const pages: Record<string, { title: string; text: string }> = {
  shipping: {
    title: "Verzending & retouren",
    text: "Deze ontwikkelomgeving verwerkt uitsluitend fictieve bestellingen. Verzendzones, tarieven, levertijden en het retourbeleid moeten vóór livegang worden geconfigureerd en gecontroleerd. Er vindt geen fysieke verzending plaats.",
  },
  contact: {
    title: "Contact",
    text: "WM Studio Collective wordt opgericht door Willemijn en Max. Het zakelijke contactadres, KvK-nummer, btw-nummer en vestigingsadres zijn nog niet aangeleverd. Deze gegevens worden vóór livegang toegevoegd.",
  },
  privacy: {
    title: "Privacy & cookies — concept",
    text: "Deze demo bewaart je winkelmand en favorieten lokaal in je browser. Een strikt noodzakelijke cookie beveiligt de beheersessie. Er worden geen marketingcookies geplaatst. Productafbeeldingen worden van Unsplash geladen; daarbij maakt je browser verbinding met die externe dienst. Testorders en wachtlijsten worden lokaal opgeslagen. Gebruik fictieve gegevens. Een definitieve privacyverklaring met bewaartermijnen en contactgegevens moet vóór livegang worden opgesteld.",
  },
  terms: {
    title: "Algemene voorwaarden — concept",
    text: "Deze tekst is geen definitief juridisch document. De winkel is uitsluitend een ontwikkelomgeving. Er kunnen geen echte koopovereenkomsten worden gesloten. Algemene voorwaarden, consumentenrechten, herroepingsinformatie en bedrijfsgegevens moeten vóór livegang worden vastgesteld en juridisch gecontroleerd.",
  },
};
export default async function Info({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const p = pages[(await params).slug];
  if (!p) notFound();
  return (
    <main className="info-page">
      <Link className="wordmark" href="/">
        WM STUDIO COLLECTIVE
      </Link>
      <p className="eyebrow">CLIENT SERVICES / CONCEPT</p>
      <h1>{p.title}</h1>
      <p>{p.text}</p>
      <Link className="button dark" href="/">
        Terug naar de studio ↗
      </Link>
    </main>
  );
}
