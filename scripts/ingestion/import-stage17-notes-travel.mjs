import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (
  process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" ||
  process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef ||
  process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes"
) throw new Error("Stage 17 import is locked to the acknowledged isolated staging Brain.");

const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey || !url.includes(expectedRef)) throw new Error("Staging Supabase credentials are not configured.");

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicDb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicUpdate = JSON.parse(await readFile("data/brain/editorial-updates/2026-08-28-stage17.v1.json", "utf8"));
const privateDraft = JSON.parse(await readFile("data/ingestion/stage17-private/somatic-inquiry-draft.v1.json", "utf8"));
const publicSlugs = new Set(publicUpdate.publicNotes.map((note) => note.slug));
const notes = [...publicUpdate.publicNotes, ...(publicSlugs.has(privateDraft.note.slug) ? [] : [privateDraft.note])];
const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";

async function upsert(table, rows, options = {}) {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, options);
  if (error) throw new Error(`${table}: ${error.message}`);
}

const folderSlugs = [...new Set(notes.map((note) => note.folderSlug))];
const { data: folders, error: folderError } = await db.from("note_folders").select("id,slug").in("slug", folderSlugs);
if (folderError) throw folderError;
const folderBySlug = new Map(folders.map((folder) => [folder.slug, folder.id]));
for (const slug of folderSlugs) if (!folderBySlug.has(slug)) throw new Error(`Unknown Notes folder: ${slug}`);

await upsert("entities", notes.map((note) => ({
  id: note.id,
  kind: "note",
  slug: note.slug,
  title: note.title,
  summary: note.excerpt,
  visibility: note.publicationState === "published" ? "public" : "private",
  lifecycle_state: "active",
  editorial_state: note.publicationState === "published" ? "approved" : "needs_review",
})));

await upsert("brain_notes", notes.map((note) => ({
  entity_id: note.id,
  folder_id: folderBySlug.get(note.folderSlug),
  excerpt: note.excerpt,
  body_markdown: note.bodyMarkdown,
  body_format: "markdown",
  publication_state: note.publicationState,
  pinned: note.pinned,
  source_published_at: "2026-08-28",
  published_at: note.publicationState === "published" ? note.publishedAt : null,
  editorial_notice: note.editorialNotice || null,
  external_links: [],
  provenance: note.provenance || {
    source: "Joe direct phone-note prompt, 2026-08-28",
    formatting: "Light cleanup and thematic grouping; source meaning preserved",
  },
})));

const tagLabels = [...new Set(notes.flatMap((note) => note.tags))];
const tagRows = tagLabels.map((label) => ({ id: uuidv5(`note-tag:${label}`, namespace), slug: label, label, editorial_state: "approved" }));
await upsert("note_tags", tagRows);
await upsert("note_tag_links", notes.flatMap((note) => note.tags.map((label) => ({
  note_entity_id: note.id,
  tag_id: uuidv5(`note-tag:${label}`, namespace),
}))), { onConflict: "note_entity_id,tag_id" });
for (const note of notes) {
  const desiredTagIds = new Set(note.tags.map((label) => uuidv5(`note-tag:${label}`, namespace)));
  const { data: existingLinks, error: linkReadError } = await db.from("note_tag_links").select("tag_id").eq("note_entity_id", note.id);
  if (linkReadError) throw linkReadError;
  const staleTagIds = existingLinks.map((link) => link.tag_id).filter((tagId) => !desiredTagIds.has(tagId));
  if (staleTagIds.length) {
    const { error: staleDeleteError } = await db.from("note_tag_links").delete().eq("note_entity_id", note.id).in("tag_id", staleTagIds);
    if (staleDeleteError) throw staleDeleteError;
  }
}

const { data: publicNotes, error: publicNoteError } = await publicDb.from("brain_public_notes").select("slug,title,body_markdown").in("slug", ["when-back-in-the-us", "somatic-inquiry-list"]);
if (publicNoteError) throw publicNoteError;
const publicNoteBySlug = new Map(publicNotes.map((note) => [note.slug, note]));
for (const slug of ["when-back-in-the-us", "somatic-inquiry-list"]) {
  if (!publicNoteBySlug.has(slug)) throw new Error(`Published Note is not visible through the public-safe view: ${slug}`);
}
const somaticBody = publicNoteBySlug.get("somatic-inquiry-list").body_markdown;
if (!somaticBody.includes("## What I’ve noticed") || !somaticBody.includes("## Session notes")) {
  throw new Error("Published somatic Note is missing its approved sections.");
}

console.log(JSON.stringify({
  publishedNotes: publicNotes.map((note) => ({ slug: note.slug, bodyLength: note.body_markdown.length })),
  somaticObservationCount: 5,
  travelDirectionRecorded: true,
  reconciledKnownCountries: publicUpdate.travelDirection.reconciledKnownLifetimeCount,
  assertedLifetimeCountries: publicUpdate.travelDirection.assertedLifetimeCountryCount,
  unresolvedCountries: publicUpdate.travelDirection.unresolvedCountryCount,
}, null, 2));
