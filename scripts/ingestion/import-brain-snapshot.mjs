import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

if (!new Set(["development", "staging"]).has(process.env.BRAIN_IMPORT_ENVIRONMENT)) {
  throw new Error("Refusing import: BRAIN_IMPORT_ENVIRONMENT must be development or staging.");
}
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required server-side.");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
if (!projectRef) throw new Error("Refusing import: SUPABASE_URL is not a recognizable hosted Supabase project URL.");
if (process.env.BRAIN_IMPORT_PROJECT_REF !== projectRef) throw new Error("Refusing import: BRAIN_IMPORT_PROJECT_REF must exactly match the target URL project ref.");
if (process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Refusing import: explicitly acknowledge that the matched project ref is non-production.");

const root = process.argv[2] || "data/brain/import-v1";
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const tables = ["entities", "people", "media_assets", "books", "topics", "relationship_types", "relationships", "sources", "source_versions", "source_fragments", "highlights", "passage_groups", "passage_group_members", "external_links", "provenance_links", "ingestion_runs", "ingestion_issues"];

for (const table of tables) {
  const text = await readFile(path.join(root, `${table}.jsonl`), "utf8");
  const rows = text.trim() ? text.trim().split("\n").map((line) => JSON.parse(line)) : [];
  for (let offset = 0; offset < rows.length; offset += 250) {
    const { error } = await client.from(table).upsert(rows.slice(offset, offset + 250));
    if (error) throw new Error(`${table} batch ${offset}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length} rows upserted`);
}
