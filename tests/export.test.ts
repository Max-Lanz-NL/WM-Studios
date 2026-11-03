import { it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
it("exporteert exact de back-upsnapshot en wijzigt de bron niet", () => {
  const dir = mkdtempSync(join(tmpdir(), "wm-export-")),
    source = join(dir, "source.sqlite"),
    output = join(dir, "export.json");
  const db = new DatabaseSync(source);
  db.exec(
    "create table products(id text,body text);insert into products values('original','{\"name\":\"Legacy\"}')",
  );
  db.close();
  execFileSync(
    process.execPath,
    ["scripts/export-sqlite.mjs", source, output, "test-export"],
    { stdio: "pipe" },
  );
  const { payload, digest } = JSON.parse(readFileSync(output, "utf8"));
  expect(digest).toBe(
    createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  );
  const original = new DatabaseSync(source, { readOnly: true }),
    backup = new DatabaseSync(output + ".backup.sqlite", { readOnly: true });
  try {
    expect(original.prepare("select * from products").all()).toEqual(
      backup.prepare("select * from products").all(),
    );
    expect(payload.tables.products).toEqual(
      JSON.parse(
        JSON.stringify(original.prepare("select * from products").all()),
      ),
    );
  } finally {
    original.close();
    backup.close();
  }
  expect(() =>
    execFileSync(
      process.execPath,
      ["scripts/export-sqlite.mjs", source, output],
      { stdio: "pipe" },
    ),
  ).toThrow();
});
