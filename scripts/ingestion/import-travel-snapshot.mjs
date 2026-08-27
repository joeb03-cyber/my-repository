import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

if (!new Set(["development", "staging"]).has(process.env.BRAIN_IMPORT_ENVIRONMENT)) throw new Error("Refusing import: BRAIN_IMPORT_ENVIRONMENT must be development or staging.");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required server-side.");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
if (!projectRef || process.env.BRAIN_IMPORT_PROJECT_REF !== projectRef) throw new Error("Refusing import: target URL and BRAIN_IMPORT_PROJECT_REF must match exactly.");
if (process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Refusing import without explicit non-production acknowledgement.");

const root = process.argv[2] || "data/brain/travel/import-v1";
const tables = ["travel_source_snapshots", "travel_places", "travel_visits", "travel_movements"];
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
for (const table of tables) {
  const text = await readFile(path.join(root, `${table}.jsonl`), "utf8");
  const records = text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
  for (let offset = 0; offset < records.length; offset += 250) {
    const { error } = await client.from(table).upsert(records.slice(offset, offset + 250));
    if (error) throw new Error(`${table} batch ${offset}: ${error.message}`);
  }
  console.log(`${table}: ${records.length} rows upserted`);
}
