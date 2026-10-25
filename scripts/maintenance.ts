import { createClient } from "@supabase/supabase-js";
import { configuration } from "../src/lib/config";
const { url } = configuration();
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error("Serverkey ontbreekt.");
// For manual diagnostics only. Scheduled execution belongs to pg_cron in the database.
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc("maintenance_status");
if (error) throw new Error(error.message);
console.log(JSON.stringify(data));
