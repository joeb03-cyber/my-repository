import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { v5 as uuidv5 } from "uuid";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing import outside staging.");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Staging Supabase environment is required.");
const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== process.env.BRAIN_IMPORT_PROJECT_REF || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Staging guard failed.");

const state = JSON.parse(await readFile("data/brain/os-state.v1.json", "utf8"));
const client = createClient(url, key, { auth: { persistSession: false } });
const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";

const { error: updateError } = await client.from("software_update_snapshots").upsert({
  id: uuidv5("software-update:stage-12", namespace),
  version_label: state.softwareUpdate.versionLabel,
  new_items: state.softwareUpdate.new,
  exploring_items: state.softwareUpdate.currentlyExploring,
  performance_items: state.softwareUpdate.performance,
  known_issue_items: state.softwareUpdate.knownIssues,
  publication_state: "published",
  effective_at: "2026-08-28T14:00:00+02:00",
});
if (updateError) throw new Error(`software_update_snapshots: ${updateError.message}`);

const { error: trashError } = await client.from("os_trash_records").upsert(state.trash.map((item, index) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  category: item.category,
  trashed_at: item.trashedAt,
  state: "trashed",
  visibility: "public",
  sort_order: (index + 1) * 10,
})));
if (trashError) throw new Error(`os_trash_records: ${trashError.message}`);
console.log(`software updates: 1; trash records: ${state.trash.length}`);
