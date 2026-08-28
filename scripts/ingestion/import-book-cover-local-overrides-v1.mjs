import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (
  process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" ||
  process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef ||
  process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes"
) {
  throw new Error("Joe-supplied cover import is locked to the acknowledged isolated staging Brain.");
}

const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !url.includes(expectedRef)) throw new Error("The staging service connection is not configured.");
if (!anonKey) throw new Error("BRAIN_SUPABASE_ANON_KEY is required for anonymous public-view validation.");

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicDb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const manifest = JSON.parse(await readFile("data/brain/book-cover-local-overrides.v1.json", "utf8"));
const namespace = "0d3c8542-ae4b-4317-a918-254462cbdf8b";
const uid = (key) => uuidv5(key, namespace);
const normalizeName = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const initials = (value) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
const slugs = manifest.covers.map((cover) => cover.slug);

const { data: entities, error: entityError } = await db
  .from("entities")
  .select("id,slug,title")
  .in("slug", slugs);
if (entityError) throw entityError;
const entityBySlug = new Map(entities.map((entity) => [entity.slug, entity]));
const missing = slugs.filter((slug) => !entityBySlug.has(slug));
if (missing.length) throw new Error(`Staging books not found: ${missing.join(", ")}`);

const assetId = (cover) => uid(`joe-supplied-book-cover:${cover.slug}:${cover.sha256}`);
const assets = manifest.covers.map((cover) => ({
  id: assetId(cover),
  kind: "book_cover",
  storage_path: cover.publicPath,
  source_url: null,
  provider: "joe_supplied_local",
  provider_identifier: `${cover.slug}:${cover.sha256.slice(0, 16)}`,
  mime_type: cover.mimeType,
  byte_size: cover.byteSize,
  width: cover.width,
  height: cover.height,
  sha256: cover.sha256,
  confidence: 1,
  editorial_state: "approved",
  provenance: {
    authority: manifest.source.authority,
    method: manifest.source.method,
    originalFilename: cover.originalFilename,
    upstreamImageSource: manifest.source.upstreamImageSource,
    exactReadEditionRequired: manifest.source.exactReadEditionRequired,
    sourceUrlKnown: false,
    redistributionRightsAsserted: false,
    amazonScrapedByCodex: false,
    importVersion: manifest.schemaVersion,
  },
}));
const { error: assetError } = await db.from("media_assets").upsert(assets, { onConflict: "id" });
if (assetError) throw assetError;

for (const cover of manifest.covers) {
  const { error } = await db.from("books").update({ cover_asset_id: assetId(cover) }).eq("entity_id", entityBySlug.get(cover.slug).id);
  if (error) throw new Error(`${cover.slug}: ${error.message}`);
}

for (const correction of manifest.titleCorrections) {
  const entity = entityBySlug.get(correction.slug);
  const { data: book, error: bookError } = await db.from("books").select("metadata_provenance,original_title").eq("entity_id", entity.id).single();
  if (bookError) throw bookError;
  const metadataProvenance = book.metadata_provenance && typeof book.metadata_provenance === "object" ? book.metadata_provenance : {};
  const { error: titleError } = await db.from("entities").update({ title: correction.canonicalTitle }).eq("id", entity.id);
  if (titleError) throw titleError;
  const { error: provenanceError } = await db.from("books").update({
    metadata_provenance: {
      ...metadataProvenance,
      titleCorrection: {
        sourceTitle: correction.sourceTitle,
        preservedOriginalTitle: book.original_title,
        canonicalTitle: correction.canonicalTitle,
        evidence: correction.evidence,
        confidence: correction.confidence,
        recordedAt: manifest.recordedAt,
      },
    },
  }).eq("entity_id", entity.id);
  if (provenanceError) throw provenanceError;
}

