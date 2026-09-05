import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

const uuidPattern = /^[0-9a-f-]{36}$/i;
const text = (value: unknown, max = 200) => String(value || "").trim().slice(0, max) || null;

export async function POST(request: Request) {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as any;
  const assetId = String(input?.assetId || "");
  if (!uuidPattern.test(assetId)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  if (input?.uploadMode !== "optimized_publish_v2") return NextResponse.json({ error: "Refresh Control Center and prepare this photo again." }, { status: 400 });
  if (!Array.isArray(input?.derivatives) || input.derivatives.length !== 3) return NextResponse.json({ error: "All three public image sizes are required." }, { status: 400 });
  const derivativeByVariant = new Map(input.derivatives.map((item: any) => [String(item.variant), item]));
  if (!["small", "medium", "large"].every((variant) => derivativeByVariant.has(variant))) return NextResponse.json({ error: "Small, medium, and large image sizes are required." }, { status: 400 });
  const visitId = input.visitId ? String(input.visitId) : null;
  let visit: any = null;
  let place: any = null;
  if (visitId) {
    const result = await auth.supabase.from("brain_public_travel_visits").select("id,place_id").eq("id", visitId).maybeSingle();
    if (result.error || !result.data) return NextResponse.json({ error: "Choose a valid visit." }, { status: 400 });
    visit = result.data;
    const placeResult = await auth.supabase.from("brain_public_places").select("id,name,country_name").eq("id", visit.place_id).maybeSingle();
    place = placeResult.data;
  }
  const capture = input.capture || {};
  const captureDate = /^\d{4}-\d{2}-\d{2}$/.test(String(capture.date || "")) ? String(capture.date) : null;
  const capturedYear = captureDate ? Number(captureDate.slice(0, 4)) : null;
  const capturedMonth = captureDate ? Number(captureDate.slice(5, 7)) : null;
  const large = derivativeByVariant.get("large") as any;
  const publishingPath = `photos/control-center/${assetId}/large.webp`;
  const provenance = { source: "control_center_optimized_photo_upload", createdBy: auth.user.id, uploadedAt: new Date().toISOString(), originalUploaded: false, originalRetainedExternally: true };
  const db = auth.supabase;
  const uploaded = await db.storage.from("brain-public-media").list(`photos/control-center/${assetId}`, { limit: 10 });
  if (uploaded.error || !["small.webp", "medium.webp", "large.webp"].every((name) => uploaded.data?.some((item) => item.name === name))) return NextResponse.json({ error: "One or more optimized images did not finish uploading. Retry this photo." }, { status: 400 });
  const media = await db.from("media_assets").insert({ id: assetId, kind: "image", storage_path: publishingPath, provider: "control_center_optimized_upload", provider_identifier: assetId, mime_type: "image/webp", byte_size: Number(large.byteSize || 0), width: Number(large.width || 0) || null, height: Number(large.height || 0) || null, sha256: text(large.sha256, 128), editorial_state: "approved", provenance });
  if (media.error) return NextResponse.json({ error: media.error.message }, { status: 500 });
  const photo = await db.from("photo_assets").insert({ asset_id: assetId, original_filename: text(input.originalName, 255) || "photo", source_capture_at: capture.instant || null, source_capture_timezone: text(capture.timezone, 80), camera_make: text(capture.make), camera_model: text(capture.model), lens_model: text(capture.lens), orientation: Number(capture.orientation || 0) || null, inventory_version: "control-center-v2-optimized", media_kind: "still_photo", has_private_motion: false, original_pixel_width: Number(input.width || 0) || null, original_pixel_height: Number(input.height || 0) || null });
  if (photo.error) return NextResponse.json({ error: photo.error.message }, { status: 500 });
  const hasCoordinatePair = Number.isFinite(Number(capture.latitude)) && Number.isFinite(Number(capture.longitude));
  const latitude = hasCoordinatePair ? Number(capture.latitude) : null;
  const longitude = hasCoordinatePair ? Number(capture.longitude) : null;
  const privateRow = await db.from("photo_private_metadata").insert({ asset_id: assetId, original_source_path: null, exact_latitude: latitude, exact_longitude: longitude, altitude_meters: Number.isFinite(Number(capture.altitude)) ? Number(capture.altitude) : null, raw_safe_exif: { make: text(capture.make), model: text(capture.model), lens: text(capture.lens), captureSource: capture.source || "manual", sourceOriginalName: text(input.originalName, 255), sourceOriginalType: text(input.originalType, 100), sourceOriginalByteSize: Number(input.originalSize || 0), sourceOriginalLastModified: Number(input.originalLastModified || 0) || null, publishingAssetSha256: text(large.sha256, 128), originalUploaded: false, originalRetainedExternally: true } });
  if (privateRow.error) return NextResponse.json({ error: privateRow.error.message }, { status: 500 });
  const publication = await db.from("photo_publications").insert({ asset_id: assetId, place_id: visit?.place_id || null, visit_id: visit?.id || null, captured_on: captureDate, captured_year: capturedYear, captured_month: capturedMonth, date_precision: captureDate ? "day" : null, display_place: place?.name || null, country_name: place?.country_name || null, display_orientation: input.width > input.height ? "landscape" : input.height > input.width ? "portrait" : "square", is_photos_visible: input.isPublic !== false, is_wallpaper_candidate: Boolean(input.isWallpaper), visibility: input.isPublic === false ? "private" : "public", editorial_state: "approved" });
  if (publication.error) return NextResponse.json({ error: publication.error.message }, { status: 500 });
  const derivativeRows = input.derivatives.map((item: any) => ({ id: crypto.randomUUID(), asset_id: assetId, variant: item.variant, storage_path: `photos/control-center/${assetId}/${item.variant}.webp`, mime_type: "image/webp", width: Number(item.width), height: Number(item.height), byte_size: Number(item.byteSize), sha256: String(item.sha256 || "") }));
  const derivatives = await db.from("photo_derivatives").insert(derivativeRows);
  if (derivatives.error) return NextResponse.json({ error: derivatives.error.message }, { status: 500 });
  const relationship = await db.from("photo_visit_relationships").insert({ id: crypto.randomUUID(), asset_id: assetId, place_id: visit?.place_id || null, visit_id: visit?.id || null, relationship_state: visit ? "editorial_confident" : "unresolved", relationship_method: visit ? "control_center_selection" : "control_center_unassigned", active: true, provenance });
  if (relationship.error) return NextResponse.json({ error: relationship.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assetId });
}
