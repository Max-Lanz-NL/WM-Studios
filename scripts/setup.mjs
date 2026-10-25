import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env.local")) {
  console.log(".env.local bestaat al; niets gewijzigd.");
  process.exit(0);
}
const password = randomBytes(18).toString("base64url");
writeFileSync(
  ".env.local",
  `APP_MODE=demo\nADMIN_PASSWORD=${password}\nSESSION_SECRET=${randomBytes(48).toString("hex")}\nDATABASE_PATH=./data/wm-demo.sqlite\n`,
  { mode: 0o600 },
);
console.log(
  "Lokale demo geconfigureerd. Je beheerwachtwoord staat in .env.local (ADMIN_PASSWORD).",
);
