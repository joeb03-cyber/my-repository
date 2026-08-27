import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const namespace = "bd2c691d-2016-44d2-8307-7bc65f9dc102";
const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Stage 14 import is locked to the acknowledged staging Brain.");
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !url.includes(expectedRef)) throw new Error("The staging service connection is not configured.");
const db = createClient(url, key, { auth: { persistSession: false } });
const source = JSON.parse(await readFile(new URL("../../data/brain/human.v1.json", import.meta.url), "utf8"));

const rows = source.entries.map((entry) => ({
  id: uuidv5(`human:${entry.slug}`, namespace), slug: entry.slug, section: entry.section,
  relationship_state: entry.relationshipState, entry_type: entry.entryType, title: entry.title,
  summary: entry.summary, current_take: entry.currentTake, supporting_details: entry.supportingDetails,
  publication_state: "published", visibility: "public", editorial_state: "approved", sort_order: entry.sortOrder,
  provenance: { source: "stage14_current_editorial_direction", historical_support: "private_project_discovery" },
}));
const { error: upsertError } = await db.from("human_entries").upsert(rows, { onConflict: "id" });
if (upsertError) throw upsertError;
const ids = rows.map((row) => row.id);
const { error: archiveError } = await db.from("human_entries").update({ publication_state: "archived", visibility: "private" }).not("id", "in", `(${ids.join(",")})`);
if (archiveError) throw archiveError;
const { error: clearError } = await db.from("human_entry_entity_links").delete().in("human_entry_id", ids);
if (clearError) throw clearError;
const linkRows = [];
for (const entry of source.entries) {
  for (const relationship of entry.relationships || []) {
    const { data: entity, error } = await db.from("entities").select("id").eq("slug", relationship.entitySlug).maybeSingle();
    if (error) throw error;
    if (!entity) { console.warn(`Relationship unresolved: ${relationship.entitySlug}`); continue; }
    linkRows.push({ human_entry_id: uuidv5(`human:${entry.slug}`, namespace), entity_id: entity.id, relationship_label: relationship.label, sort_order: linkRows.length * 10 + 10, provenance: { source: "stage14_editorial_seed" } });
  }
}
if (linkRows.length) { const { error } = await db.from("human_entry_entity_links").insert(linkRows); if (error) throw error; }

const trashCandidates = [
  { key: "technique-collecting", title: "Technique Collecting", description: "Learning one more method instead of doing the few things that already work." },
  { key: "perfect-plans", title: "Perfect Plans", description: "Making a perfect plan, then not following it." },
].map((item, index) => ({ id: uuidv5(`stage14:trash:${item.key}`, namespace), title: item.title, description: item.description, category: "habits", trashed_at: "2026-08-27", state: "trashed", visibility: "public", sort_order: 900 + index * 10 }));
const { error: trashError } = await db.from("os_trash_records").upsert(trashCandidates, { onConflict: "id" });
if (trashError) throw trashError;
console.log(JSON.stringify({ humanEntries: rows.length, publicEntries: rows.length, relationships: linkRows.length, publishedTrash: trashCandidates.length }, null, 2));
