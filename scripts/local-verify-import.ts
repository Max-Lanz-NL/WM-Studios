import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { localStatus } from "./local-config.mjs";
const local = localStatus();
const { payload, digest } = JSON.parse(
  readFileSync(process.argv[2] || "data/legacy-export.json", "utf8"),
);
assert.equal(
  createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  digest,
);
const client = createClient(local.url, local.secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
for (const row of payload.tables.products) {
  const expected = JSON.parse(row.body);
  const { data, error } = await client
    .from("catalog")
    .select("body")
    .eq("id", expected.id)
    .single();
  assert.equal(
    error,
    null,
    "Product kon niet worden gelezen via de lokale Data API",
  );
  assert(data, "Product ontbreekt in de lokale Data API");
  for (const key of Object.keys(expected)) {
    if (["releaseAt", "createdAt"].includes(key)) {
      assert.equal(
        expected[key] === null ? null : Date.parse(expected[key]),
        data.body[key] === null ? null : Date.parse(data.body[key]),
        "Tijdstip wijkt af: " + key,
      );
    } else
      assert.deepEqual(
        data.body[key],
        expected[key],
        "Productveld wijkt af: " + key,
      );
  }
}
const pool = new Pool({ connectionString: local.database });
try {
  const { rows } = await pool.query(
    "select digest,original from private.legacy_imports where source_id=$1",
    [payload.sourceId],
  );
  assert.equal(rows[0]?.digest, digest);
  assert.deepEqual(rows[0].original, payload);
  console.log(
    `Echte lokale Data API en PostgreSQL gecontroleerd: ${payload.tables.products.length} oorspronkelijke producten en het volledige bronarchief komen overeen.`,
  );
} finally {
  await pool.end();
}
