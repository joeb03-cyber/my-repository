import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { readFile } from "node:fs/promises";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Import is locked to the isolated staging Brain.");
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !key || !anonKey || !url.includes(expectedRef)) throw new Error("Staging credentials are not configured.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const namespace = "0d3c8542-ae4b-4317-a918-254462cbdf8b";
const id = (value) => uuidv5(value, namespace);
const bookId = id("book:rejection-proof:jia-jiang");
const authorId = id("person:jia jiang");
const coverId = id("cover:rejection-proof:google-books:NBCPEAAAQBAJ");
const coverPath = "book-covers/control-center/rejection-proof.webp";
const coverUrl = "https://books.google.com/books/content?id=NBCPEAAAQBAJ&printsec=frontcover&img=1&zoom=2&edge=curl&source=gbs_api";

const coverBytes = await readFile("public/book-covers/rejection-proof.webp");
const { error: uploadError } = await db.storage.from("brain-public-media").upload(coverPath, coverBytes, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
if (uploadError) throw uploadError;

const [{ data: existingBook, error: existingBookError }, { data: lastBook, error: lastBookError }] = await Promise.all([
  db.from("books").select("source_position").eq("entity_id", bookId).maybeSingle(),
  db.from("books").select("source_position").order("source_position", { ascending: false }).limit(1).maybeSingle(),
]);
if (existingBookError) throw existingBookError;
if (lastBookError) throw lastBookError;
const sourcePosition = Number(existingBook?.source_position || (Number(lastBook?.source_position || 0) + 1));
const { error: entityError } = await db.from("entities").upsert([
  { id: bookId, kind: "book", slug: "rejection-proof", title: "Rejection Proof", summary: "How I Beat Fear and Became Invincible Through 100 Days of Rejection", visibility: "public", lifecycle_state: "incomplete", editorial_state: "approved" },
  { id: authorId, kind: "person", slug: "person-jia-jiang", title: "Jia Jiang", summary: null, visibility: "public", lifecycle_state: "active", editorial_state: "approved" },
]);
if (entityError) throw entityError;
const { error: personError } = await db.from("people").upsert({ entity_id: authorId, display_name: "Jia Jiang", sort_name: "Jiang", normalized_name: "jia jiang", initials: "JJ", contact_publication_state: "hidden" });
if (personError) throw personError;
const { error: mediaError } = await db.from("media_assets").upsert({ id: coverId, kind: "book_cover", storage_path: coverPath, source_url: coverUrl, provider: "google_books", provider_identifier: "NBCPEAAAQBAJ", mime_type: "image/webp", byte_size: coverBytes.length, width: 300, height: 391, confidence: 1, editorial_state: "approved", provenance: { metadataRecord: "https://books.google.com/books/about/Rejection_Proof.html?id=NBCPEAAAQBAJ", retrievedAt: new Date().toISOString(), cachedDerivativeFromProviderPng: true, noAmazonScrape: true } });
if (mediaError) throw mediaError;
const { error: bookError } = await db.from("books").upsert({ entity_id: bookId, source_position: sourcePosition, original_title: "Rejection Proof", original_author: "Jia Jiang", subtitle: "How I Beat Fear and Became Invincible Through 100 Days of Rejection", isbn_10: "080414138X", isbn_13: "9780804141383", publisher: "Harmony/Rodale", publication_date: "2015-04-14", language_code: "en", cover_asset_id: coverId, metadata_status: "catalog_matched", metadata_confidence: 1, metadata_provenance: { provider: "google_books", providerId: "NBCPEAAAQBAJ", providerUrl: "https://books.google.com/books/about/Rejection_Proof.html?id=NBCPEAAAQBAJ", originalCurrentStateValue: "Rejection Proof by Jia Jiang" }, import_state: "incomplete", imported_at: new Date().toISOString(), import_version: "stage4.3-reading-intake" }, { onConflict: "entity_id" });
if (bookError) throw bookError;
const { data: authoredBy, error: relationshipTypeError } = await db.from("relationship_types").select("id").eq("key", "authored_by").single();
if (relationshipTypeError) throw relationshipTypeError;
const { error: relationshipError } = await db.from("relationships").upsert({ id: id("authored-by:rejection-proof:jia-jiang"), from_entity_id: bookId, relationship_type_id: authoredBy.id, to_entity_id: authorId, confidence: 1, rank: 1, context: { source: "google_books_catalog" }, editorial_state: "approved" }, { onConflict: "from_entity_id,relationship_type_id,to_entity_id" });
if (relationshipError) throw relationshipError;
const { data: admin, error: adminError } = await db.from("brain_admin_users").select("user_id").eq("active", true).limit(1).single();
if (adminError) throw adminError;
const { data: current, error: currentError } = await db.from("current_state_snapshots").select("id,state").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1).single();
if (currentError) throw currentError;
const { error: stateError } = await db.from("current_state_snapshots").update({ state: { ...current.state, readingSecondary: "Rejection Proof", readingSecondaryAuthor: null }, provenance: { source: "stage4.3_reading_cleanup", priorManualValue: current.state.readingSecondary } }).eq("id", current.id);
if (stateError) throw stateError;
const { error: linkError } = await db.from("current_state_entity_links").upsert({ snapshot_id: current.id, role: "reading_secondary", entity_id: bookId }, { onConflict: "snapshot_id,role" });
if (linkError) throw linkError;
const { data: existingIntake } = await db.from("book_intake_requests").select("id").eq("book_entity_id", bookId).limit(1).maybeSingle();
if (!existingIntake) {
  const { error: intakeError } = await db.from("book_intake_requests").insert({ book_entity_id: bookId, title: "Rejection Proof", author: "Jia Jiang", highlights_reference: null, metadata_status: "matched", cover_status: "cached", highlights_status: "not_provided", created_by: admin.user_id, provenance: { source: "stage4.3_cleanup_of_manual_current_reading" } });
  if (intakeError) throw intakeError;
}

const [bookCheck, readingCheck] = await Promise.all([
  anon.from("brain_public_books").select("id,slug,title,original_author,cover_path").eq("id", bookId).single(),
  anon.from("brain_public_current_state_reading").select("role,slug,title,original_author,cover_path").eq("snapshot_id", current.id).eq("role", "reading_secondary").single(),
]);
if (bookCheck.error || readingCheck.error) throw bookCheck.error || readingCheck.error;
console.log(JSON.stringify({ book: bookCheck.data, currentReading: readingCheck.data, coverBytes: coverBytes.length }, null, 2));
