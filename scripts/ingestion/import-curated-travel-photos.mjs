// Guarded, idempotent Stage 4 importer. Do not run without Joe's explicit
// staging-import approval. It cannot target any project except the isolated
// Synergetic Human staging Brain.
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes" || process.env.BRAIN_IMPORT_APPROVED_STAGE !== "photos-stage-4") {
  throw new Error("Photo import is locked pending explicit Stage 4 isolated-staging approval.");
}
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey || !url.includes(expectedRef)) throw new Error("Isolated staging credentials are not configured.");

const root = "artifacts/photo-curation/stage4";
const snapshot = JSON.parse(await readFile(`${root}/public-photo-snapshot.private.json`, "utf8"));
const privateImport = JSON.parse(await readFile(`${root}/photo-import.private.json`, "utf8"));
const derivativeCheck = JSON.parse(await readFile(`${root}/derivative-validation.private.json`, "utf8"));
if (snapshot.stats.photos !== 217 || snapshot.stats.wallpapers !== 43 || derivativeCheck.photosExpected !== 217 || derivativeCheck.missing.length || derivativeCheck.invalidContent?.length || derivativeCheck.sourceModified || derivativeCheck.publicOriginalsIncluded || derivativeCheck.livePhotoMotionIncluded) {
  throw new Error("Private curation/derivative validation does not match the approved 217 Keeps / 43 Wallpapers snapshot.");
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicDb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const privateById = new Map(privateImport.assets.map((asset) => [asset.assetId, asset]));
const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const variants = ["small", "medium", "large"];

function isoCapture(value) {
  if (!value) return null;
  const normalized = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}
function derivedSize(photo, variant) {
  const maximum = { small: 480, medium: 1024, large: 1800 }[variant];
  const scale = photo.width && photo.height ? Math.min(maximum / photo.width, maximum / photo.height, 1) : 1;
  return { width: Math.max(1, Math.round((photo.width || maximum) * scale)), height: Math.max(1, Math.round((photo.height || maximum) * scale)) };
}
async function hashFile(path) {
  const bytes = await readFile(path); return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
async function upsertChunks(table, rows, options = {}) {
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await db.from(table).upsert(rows.slice(index, index + 100), options);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

const mediaRows = [], assetRows = [], privateRows = [], publicationRows = [], relationshipRows = [], derivativeRows = [];
for (const photo of snapshot.photos) {
  const source = privateById.get(photo.id);
  if (!source) throw new Error(`Missing private provenance for ${photo.id}`);
  mediaRows.push({ id: photo.id, kind: "image", storage_path: null, provider: "synergetic-photo-curation", provider_identifier: photo.id, mime_type: null, byte_size: null, width: photo.width, height: photo.height, sha256: source.primarySha256, confidence: 1, editorial_state: "approved", provenance: { source: "private-photo-curation-stage4", logicalAssetId: photo.id, originalRetainedPrivately: true } });
  assetRows.push({ asset_id: photo.id, source_logical_asset_id: photo.id, original_filename: source.primaryFilename, source_capture_at: isoCapture(source.captureAtRaw), orientation: null, inventory_version: snapshot.generatedFrom.sourceInventorySha256, media_kind: photo.mediaKind, has_private_motion: photo.hasPrivateMotion, original_pixel_width: photo.width, original_pixel_height: photo.height });
  privateRows.push({ asset_id: photo.id, original_source_path: source.sourceFiles.join(" | "), exact_latitude: source.exactGps?.latitude ?? null, exact_longitude: source.exactGps?.longitude ?? null, altitude_meters: source.exactGps?.altitude ?? null, raw_safe_exif: { sourceFiles: source.sourceFiles, pairing: source.pairing, captureAtRaw: source.captureAtRaw } });
  publicationRows.push({ asset_id: photo.id, place_id: photo.placeId, visit_id: photo.visitId, caption: null, captured_on: photo.captureDate, captured_year: photo.capturedYear, captured_month: photo.capturedMonth, date_precision: photo.datePrecision, display_place: photo.displayPlace, country_name: photo.country, display_orientation: photo.orientation, is_photos_visible: true, is_favorite: false, is_wallpaper_candidate: photo.wallpaper, visibility: "public", editorial_state: "approved" });
  relationshipRows.push({ id: uuidv5(`photo-visit-relationship:${photo.id}:stage4`, namespace), asset_id: photo.id, place_id: photo.placeId, visit_id: photo.visitId, relationship_state: photo.relationshipState, relationship_method: photo.relationshipMethod, active: true, provenance: { source: "stage4-reconciliation", preservesChronology: true, reviewable: true } });
  for (const variant of variants) {
    const localPath = `${root}/derivatives.private/${photo.id}/${variant}.webp`;
    const file = await hashFile(localPath); const info = await stat(localPath); const dimensions = derivedSize(photo, variant);
    const storagePath = photo.derivatives[variant].storagePath;
    const { error } = await db.storage.from("brain-public-media").upload(storagePath, file.bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (error) throw new Error(`Storage ${storagePath}: ${error.message}`);
    derivativeRows.push({ id: uuidv5(`photo-derivative:${photo.id}:${variant}`, namespace), asset_id: photo.id, variant, storage_path: storagePath, mime_type: "image/webp", width: dimensions.width, height: dimensions.height, byte_size: info.size, sha256: file.sha256 });
  }
}

await upsertChunks("media_assets", mediaRows, { onConflict: "id" });
await upsertChunks("photo_assets", assetRows, { onConflict: "asset_id" });
await upsertChunks("photo_private_metadata", privateRows, { onConflict: "asset_id" });
await upsertChunks("photo_publications", publicationRows, { onConflict: "asset_id" });
await upsertChunks("photo_visit_relationships", relationshipRows, { onConflict: "id" });
await upsertChunks("photo_derivatives", derivativeRows, { onConflict: "id" });

const { count: publicCount, error: publicError } = await publicDb.from("brain_public_lived_photos").select("id", { count: "exact", head: true });
if (publicError || publicCount !== 217) throw new Error(`Public projection validation failed: ${publicError?.message || publicCount}`);
const { count: wallpaperCount, error: wallpaperError } = await publicDb.from("brain_public_lived_photos").select("id", { count: "exact", head: true }).eq("is_wallpaper_candidate", true);
if (wallpaperError || wallpaperCount !== 43) throw new Error(`Wallpaper validation failed: ${wallpaperError?.message || wallpaperCount}`);
const { error: privateLeakError } = await publicDb.from("brain_public_lived_photos").select("exact_latitude").limit(1);
if (!privateLeakError) throw new Error("Public projection unexpectedly exposes private GPS.");
const sample = snapshot.photos[0].derivatives.small.storagePath;
const storageResponse = await fetch(`${url}/storage/v1/object/public/brain-public-media/${sample}`);
if (!storageResponse.ok || storageResponse.headers.get("content-type") !== "image/webp") throw new Error("Public derivative delivery validation failed.");

console.log(JSON.stringify({ environment: "isolated-staging", publicPhotos: publicCount, wallpapers: wallpaperCount, derivatives: derivativeRows.length, publicOriginals: 0, publicLivePhotoMovies: 0, sourceModified: false, idempotentKeys: true }, null, 2));
