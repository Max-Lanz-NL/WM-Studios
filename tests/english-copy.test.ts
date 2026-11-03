import { expect, it } from "vitest";
import { englishCopy, englishDatabaseMessage } from "../src/lib/english-copy";

it("translates imported demo copy without overwriting custom content", () => {
  expect(
    englishCopy(
      "Een onafhankelijke kijk op de garderobe van morgen. Ontdek de eerste editie van Studio MW.",
    ),
  ).toContain("Discover the first edition of Studio MW.");
  expect(englishCopy("Our new winter collection")).toBe(
    "Our new winter collection",
  );
});

it("shows stock and concurrent edit errors in English", () => {
  expect(englishDatabaseMessage("Onvoldoende voorraad")).toContain(
    "not enough stock",
  );
  expect(
    englishDatabaseMessage("Product is gewijzigd. Herlaad de pagina."),
  ).toContain("Reload");
});

it("preserves auth error codes and hides unknown database messages", () => {
  expect(englishDatabaseMessage("UNAUTHORIZED")).toBe("UNAUTHORIZED");
  expect(englishDatabaseMessage("FORBIDDEN")).toBe("FORBIDDEN");
  expect(englishDatabaseMessage("internal unexpected error")).toBe(
    "Unable to complete this request. Please try again.",
  );
});
