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
const notes = [...publicUpdate.publicNotes, privateDraft.note];
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

const { data: publicNote, error: publicNoteError } = await publicDb.from("brain_public_notes").select("slug,title,body_markdown").eq("slug", "when-back-in-the-us").maybeSingle();
if (publicNoteError || !publicNote) throw publicNoteError || new Error("Published Note is not visible through the public-safe view.");
const { data: leakedDraft, error: leakedDraftError } = await publicDb.from("brain_public_notes").select("slug").eq("slug", "somatic-inquiry-list");
if (leakedDraftError) throw leakedDraftError;
if (leakedDraft?.length) throw new Error("Protected somatic-inquiry draft leaked through the public view.");

console.log(JSON.stringify({
  publishedNote: publicNote.slug,
  publishedBodyLength: publicNote.body_markdown.length,
  protectedDraft: "somatic-inquiry-list",
  anonymousDraftExposure: false,
  travelDirectionRecorded: true,
  reconciledKnownCountries: publicUpdate.travelDirection.reconciledKnownLifetimeCount,
  assertedLifetimeCountries: publicUpdate.travelDirection.assertedLifetimeCountryCount,
  unresolvedCountries: publicUpdate.travelDirection.unresolvedCountryCount,
}, null, 2));
