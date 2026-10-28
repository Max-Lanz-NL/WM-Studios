import { database, required } from "../src/lib/supabase";
import { demoProducts } from "./fixtures";
if (
  process.env.DEPLOYMENT_ENV !== "staging" ||
  process.env.SEED_CONFIRM_PROJECT_URL !== required("SUPABASE_URL")
)
  throw new Error(
    "Seed vereist staging en SEED_CONFIRM_PROJECT_URL gelijk aan SUPABASE_URL",
  );
const client = database(true);
const { count, error } = await client
  .from("wm_products")
  .select("id", { count: "exact", head: true });
if (error || count !== 0)
  throw new Error("Seed gestopt: catalogus moet leeg en bereikbaar zijn");
// Single transaction; never overwrite an existing catalog.
const { error: failure } = await client.rpc("wm_seed", {
  catalog: demoProducts(),
});
if (failure)
  throw new Error("Seed mislukt; controleer migraties en doelproject");
console.log(
  "Zes testproducten toegevoegd. Test-checkout blijft standaard uitgeschakeld.",
);
