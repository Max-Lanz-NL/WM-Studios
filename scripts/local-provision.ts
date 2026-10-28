import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { localStatus, saveLocalEnvironment } from "./local-config.mjs";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const local = localStatus();
const previous = existsSync(".env.local")
  ? parseEnv(readFileSync(".env.local", "utf8"))
  : {};
const client = createClient(local.url, local.secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const entries: Record<string, string> = {
  APP_ENV: "local",
  APP_ORIGIN: "http://127.0.0.1:3000",
  SUPABASE_URL: local.url,
  SUPABASE_PUBLISHABLE_KEY: local.publishable,
  SUPABASE_SECRET_KEY: local.secret,
  WM_TEST_DATABASE_URL: local.database,
  WM_ALLOW_TEST_WRITES: "yes",
};
for (const [name, email] of [
  ["MAX", "max@wm-studio.test"],
  ["WILLEMIJN", "willemijn@wm-studio.test"],
]) {
  const password =
    previous[`LOCAL_${name}_PASSWORD`] || randomBytes(24).toString("base64url");
  let account: string | undefined;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw new Error("Lokale Auth is niet bereikbaar.");
    account = data.users.find((u) => u.email === email)?.id;
    if (account || data.users.length < 100) break;
  }
  if (!account) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error("Lokaal testaccount kon niet worden aangemaakt.");
    account = data.user.id;
  } else {
    const { error } = await client.auth.admin.updateUserById(account, {
      password,
      email_confirm: true,
    });
    if (error)
      throw new Error("Lokaal testwachtwoord kon niet worden ingesteld.");
  }
  const { error } = await client.from("staff_members").upsert({
    user_id: account,
    role: "owner",
    active: true,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Lokale roltoekenning mislukt: " + error.message);
  entries[`LOCAL_${name}_EMAIL`] = email;
  entries[`LOCAL_${name}_PASSWORD`] = password;
}
saveLocalEnvironment(entries);
console.log(
  "Lokale Supabase-verbinding en twee afzonderlijke eigenaaraccounts ingesteld. Aanmeldgegevens staan alleen in .env.local; de eerdere configuratie is bewaard in data.",
);
