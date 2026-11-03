/** Translate only known imported demo copy; preserve custom editorial content. */
const legacyCopy: Record<string, string> = {
  "Een onafhankelijke kijk op de garderobe van morgen. Ontdek de eerste editie van Studio MW.":
    "An independent perspective on tomorrow's wardrobe. Discover the first edition of Studio MW.",
  "Een doordacht silhouet voor je dagelijkse ritme. Een veelzijdige basis met een ontspannen pasvorm en verfijnde details. Dit is fictieve productinformatie voor de ontwikkelomgeving.":
    "A considered silhouette for your daily rhythm. A versatile essential with a relaxed fit and refined details. This is fictional product information for the test store.",
};

export function englishCopy(text: string) {
  return legacyCopy[text.trim().replace(/\s+/g, " ")] ?? text;
}

const databaseMessages: Record<string, string> = {
  "Ongeldige varianten": "Invalid variants.",
  "Product is gewijzigd. Herlaad de pagina.":
    "This product has changed. Reload the page before saving.",
  "Variant heeft actieve reserveringen":
    "This variant has active reservations.",
  "Een SKU is al in gebruik": "A SKU is already in use.",
  "Ongeldige inhoud": "Invalid content.",
  "Ongeldige statusovergang": "This status change is not allowed.",
  "Onbekende actie": "Unknown action.",
  "Alleen staging toegestaan": "Only the test environment is allowed.",
  "Ongeldige winkelmand": "Invalid shopping bag.",
  "Dubbele variant": "A variant appears more than once in your bag.",
  "Idempotentiesleutel hoort bij een andere bestelling":
    "This checkout reference belongs to a different order. Refresh your bag and try again.",
  "Ongeldig aantal": "Invalid quantity.",
  "Dit product is nog niet beschikbaar": "This product is not available yet.",
  "Onvoldoende voorraad":
    "There is not enough stock. Update your bag and try again.",
  "Ongeldige betaalstatus": "Invalid payment status.",
  "Order niet gevonden": "Order not found.",
  "Release niet gevonden": "Release not found.",
};

export function englishDatabaseMessage(message: string) {
  if (message === "UNAUTHORIZED" || message === "FORBIDDEN") return message;
  return (
    databaseMessages[message] ??
    "Unable to complete this request. Please try again."
  );
}
