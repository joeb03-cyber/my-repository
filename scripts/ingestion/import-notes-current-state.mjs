import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { v5 as uuidv5 } from "uuid";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing import: this milestone is staging-only.");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required server-side.");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i)?.[1];
if (!projectRef || process.env.BRAIN_IMPORT_PROJECT_REF !== projectRef) throw new Error("Refusing import: target URL and BRAIN_IMPORT_PROJECT_REF must match exactly.");
if (process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Refusing import without explicit non-production acknowledgement.");

const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const index = JSON.parse(await readFile("data/brain/notes/index.v1.json", "utf8"));
const drafts = JSON.parse(await readFile("data/brain/notes/drafts.v1.json", "utf8"));
const current = JSON.parse(await readFile("data/brain/current-state.v1.json", "utf8"));
const notes = [...index.notes, ...drafts];
const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const folderBySlug = new Map(index.folders.map((folder) => [folder.slug, folder]));

async function upsert(table, rows, options) {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, options);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length} rows upserted`);
}

await upsert("note_folders", index.folders.map((folder) => ({
  id: folder.id, slug: folder.slug, label: folder.label, sort_order: folder.sortOrder,
  visibility: "public", editorial_state: "approved",
})));
await upsert("entities", notes.map((item) => ({
  id: item.id, kind: "note", slug: item.slug, title: item.title, summary: item.excerpt,
  visibility: item.publicationState === "published" ? "public" : "private",
  lifecycle_state: "active", editorial_state: item.publicationState === "published" ? "approved" : "needs_review",
})));
await upsert("brain_notes", notes.map((item) => ({
  entity_id: item.id,
  folder_id: folderBySlug.get(item.folderSlug)?.id || null,
  excerpt: item.excerpt,
  body_markdown: item.bodyMarkdown,
  body_format: "markdown",
  publication_state: item.publicationState,
  pinned: item.pinned,
  source_published_at: item.sourcePublishedAt,
  published_at: item.publishedAt,
  editorial_notice: item.editorialNotice,
  external_links: item.externalLinks || [],
  provenance: item.provenance || {
    sourceUrl: "https://www.synergetichuman.com/",
    sourceTitle: item.title,
    capturedAt: "2026-08-27",
    originalSourcePreserved: true,
  },
})));

const tagLabels = [...new Set(notes.flatMap((item) => item.tags || []))];
const tags = tagLabels.map((label) => ({ id: uuidv5(`note-tag:${label}`, namespace), slug: label, label, editorial_state: "approved" }));
await upsert("note_tags", tags);
await upsert("note_tag_links", notes.flatMap((item) => (item.tags || []).map((label) => ({
  note_entity_id: item.id,
  tag_id: uuidv5(`note-tag:${label}`, namespace),
}))), { onConflict: "note_entity_id,tag_id" });
await upsert("current_state_snapshots", [{
  id: uuidv5(`current-state:${current.effectiveAt}`, namespace),
  effective_at: current.effectiveAt,
  last_confirmed_at: current.lastConfirmedAt,
  publication_state: "published",
  state: current,
  provenance: { source: "manual_stage_11", confirmedFields: ["where", "making"], unreportedFieldsRemainNull: true },
}]);
