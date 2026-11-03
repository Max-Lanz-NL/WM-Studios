import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { configuration } from "../src/lib/config";
import { productSchema } from "../src/lib/model";
const file =
  process.argv.find((x) => x.endsWith(".json")) || "data/legacy-export.json";
const envelope = JSON.parse(readFileSync(file, "utf8"));
if (
  createHash("sha256")
    .update(JSON.stringify(envelope.payload))
    .digest("hex") !== envelope.digest
)
  throw new Error("Checksum klopt niet. Import afgebroken.");
const schema = z.object({
  formatVersion: z.literal(1),
  sourceId: z.string().min(1),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
const payload = schema.parse(envelope.payload);
for (const row of payload.tables.products || []) {
  const p = JSON.parse(String(row.body));
  productSchema.parse(p);
  z.string().uuid().parse(p.id);
}
console.log(
  `Importcontrole: ${(payload.tables.products || []).length} producten, ${(payload.tables.orders || []).length} orders. Checksum geldig.`,
);
if (!process.argv.includes("--apply")) {
  console.log(
    "Dry run: niets gewijzigd. Gebruik --apply uitsluitend op een lege lokale/stagingdatabase.",
  );
  process.exit(0);
}
const { url } = configuration();
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) throw new Error("Stel de serverkey veilig in .env.local in.");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc("import_legacy", {
  payload: envelope.payload,
  source_digest: envelope.digest,
});
if (error) throw new Error("Import mislukt: " + error.message);
console.log(JSON.stringify(data));
