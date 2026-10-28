import { existsSync, copyFileSync } from "node:fs";
if (!existsSync(".env.local")) copyFileSync(".env.example", ".env.local");
console.log(
  "Vul .env.local met de instellingen van een apart Supabase-testproject. Zie docs/DEPLOYMENT.md.",
);
