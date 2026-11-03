import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync } from "node:fs";
import { localStatus } from "./local-config.mjs";
mkdirSync("data", { recursive: true });
const log = openSync("data/local-supabase-start.log", "w", 0o600);
console.log(
  "WM Studio-kernstack wordt lokaal gestart. Containeruitvoer blijft in data/local-supabase-start.log.",
);
const child = spawn(
  process.execPath,
  [
    "node_modules/supabase/dist/supabase.js",
    "start",
    "--exclude",
    "realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
  ],
  { stdio: ["ignore", log, log] },
);
child.on("error", () => {
  closeSync(log);
  console.error("Lokale Supabase-CLI kon niet starten.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  closeSync(log);
  if (code !== 0) {
    console.error(
      "Supabase startte niet volledig. Controleer het lokale logbestand.",
    );
    process.exitCode = code || 1;
    return;
  }
  try {
    localStatus();
    console.log(
      "Lokale WM Studio-database, Auth en Data API beschikbaar op poorten 55321/55322.",
    );
  } catch {
    console.error(
      "De stack is onvolledig. Stop uitsluitend WM Studio met npm run local:stop en start opnieuw.",
    );
    process.exitCode = 1;
  }
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
