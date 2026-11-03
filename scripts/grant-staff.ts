import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { configuration } from "../src/lib/config";
const { url } = configuration();
const id = z.string().uuid().parse(process.env.STAFF_USER_ID);
const role = z
  .enum(["owner", "admin", "designer", "warehouse", "support"])
  .parse(process.env.STAFF_ROLE);
if (!process.argv.includes("--apply")) {
  console.log(
    `Dry run: bestaand Auth-account krijgt de rol ${role}. Voeg --apply toe om dit in test/staging uit te voeren.`,
  );
  process.exit(0);
}
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error("Serverkey ontbreekt.");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error: authError } = await client.auth.admin.getUserById(id);
if (authError || !data.user)
  throw new Error("Auth-account bestaat niet in dit project.");
const { error } = await client.from("staff_members").upsert({
  user_id: id,
  role,
  active: true,
  updated_at: new Date().toISOString(),
});
if (error) throw new Error(error.message);
console.log(`Medewerkerstoegang ingesteld: ${role}. Geen e-mail verstuurd.`);
