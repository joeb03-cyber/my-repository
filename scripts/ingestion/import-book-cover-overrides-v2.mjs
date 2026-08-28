import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (
  process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" ||
  process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef ||
  process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes"
) {
  throw new Error("Cover import is locked to the acknowledged isolated staging Brain.");
}

const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !url.includes(expectedRef)) throw new Error("The staging service connection is not configured.");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!anonKey) throw new Error("BRAIN_SUPABASE_ANON_KEY is required for public-view validation.");
const publicDb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const manifest = JSON.parse(await readFile("data/brain/book-cover-overrides.v2.json", "utf8"));
const approved = manifest.covers.filter((cover) => cover.status === "cached");
const namespace = "19aacbec-3ca8-459d-9f74-102a6d0c48dd";
const assetId = (cover) => uuidv5(`book-cover-v2:${cover.slug}:${cover.sha256}`, namespace);

const { data: entities, error: entityError } = await db
  .from("entities")
  .select("id,slug")
  .in("slug", approved.map((cover) => cover.slug));
if (entityError) throw entityError;
const entityBySlug = new Map(entities.map((entity) => [entity.slug, entity.id]));
const missing = approved.filter((cover) => !entityBySlug.has(cover.slug)).map((cover) => cover.slug);
if (missing.length) throw new Error(`Staging books not found: ${missing.join(", ")}`);

const assets = approved.map((cover) => ({
  id: assetId(cover),
  kind: "book_cover",
  storage_path: cover.publicPath,
  source_url: cover.sourceUrl,
  provider: cover.provider,
  provider_identifier: cover.providerIdentifier,
  mime_type: cover.mimeType,
  byte_size: cover.byteSize,
  width: cover.width,
  height: cover.height,
  sha256: cover.sha256,
  confidence: cover.confidence,
  editorial_state: "approved",
  provenance: {
    sourcePage: cover.sourcePage,
    amazon_scraped: false,
    matchBasis: manifest.policy.matchBasis,
    editionPolicy: manifest.policy.editionPolicy,
    importVersion: manifest.schemaVersion,
  },
}));

const { error: assetError } = await db.from("media_assets").upsert(assets);
if (assetError) throw assetError;

for (const cover of approved) {
  const { error } = await db
    .from("books")
    .update({ cover_asset_id: assetId(cover) })
    .eq("entity_id", entityBySlug.get(cover.slug));
  if (error) throw new Error(`${cover.slug}: ${error.message}`);
}

const { data: publicRows, error: publicError } = await publicDb
  .from("brain_public_books")
  .select("slug,cover_path,cover_provider")
  .in("slug", approved.map((cover) => cover.slug));
if (publicError) throw publicError;
const visible = new Map(publicRows.map((row) => [row.slug, row]));
const invalid = approved.filter((cover) => visible.get(cover.slug)?.cover_path !== cover.publicPath).map((cover) => cover.slug);
if (invalid.length) throw new Error(`Public cover validation failed: ${invalid.join(", ")}`);

console.log(JSON.stringify({ imported: approved.length, publicValidated: publicRows.length, failedDownloads: manifest.covers.filter((cover) => cover.status === "failed").map((cover) => cover.slug) }, null, 2));
