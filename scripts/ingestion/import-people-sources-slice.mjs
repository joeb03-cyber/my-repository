import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing import: this slice is staging-only.");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required server-side.");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
if (!projectRef || process.env.BRAIN_IMPORT_PROJECT_REF !== projectRef) throw new Error("Refusing import: target URL and BRAIN_IMPORT_PROJECT_REF must match exactly.");
if (process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Refusing import without explicit non-production acknowledgement.");

const root = process.argv[2] || "data/brain/people-sources/import-v1";
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const imports = [
  ["new_entities.jsonl", "entities"],
  ["people.jsonl", "people"],
  ["person_aliases.jsonl", "person_aliases"],
  ["source_shows.jsonl", "sources"],
  ["source_episodes.jsonl", "sources"],
  ["source_people.jsonl", "source_people"],
  ["editorial_assertions.jsonl", "editorial_assertions"],
  ["relationships.jsonl", "relationships"],
];

for (const [file, table] of imports) {
  const text = await readFile(path.join(root, file), "utf8");
  const rows = text.trim() ? text.trim().split("\n").map(JSON.parse) : [];
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { error } = await client.from(table).upsert(rows.slice(offset, offset + 200));
    if (error) throw new Error(`${file} -> ${table} batch ${offset}: ${error.message}`);
  }
  console.log(`${file}: ${rows.length} rows upserted into ${table}`);
}
