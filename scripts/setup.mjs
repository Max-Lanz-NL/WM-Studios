import { existsSync, copyFileSync } from "node:fs";
if (existsSync(".env.local")) {
  console.log(".env.local bestaat al; niets gewijzigd.");
  process.exit(0);
}
copyFileSync(".env.example", ".env.local");
console.log(
  "Configuratiesjabloon aangemaakt. Vul de Supabase-testsleutels veilig in .env.local in. Er is geen gedeeld beheerwachtwoord meer.",
);