const authoredBy = await db.from("relationship_types").select("id").eq("key", "authored_by").single();
if (authoredBy.error) throw authoredBy.error;
for (const correction of manifest.authorshipCorrections) {
  const book = entityBySlug.get(correction.slug);
  for (const authorName of correction.addAuthors) {
    const normalized = normalizeName(authorName);
    const existing = await db.from("people").select("entity_id").eq("normalized_name", normalized).maybeSingle();
    if (existing.error) throw existing.error;
    const personId = existing.data?.entity_id || uid(`person:${normalized}`);
    if (!existing.data) {
      const { error: personEntityError } = await db.from("entities").upsert({
        id: personId,
        kind: "person",
        slug: `person-${normalized.replace(/\s+/g, "-")}`,
        title: authorName,
        summary: null,
        visibility: "public",
        lifecycle_state: "active",
        editorial_state: "approved",
      }, { onConflict: "id" });
      if (personEntityError) throw personEntityError;
      const { error: personError } = await db.from("people").upsert({
        entity_id: personId,
        display_name: authorName,
        sort_name: authorName.split(/\s+/).at(-1),
        normalized_name: normalized,
        initials: initials(authorName),
        contact_publication_state: "hidden",
      }, { onConflict: "entity_id" });
      if (personError) throw personError;
    }
    const { data: existingRelation, error: existingRelationError } = await db
      .from("relationships")
      .select("rank")
      .eq("from_entity_id", book.id)
      .eq("relationship_type_id", authoredBy.data.id)
      .eq("to_entity_id", personId)
      .maybeSingle();
    if (existingRelationError) throw existingRelationError;
    const { data: ranks, error: rankError } = await db
      .from("relationships")
      .select("rank")
      .eq("from_entity_id", book.id)
      .eq("relationship_type_id", authoredBy.data.id);
    if (rankError) throw rankError;
    const rank = existingRelation?.rank || Math.max(0, ...ranks.map((row) => row.rank || 0)) + 1;
    const { error: relationError } = await db.from("relationships").upsert({
      id: uid(`authored-by:${correction.slug}:${normalized}`),
      from_entity_id: book.id,
      relationship_type_id: authoredBy.data.id,
      to_entity_id: personId,
      confidence: correction.confidence,
      rank,
      context: { source: "joe_supplied_cover", evidence: correction.evidence, recordedAt: manifest.recordedAt },
      editorial_state: "approved",
    }, { onConflict: "from_entity_id,relationship_type_id,to_entity_id" });
    if (relationError) throw relationError;
  }
}

const { data: publicRows, error: publicError } = await publicDb
  .from("brain_public_books")
  .select("id,slug,title,cover_path,cover_provider")
  .in("slug", slugs);
if (publicError) throw publicError;
const publicBySlug = new Map(publicRows.map((row) => [row.slug, row]));
const invalidCovers = manifest.covers.filter((cover) => publicBySlug.get(cover.slug)?.cover_path !== cover.publicPath).map((cover) => cover.slug);
if (invalidCovers.length) throw new Error(`Anonymous public cover validation failed: ${invalidCovers.join(", ")}`);
const invalidTitles = manifest.titleCorrections.filter((correction) => publicBySlug.get(correction.slug)?.title !== correction.canonicalTitle).map((correction) => correction.slug);
if (invalidTitles.length) throw new Error(`Anonymous public title validation failed: ${invalidTitles.join(", ")}`);

const awakeBook = publicBySlug.get("awake-but-sick");
const { data: awakeAuthors, error: authorValidationError } = await publicDb
  .from("brain_public_book_authors")
  .select("display_name,rank")
  .eq("book_id", awakeBook.id)
  .order("rank");
if (authorValidationError) throw authorValidationError;
if (!awakeAuthors.some((author) => author.display_name === "Toshi Matsunaga")) throw new Error("Anonymous public authorship validation failed for Awake But Sick.");

console.log(JSON.stringify({
  importedCovers: manifest.covers.length,
  correctedTitles: manifest.titleCorrections.map(({ slug, canonicalTitle }) => ({ slug, canonicalTitle })),
  awakeButSickAuthors: awakeAuthors.map((author) => author.display_name),
  publicValidated: publicRows.length,
  reviewItems: manifest.reviewItems,
}, null, 2));
