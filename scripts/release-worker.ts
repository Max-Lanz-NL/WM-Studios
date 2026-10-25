import { publishDue } from "../src/lib/db";
if (process.env.APP_MODE !== "demo")
  throw new Error("Deze worker is uitsluitend voor de lokale demo.");
function tick() {
  try {
    const count = publishDue();
    if (count)
      console.log(
        `${new Date().toISOString()}: ${count} release(s) gepubliceerd.`,
      );
  } catch {
    console.error(
      "Releasecontrole mislukt; de volgende cyclus probeert opnieuw.",
    );
  }
}
tick();
const timer = setInterval(tick, 15000);
console.log(
  "Lokale releaseworker actief. Controle elke 15 seconden; Ctrl+C om te stoppen.",
);
process.on("SIGINT", () => {
  clearInterval(timer);
  process.exit(0);
});
process.on("SIGTERM", () => {
  clearInterval(timer);
  process.exit(0);
});
