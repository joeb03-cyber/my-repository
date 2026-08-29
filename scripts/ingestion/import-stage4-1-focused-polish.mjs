import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Import is locked to the isolated staging Brain.");
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !key || !anonKey || !url.includes(expectedRef)) throw new Error("Staging credentials are not configured.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const namespace = "0d3c8542-ae4b-4317-a918-254462cbdf8b";
const currentNamespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const id = (value) => uuidv5(value, namespace);
const bookId = id("book:cosmos-and-psyche");
const authorId = id("person:richard tarnas");
const coverId = id("cover:cosmos-and-psyche:google-books:WjMaEAAAQBAJ");
const coverPath = "book-covers/cosmos-and-psyche.webp";

async function upsert(table, rows, options = {}) { const { error } = await db.from(table).upsert(rows, options); if (error) throw new Error(`${table}: ${error.message}`); }

const coverBytes = await readFile("public/book-covers/cosmos-and-psyche.webp");
const { error: uploadError } = await db.storage.from("brain-public-media").upload(coverPath, coverBytes, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
if (uploadError) throw uploadError;
await upsert("entities", [
  { id: bookId, kind: "book", slug: "cosmos-and-psyche", title: "Cosmos and Psyche", summary: "Intimations of a New World View", visibility: "public", lifecycle_state: "incomplete", editorial_state: "approved" },
  { id: authorId, kind: "person", slug: "person-richard-tarnas", title: "Richard Tarnas", summary: null, visibility: "public", lifecycle_state: "active", editorial_state: "approved" },
]);
await upsert("people", [{ entity_id: authorId, display_name: "Richard Tarnas", sort_name: "Tarnas", normalized_name: "richard tarnas", initials: "RT", contact_publication_state: "hidden" }]);
await upsert("media_assets", [{ id: coverId, kind: "book_cover", storage_path: coverPath, source_url: "https://books.google.com/books/content?id=WjMaEAAAQBAJ&printsec=frontcover&img=1&zoom=2&edge=curl&source=gbs_api", provider: "google_books", provider_identifier: "WjMaEAAAQBAJ", mime_type: "image/webp", byte_size: 32578, width: 300, height: 453, sha256: "0c9bb710acc5dae39ad7e7b2781c85f634595b86f00dac95818bdc5c37b86f30", confidence: 0.99, editorial_state: "approved", provenance: { metadataRecord: "https://books.google.com/books/about/Cosmos_and_Psyche.html?id=WjMaEAAAQBAJ", retrievedAt: "2026-08-29", cachedDerivativeFromProviderJpeg: true, noAmazonScrape: true } }]);
await upsert("books", [{ entity_id: bookId, source_position: 1000, original_title: "Cosmos and Psyche", original_author: "Richard Tarnas", subtitle: "Intimations of a New World View", isbn_10: "0452288592", isbn_13: "9780452288591", publisher: "Penguin Publishing Group", publication_date: "2007-04-24", language_code: "en", cover_asset_id: coverId, metadata_status: "catalog_matched", metadata_confidence: 0.99, metadata_provenance: { googleBooksId: "WjMaEAAAQBAJ", openLibraryEditionId: "OL7641249M", openLibraryWorkId: "OL3500788W", source: "Google Books and Open Library" }, import_state: "incomplete", imported_at: new Date().toISOString(), import_version: "stage4.1-current-reading" }]);
const { data: authoredBy, error: typeError } = await db.from("relationship_types").select("id").eq("key", "authored_by").single(); if (typeError) throw typeError;
await upsert("relationships", [{ id: id("authored-by:cosmos-and-psyche:richard-tarnas"), from_entity_id: bookId, relationship_type_id: authoredBy.id, to_entity_id: authorId, confidence: 1, rank: 1, context: { source: "catalog_metadata" }, editorial_state: "approved" }]);

const editorial = JSON.parse(await readFile("data/brain/editorial-updates/2026-08-28-stage17.v1.json", "utf8"));
const somatic = editorial.publicNotes.find((note) => note.slug === "somatic-inquiry-list");
const { error: noteError } = await db.from("brain_notes").update({ body_markdown: somatic.bodyMarkdown, provenance: { ...somatic.provenance, publicEditorialPromptsRemovedAt: "2026-08-29", fullPriorDraftPreservedPrivately: true } }).eq("entity_id", somatic.id); if (noteError) throw noteError;

const { data: source } = await db.from("travel_source_snapshots").select("id").order("captured_on", { ascending: false }).limit(1).single();
const sarajevoId = id("place:sarajevo:ba"), jajceId = "df9f8e37-0889-5d22-b129-b40815618a53";
await upsert("travel_places", [{ id: sarajevoId, slug: "sarajevo", source_name: "Sarajevo", name: "Sarajevo", place_type: "populated_place", country_code: "BA", country_name: "Bosnia and Herzegovina", latitude: 43.8563, longitude: 18.4131, coordinates_state: "editorial", visibility: "public", editorial_state: "approved", provenance: { authority: "Joe Burt", precision: "city", recordedAt: "2026-08-29" } }]);
await upsert("travel_visits", [
  { id: "7b65a195-9a9b-577f-add3-8358a87d80f4", source_snapshot_id: source.id, place_id: sarajevoId, visit_kind: "visit", source_position: 102, group_position: 1, chronology_index: 112, start_year: 2026, start_month: 8, end_year: 2026, end_month: 8, temporal_precision: "month", source_date_text: "August 2026", source_value: "Sarajevo", source_raw_line: "Joe flew Warsaw → Sarajevo, then traveled to Jajce", visibility: "public", editorial_state: "approved", provenance: { authority: "Joe Burt", exactDateNotAsserted: true } },
  { id: "323a7d12-5a8f-5ede-9047-8f6d5d6154e5", source_snapshot_id: source.id, place_id: jajceId, visit_kind: "visit", source_position: 103, group_position: 1, chronology_index: 113, start_year: 2026, start_month: 8, end_year: 2026, end_month: 8, temporal_precision: "month", source_date_text: "August 2026", source_value: "Jajce", source_raw_line: "Joe flew Warsaw → Sarajevo, then traveled to Jajce", visibility: "public", editorial_state: "approved", provenance: { authority: "Joe Burt", exactDateNotAsserted: true, distinctFromCurrentState: true } },
]);

const { data: current } = await db.from("current_state_snapshots").select("id,state,effective_at").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1).single();
const effectiveAt = "2026-08-29T12:00:00+02:00";
const snapshotId = uuidv5(`current-state:${effectiveAt}`, currentNamespace);
const state = { ...current.state, effectiveAt, lastConfirmedAt: effectiveAt, where: { ...current.state.where, city: "Jajce", country: "Bosnia and Herzegovina", timezone: "Europe/Sarajevo" }, reading: "Cosmos and Psyche" };
await upsert("current_state_snapshots", [{ id: snapshotId, effective_at: effectiveAt, last_confirmed_at: effectiveAt, publication_state: "published", state, provenance: { source: "joe_stage4.1_directive", priorSnapshotId: current.id } }]);
await upsert("current_state_entity_links", [{ snapshot_id: snapshotId, role: "reading", entity_id: bookId }], { onConflict: "snapshot_id,role" });
const { error: archiveError } = await db.from("current_state_snapshots").update({ publication_state: "archived" }).eq("publication_state", "published").neq("id", snapshotId); if (archiveError) throw archiveError;

const [bookCheck, noteCheck, stateCheck, visitsCheck] = await Promise.all([
  anon.from("brain_public_books").select("slug,title,cover_path,highlight_count").eq("slug", "cosmos-and-psyche").single(),
  anon.from("brain_public_notes").select("body_markdown").eq("slug", "somatic-inquiry-list").single(),
  anon.from("brain_public_current_state_reading").select("slug,title").eq("snapshot_id", snapshotId).single(),
  anon.from("brain_public_travel_visits").select("source_value,chronology_index").in("chronology_index", [112,113]).order("chronology_index"),
]);
for (const check of [bookCheck, noteCheck, stateCheck, visitsCheck]) if (check.error) throw check.error;
if (noteCheck.data.body_markdown.includes("Other things to explore")) throw new Error("Removed somatic section remains anonymously visible.");
console.log(JSON.stringify({ book: bookCheck.data, currentReading: stateCheck.data, recentVisits: visitsCheck.data, somaticSectionPublic: false }, null, 2));
