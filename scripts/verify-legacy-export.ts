// Local verification tool: PGlite runs the actual migrations, with a minimal Auth fixture.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { database, asRole } from "../tests/helpers/database";
const { payload, digest } = JSON.parse(
  readFileSync(process.argv[2] || "data/legacy-export.json", "utf8"),
);
if (
  createHash("sha256").update(JSON.stringify(payload)).digest("hex") !== digest
)
  throw new Error("Checksum ongeldig");
const db = await database();
try {
  const result = await asRole(
    db,
    "service_role",
    null,
    "select public.import_legacy($1,$2) result",
    [JSON.stringify(payload), digest],
  );
  const normalized = await db.query<{ body: Record<string, unknown> }>(
    "select body from catalog",
  );
  for (const row of payload.tables.products) {
    const p = JSON.parse(row.body),
      actual = normalized.rows.find((r) => r.body.id === p.id)?.body;
    if (!actual) throw new Error("Ontbrekend product");
    for (const key of ["releaseAt", "createdAt"]) {
      const before = p[key],
        after = actual[key];
      if (before === null && after === null) continue;
      if (Date.parse(String(before)) !== Date.parse(String(after)))
        throw new Error("Afwijkend tijdstip: " + key);
    }
    for (const key of [
      "id",
      "name",
      "slug",
      "brand",
      "category",
      "gender",
      "description",
      "price",
      "status",
      "image",
      "variants",
    ])
      if (
        JSON.stringify(actual[key]) !== JSON.stringify(p[key]) &&
        key !== "variants"
      )
        throw new Error("Afwijkend veld: " + key);
    if (JSON.stringify(actual.variants) !== JSON.stringify(p.variants)) {
      const expected = p.variants,
        variants = actual.variants as Record<string, unknown>[];
      if (
        expected.length !== variants.length ||
        expected.some((v: Record<string, unknown>, i: number) =>
          Object.keys(v).some((k) => v[k] !== variants[i][k]),
        )
      )
        throw new Error("Variantgegevens wijken af");
    }
  }
  console.log(
    "Alle productvelden en variantvoorraden gecontroleerd. " +
      JSON.stringify(result),
  );
} finally {
  await db.close();
}
