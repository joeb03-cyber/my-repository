import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") {
  throw new Error("Stage 16 import is locked to the acknowledged isolated staging Brain.");
}
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !url.includes(expectedRef)) throw new Error("The staging service connection is not configured.");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const update = JSON.parse(await readFile("data/brain/editorial-updates/2026-08-28-stage16.v1.json", "utf8"));
const taxonomy = JSON.parse(await readFile("data/brain/topic-taxonomy.v1.json", "utf8"));
const namespace = "0d3c8542-ae4b-4317-a918-254462cbdf8b";
const currentNamespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const capturedAt = "2026-08-28T16:00:00.000Z";

const uid = (key) => uuidv5(key, namespace);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalizeName = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const initials = (value) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
const personSlug = (value) => normalizeName(value).replace(/\s+/g, "-");

async function upsert(table, rows, options = {}) {
  if (!rows.length) return;
  for (let offset = 0; offset < rows.length; offset += 200) {
    const { error } = await db.from(table).upsert(rows.slice(offset, offset + 200), options);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length} rows upserted`);
}

function paragraphs(raw) {
  return raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/\n\s*\n+/).map((text) => text.trim()).filter(Boolean);
}

function classify(rawText) {
  const text = rawText.replace(/^\*\s*/, "").trim();
  const upper = text.toUpperCase();
  if (/^(PART|CHAPTER)\s+([A-Z0-9]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b[:.]?/i.test(text)) return { text, kind: "chapter_label", confidence: 0.96, reason: "explicit chapter or part label" };
  if (/^(STOP AND EXPLORE|PRACTICE|EXERCISE)\b/i.test(text)) return { text, kind: "exercise", confidence: 0.95, reason: "explicit exercise or practice label" };
  if (text.length <= 90 && (upper === text || /^\d+\s+[A-Z]/.test(text))) return { text, kind: "section_label", confidence: 0.82, reason: "short display-like or numbered section label" };
  return { text, kind: "highlight", confidence: 0.86, reason: "substantive source text defaults to book-derived excerpt" };
}

const bookRows = [];
const bookEntities = [];
const personRows = [];
const personEntities = [];
const sources = [];
const sourceVersions = [];
const fragments = [];
const highlightEntities = [];
const highlights = [];
const passageGroups = [];
const passageMembers = [];
const externalLinks = [];
const provenanceLinks = [];
const relationships = [];
let parsedCount = 0;

const { data: relationshipTypes, error: relationshipTypeError } = await db.from("relationship_types").select("id,key").in("key", ["authored_by", "about_topic", "associated_with"]);
if (relationshipTypeError) throw relationshipTypeError;
const relationshipTypeByKey = new Map(relationshipTypes.map((row) => [row.key, row.id]));
for (const keyName of ["authored_by", "about_topic", "associated_with"]) if (!relationshipTypeByKey.has(keyName)) throw new Error(`Missing relationship type: ${keyName}`);

const topicBySlug = new Map(taxonomy.topics.map((topic) => [topic.slug, topic]));
for (const book of update.books) {
  const bookId = uid(`book:${book.slug}`);
  const authorId = uid(`person:${normalizeName(book.author)}`);
  const sourceId = uid(`google-doc:${book.googleDocId}`);
  const raw = await readFile(`data/ingestion/stage16-book-additions/source/${book.sourceSnapshot}`, "utf8");
  const contentHash = sha256(raw);
  const sourceVersionId = uid(`source-version:${book.googleDocId}:${contentHash}`);
  const blocks = paragraphs(raw);

  bookEntities.push({ id: bookId, kind: "book", slug: book.slug, title: book.title, summary: null, visibility: "public", lifecycle_state: "active", editorial_state: "approved" });
  bookRows.push({
    entity_id: bookId, source_position: book.sourcePosition, original_title: book.originalTitle, original_author: book.author,
    subtitle: null, isbn_10: null, isbn_13: null, publisher: null, publication_date: null, language_code: "en", cover_asset_id: null,
    metadata_status: "source_only", metadata_confidence: null,
    metadata_provenance: { source: "google_doc_title_line", originalTitle: book.originalTitle, originalAuthor: book.author, exactSourceUrl: book.googleDocUrl },
    import_state: "complete", imported_at: capturedAt, import_version: "stage16-editorial-update-v1",
  });
  personEntities.push({ id: authorId, kind: "person", slug: `person-${personSlug(book.author)}`, title: book.author, summary: null, visibility: "public", lifecycle_state: "active", editorial_state: "approved" });
  personRows.push({ entity_id: authorId, display_name: book.author, sort_name: book.author.split(/\s+/).slice(-1)[0], normalized_name: normalizeName(book.author), initials: initials(book.author), contact_publication_state: "hidden" });
  relationships.push({ id: uid(`authored-by:${book.slug}:${normalizeName(book.author)}`), from_entity_id: bookId, relationship_type_id: relationshipTypeByKey.get("authored_by"), to_entity_id: authorId, confidence: 1, rank: 1, context: { source: "google_doc_title_line" }, editorial_state: "approved" });

  sources.push({ id: sourceId, kind: "google_doc", external_id: book.googleDocId, canonical_url: book.googleDocUrl, title: `${book.title} highlights`, access_state: "available", visibility: "private", editorial_state: "approved", privacy_state: "private_source", public_provenance_label: "Linked Google Doc highlights", provenance: { exactSourceUrl: book.googleDocUrl, fetchedNonDestructively: true } });
  sourceVersions.push({ id: sourceVersionId, source_id: sourceId, content_hash: contentHash, export_format: "text/plain", parser_version: "stage16-conservative-paragraphs-v1", captured_at: capturedAt, raw_snapshot_path: `data/ingestion/stage16-book-additions/source/${book.sourceSnapshot}`, source_metadata: { privateLocalSnapshot: true, originalStructurePreserved: true, sourceParagraphCount: blocks.length } });
  externalLinks.push({ id: uid(`external:${book.slug}:source:${book.googleDocUrl}`), entity_id: bookId, link_type: "source_highlights", url: book.googleDocUrl, label: "Book highlights", is_original_source: true, validation_state: "valid", provenance: { exactSourceUrlPreserved: true } });
  if (book.retailUrl) externalLinks.push({ id: uid(`external:${book.slug}:retail:${book.retailUrl}`), entity_id: bookId, link_type: "retail_reference", url: book.retailUrl, label: "Original book link", is_original_source: true, validation_state: "valid", provenance: { extractedFromSourceDocument: true } });

  let section = [];
  let contentOrdinal = 0;
  blocks.forEach((rawText, paragraphIndex) => {
    const fragmentId = uid(`fragment:${book.googleDocId}:${contentHash}:${paragraphIndex + 1}`);
    fragments.push({ id: fragmentId, source_version_id: sourceVersionId, fragment_key: `p${paragraphIndex + 1}`, ordinal: paragraphIndex + 1, raw_text: rawText, normalized_text: rawText.replace(/^\*\s*/, "").trim(), paragraph_start: paragraphIndex + 1, paragraph_end: paragraphIndex + 1, body_block_start: paragraphIndex + 1, body_block_end: paragraphIndex + 1, container: "body", formatting: { paragraphBoundaryPreserved: true, sourceHadBulletMarker: /^\*\s*/.test(rawText) } });
    const normalized = rawText.replace(/^\*\s*/, "").trim();
    if (paragraphIndex === 0 || /^_+$/.test(normalized) || normalized === book.retailUrl) return;
    const classified = classify(rawText);
    contentOrdinal += 1;
    const highlightId = uid(`highlight:${book.googleDocId}:${contentHash}:${paragraphIndex + 1}`);
    const sourceUnitKey = `stage16-${book.sourcePosition}-p${paragraphIndex + 1}`;
    const sectionPath = [...section];
    highlightEntities.push({ id: highlightId, kind: "highlight", slug: `${book.slug}-p${paragraphIndex + 1}`, title: classified.text, summary: null, visibility: "public", lifecycle_state: "active", editorial_state: "approved" });
    highlights.push({ entity_id: highlightId, book_id: bookId, source_fragment_id: fragmentId, source_unit_key: sourceUnitKey, ordinal: contentOrdinal, text: classified.text, content_kind: classified.kind, section_path: sectionPath, locator: null, classification_confidence: classified.confidence, classification_reason: classified.reason, review_state: classified.kind === "highlight" ? "approved" : "needs_review", public_eligible: true, standout_rank: null, imported_at: capturedAt, import_version: "stage16-conservative-paragraphs-v1" });
    passageGroups.push({ id: uid(`passage-group:${book.slug}:${contentOrdinal}`), book_id: bookId, ordinal: contentOrdinal, grouping_method: "structural", confidence: 1, review_state: "approved", rationale: "One source paragraph retained as one display group; no aggressive merging.", import_version: "stage16-conservative-paragraphs-v1" });
    passageMembers.push({ passage_group_id: uid(`passage-group:${book.slug}:${contentOrdinal}`), highlight_id: highlightId, ordinal: 1, source_unit_key: sourceUnitKey });
    provenanceLinks.push({ id: uid(`provenance:${highlightId}`), entity_id: highlightId, relationship_id: null, source_fragment_id: fragmentId, source_version_id: sourceVersionId, role: "derived_from", confidence: 1, context: { paragraphStart: paragraphIndex + 1, paragraphEnd: paragraphIndex + 1 } });
    if (classified.kind === "chapter_label" || classified.kind === "section_label") section = [classified.text];
    parsedCount += 1;
  });

  for (const topicSlug of book.topicSlugs) {
    const topic = topicBySlug.get(topicSlug);
    if (!topic) throw new Error(`Unknown taxonomy topic: ${topicSlug}`);
    relationships.push({ id: uid(`about-topic:${book.slug}:${topicSlug}`), from_entity_id: bookId, relationship_type_id: relationshipTypeByKey.get("about_topic"), to_entity_id: topic.id, confidence: 0.7, rank: 1, context: { source: "stage16_editorial_suggestion" }, editorial_state: "suggested" });
  }
}

await upsert("entities", [...personEntities, ...bookEntities, ...highlightEntities]);
await upsert("people", personRows);
await upsert("books", bookRows);
await upsert("sources", sources);
await upsert("source_versions", sourceVersions);
await upsert("source_fragments", fragments);
await upsert("highlights", highlights);
await upsert("passage_groups", passageGroups);
await upsert("passage_group_members", passageMembers, { onConflict: "passage_group_id,highlight_id" });
await upsert("external_links", externalLinks);
await upsert("relationships", relationships);
await upsert("provenance_links", provenanceLinks);

// Retire Aleena from Contacts without deleting her entity, sources, or relationships.
for (const name of update.contacts.retire) {
  const { data: person, error } = await db.from("people").select("entity_id").eq("display_name", name).maybeSingle();
  if (error || !person) throw error || new Error(`Contact not found: ${name}`);
  await upsert("people", [{ entity_id: person.entity_id, display_name: name, normalized_name: normalizeName(name), contact_publication_state: "retired" }]);
  const { error: assertionError } = await db.from("editorial_assertions").update({ approval_state: "revoked", visibility: "private", provenance: { source: "joe_direct_editorial_update_2026_08_28", removalIsNonDestructive: true } }).eq("target_entity_id", person.entity_id).eq("assertion_type", "interesting").eq("asserted_by", "joe_burt");
  if (assertionError) throw assertionError;
}

// Correct Madhava Setty's editorial context and topic associations.
for (const correction of update.contacts.correct) {
  const { data: person, error } = await db.from("people").select("entity_id").eq("display_name", correction.name).maybeSingle();
  if (error || !person) throw error || new Error(`Contact not found: ${correction.name}`);
  const { data: topicEntities, error: topicError } = await db.from("entities").select("id,slug").in("slug", [...correction.removeTopicSlugs, ...correction.approveTopicSlugs]);
  if (topicError) throw topicError;
  const topicIdBySlug = new Map(topicEntities.map((row) => [row.slug, row.id]));
  for (const slug of correction.removeTopicSlugs) {
    const topicId = topicIdBySlug.get(slug);
    if (topicId) {
      const { error: relationError } = await db.from("relationships").update({ editorial_state: "rejected", context: { source: "joe_direct_correction_2026_08_28", reason: "Not the reason Joe follows this person" } }).eq("from_entity_id", person.entity_id).eq("relationship_type_id", relationshipTypeByKey.get("associated_with")).eq("to_entity_id", topicId);
      if (relationError) throw relationError;
    }
  }
  for (const slug of correction.approveTopicSlugs) {
    const topicId = topicIdBySlug.get(slug);
    if (topicId) {
      const { error: relationError } = await db.from("relationships").update({ editorial_state: "approved", context: { source: "joe_direct_correction_2026_08_28" } }).eq("from_entity_id", person.entity_id).eq("relationship_type_id", relationshipTypeByKey.get("associated_with")).eq("to_entity_id", topicId);
      if (relationError) throw relationError;
    }
  }
  const newTopicId = uid(`topic:${correction.addTopic.slug}`);
  await upsert("entities", [{ id: newTopicId, kind: "topic", slug: correction.addTopic.slug, title: correction.addTopic.title, summary: correction.addTopic.description, visibility: "public", lifecycle_state: "active", editorial_state: "approved" }]);
  await upsert("topics", [{ entity_id: newTopicId, description: correction.addTopic.description, taxonomy_version: "people-topics-v2", editorial_state: "approved" }]);
  await upsert("relationships", [{ id: uid(`associated-with:${person.entity_id}:${newTopicId}`), from_entity_id: person.entity_id, relationship_type_id: relationshipTypeByKey.get("associated_with"), to_entity_id: newTopicId, confidence: 1, rank: 1, context: { source: "joe_direct_correction_2026_08_28" }, editorial_state: "approved" }]);
  const { error: assertionError } = await db.from("editorial_assertions").update({ context_domain: correction.contextDomain, note: correction.note, approval_state: "approved", visibility: "public", endorsement: false, provenance: { source: "joe_direct_editorial_update_2026_08_28", supersedesHealthFraming: true } }).eq("target_entity_id", person.entity_id).eq("assertion_type", "interesting").eq("asserted_by", "joe_burt");
  if (assertionError) throw assertionError;
}

// Expand Contacts only by Joe's explicit, mechanically reviewable rule: >=2 public books.
const { data: publicBooks, error: publicBookError } = await db.from("entities").select("id").eq("kind", "book").eq("visibility", "public").neq("lifecycle_state", "archived");
if (publicBookError) throw publicBookError;
const { data: authoredRelations, error: authoredRelationError } = await db.from("relationships").select("from_entity_id,to_entity_id").eq("relationship_type_id", relationshipTypeByKey.get("authored_by")).eq("editorial_state", "approved").in("from_entity_id", publicBooks.map((book) => book.id));
if (authoredRelationError) throw authoredRelationError;
const authorIds = [...new Set(authoredRelations.map((row) => row.to_entity_id))];
const { data: authorPeople, error: authorPeopleError } = await db.from("people").select("entity_id,display_name").in("entity_id", authorIds);
if (authorPeopleError) throw authorPeopleError;
const authorNameById = new Map(authorPeople.map((person) => [person.entity_id, person.display_name]));
const publicAuthors = authoredRelations.map((row) => ({ book_id: row.from_entity_id, display_name: authorNameById.get(row.to_entity_id) })).filter((row) => row.display_name);
const booksByAuthor = new Map();
for (const row of publicAuthors) booksByAuthor.set(row.display_name, new Set([...(booksByAuthor.get(row.display_name) || []), row.book_id]));
const multiBookAuthors = [...booksByAuthor].filter(([, ids]) => ids.size >= 2).sort(([a], [b]) => a.localeCompare(b));
for (const [name, ids] of multiBookAuthors) {
  const { data: person, error } = await db.from("people").select("entity_id,normalized_name").eq("display_name", name).maybeSingle();
  if (error || !person) throw error || new Error(`Library author identity missing: ${name}`);
  const { error: publishError } = await db.from("people").update({ contact_publication_state: "published" }).eq("entity_id", person.entity_id);
  if (publishError) throw publishError;
  const { error: entityError } = await db.from("entities").update({ visibility: "public", lifecycle_state: "active", editorial_state: "approved" }).eq("id", person.entity_id);
  if (entityError) throw entityError;
  const { data: existingAssertion, error: existingAssertionError } = await db.from("editorial_assertions").select("id").eq("target_entity_id", person.entity_id).eq("assertion_type", "interesting").eq("asserted_by", "joe_burt").maybeSingle();
  if (existingAssertionError) throw existingAssertionError;
  if (existingAssertion) {
    const { error: approveError } = await db.from("editorial_assertions").update({ approval_state: "approved", visibility: "public", endorsement: false }).eq("id", existingAssertion.id);
    if (approveError) throw approveError;
  } else {
    await upsert("editorial_assertions", [{ id: uid(`interesting:${person.entity_id}:library-multi-book-rule`), target_entity_id: person.entity_id, target_source_id: null, context_entity_id: null, assertion_type: "interesting", approval_state: "approved", context_domain: "Books", note: `Joe has read at least ${ids.size} books by this person.`, asserted_by: "joe_burt", endorsement: false, visibility: "public", provenance: { source: "joe_rule_2026_08_28", qualifyingPublicBookCount: ids.size, relationshipNotBiography: true } }]);
  }
}

// Publish one new immutable current-state snapshot and preserve its optional Reading -> Book link.
const { data: previousStates, error: stateError } = await db.from("current_state_snapshots").select("id,state,effective_at").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1);
if (stateError || !previousStates?.length) throw stateError || new Error("No published current state exists to update safely.");
const previous = previousStates[0];
const location = update.currentLocation;
const state = { ...previous.state, effectiveAt: location.effectiveAt, lastConfirmedAt: location.effectiveAt, where: { ...(previous.state.where || {}), city: location.city, country: location.country, coordinates: `${location.latitude.toFixed(4)}° N · ${location.longitude.toFixed(4)}° E`, status: "reported" } };
const snapshotId = uuidv5(`current-state:${location.effectiveAt}`, currentNamespace);
await upsert("current_state_snapshots", [{ id: snapshotId, effective_at: location.effectiveAt, last_confirmed_at: location.effectiveAt, publication_state: "published", state, provenance: { source: "joe_direct_update_2026_08_28", coordinatesProvider: "GeoNames", priorSnapshotId: previous.id } }]);
const { data: priorReading, error: readingError } = await db.from("current_state_entity_links").select("entity_id").eq("snapshot_id", previous.id).eq("role", "reading").maybeSingle();
if (readingError) throw readingError;
if (priorReading) await upsert("current_state_entity_links", [{ snapshot_id: snapshotId, role: "reading", entity_id: priorReading.entity_id }], { onConflict: "snapshot_id,role" });
const { error: archiveStateError } = await db.from("current_state_snapshots").update({ publication_state: "archived" }).eq("publication_state", "published").neq("id", snapshotId);
if (archiveStateError) throw archiveStateError;

const runHash = sha256(JSON.stringify(update));
await upsert("ingestion_runs", [{ id: uid(`ingestion-run:${runHash}`), pipeline_name: "stage16-editorial-updates", pipeline_version: update.schemaVersion, source_inventory_hash: runHash, status: "complete", started_at: capturedAt, completed_at: new Date().toISOString(), counts: { books: bookRows.length, sourceFragments: fragments.length, parsedUnits: parsedCount, contactsQualifiedByBooks: multiBookAuthors.length, location: location.city }, environment: "staging" }]);

console.log(JSON.stringify({ books: bookRows.map((book) => book.original_title), parsedUnits: parsedCount, sourceFragments: fragments.length, multiBookAuthors: multiBookAuthors.map(([name, ids]) => ({ name, books: ids.size })), currentLocation: `${location.city}, ${location.country}` }, null, 2));
