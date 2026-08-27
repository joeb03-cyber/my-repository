import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing import: this pilot is staging-only.");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required server-side.");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
if (!projectRef || process.env.BRAIN_IMPORT_PROJECT_REF !== projectRef) throw new Error("Refusing import: target URL and BRAIN_IMPORT_PROJECT_REF must match exactly.");
if (process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Refusing import without explicit non-production acknowledgement.");

const root = process.argv[2] || "data/brain/people-sources/import-editorial-pilot-v1";
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const imports = [
  ["person_entities.jsonl", "entities"],
  ["topic_entities.jsonl", "entities"],
  ["topics.jsonl", "topics"],
  ["media_assets.jsonl", "media_assets"],
  ["people.jsonl", "people"],
  ["editorial_assertions.jsonl", "editorial_assertions"],
  ["relationships.jsonl", "relationships"],
  ["editorial_source_candidates.jsonl", "editorial_source_candidates"],
];

for (const [file, table] of imports) {
  const text = await readFile(path.join(root, file), "utf8");
  const rows = text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
  if (rows.length) {
    const { error } = await client.from(table).upsert(rows);
    if (error) throw new Error(`${file} -> ${table}: ${error.message}`);
  }
  console.log(`${file}: ${rows.length} rows upserted into ${table}`);
}
