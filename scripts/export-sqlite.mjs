// One-time migration utility only. Application code never imports node:sqlite.
import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
const source = resolve(process.argv[2] || "data/wm-demo.sqlite");
const output = resolve(process.argv[3] || "data/legacy-export.json");
if (!existsSync(source)) throw new Error("SQLite-bron niet gevonden.");
if (existsSync(output) || existsSync(output + ".backup.sqlite"))
  throw new Error(
    "Export of back-up bestaat al. Kies een nieuwe bestandsnaam.",
  );
mkdirSync(dirname(output), { recursive: true });
const sourceDb = new DatabaseSync(source, { readOnly: true });
await backup(sourceDb, output + ".backup.sqlite");
sourceDb.close();
// Export the backup itself, so backup and JSON describe the exact same snapshot.
const db = new DatabaseSync(output + ".backup.sqlite", { readOnly: true });
db.exec("BEGIN");
try {
  const tables = {};
  const names = db
    .prepare(
      "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name",
    )
    .all();
  for (const { name } of names) {
    tables[name] = db
      .prepare(
        'select * from "' + name.replaceAll('"', '""') + '" order by rowid',
      )
      .all();
  }
  const payload = {
    formatVersion: 1,
    sourceId: process.argv[4] || "wm-local-demo-v1",
    tables,
  };
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  writeFileSync(output, JSON.stringify({ digest, payload }, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  db.exec("COMMIT");
  console.log(
    "Export en consistente SQLite-back-up opgeslagen. Aantallen: " +
      Object.entries(tables)
        .map(([k, v]) => `${k}=${v.length}`)
        .join(", "),
  );
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
} finally {
  db.close();
}
