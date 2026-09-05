import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { LivedHistory, LivedPhoto } from "./lived-history-types";
import { getTravelTimeline } from "./travel.server";
import { publicBrainClient } from "./public-supabase.server";

const localPath = path.join(process.cwd(), "artifacts/photo-curation/stage4/public-photo-snapshot.private.json");

function localDerivativeUrl(photoId: string, size: "small" | "medium" | "large") {
  return `/api/brain/travel-photos/media/${photoId}?size=${size}&revision=stage4-heic-v2`;
}

function withPublicJourneyLabel(photo: LivedPhoto): LivedPhoto {
  const relationshipIsConfident = photo.relationshipState === "strong" || photo.relationshipState === "editorial_confident";
  return relationshipIsConfident && photo.visitPlace && !photo.displayPlace
    ? { ...photo, displayPlace: photo.visitPlace }
    : photo;
}

async function localHistory(): Promise<LivedHistory> {
  const snapshot = JSON.parse(await readFile(localPath, "utf8")) as LivedHistory;
  return {
    ...snapshot,
    photos: snapshot.photos.map((photo) => withPublicJourneyLabel({
      ...photo,
      derivatives: {
        small: { ...photo.derivatives.small, url: localDerivativeUrl(photo.id, "small") },
        medium: { ...photo.derivatives.medium, url: localDerivativeUrl(photo.id, "medium") },
        large: { ...photo.derivatives.large, url: localDerivativeUrl(photo.id, "large") },
      },
    })),
  };
}

function publicStorageUrl(storagePath: string) {
  const base = process.env.BRAIN_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/brain-public-media/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}

async function supabaseHistory(): Promise<LivedHistory> {
  const client = publicBrainClient();
  const [timeline, photoResult] = await Promise.all([
    getTravelTimeline(),
    client.from("brain_public_lived_photos").select("*").order("capture_date", { ascending: true, nullsFirst: false }),
  ]);
  if (photoResult.error) throw new Error(`Supabase photos: ${photoResult.error.message}`);
  const photos: LivedPhoto[] = (photoResult.data || []).map((row: any) => withPublicJourneyLabel({
    id: row.id,
    captureDate: row.capture_date,
    capturedYear: row.captured_year,
    capturedMonth: row.captured_month,
    datePrecision: row.date_precision,
    width: row.width,
    height: row.height,
    orientation: row.display_orientation || "unknown",
    visitId: row.visit_id,
    placeId: row.place_id,
    visitPlace: row.visit_place,
    displayPlace: row.display_place,
    country: row.country_name,
    relationshipState: row.relationship_state,
    wallpaper: Boolean(row.is_wallpaper_candidate),
    mediaKind: row.has_private_motion ? "live_photo" : "still_photo",
    hasPrivateMotion: Boolean(row.has_private_motion),
    derivatives: {
      small: { url: publicStorageUrl(row.small_storage_path), width: 480 },
      medium: { url: publicStorageUrl(row.medium_storage_path), width: 1024 },
      large: { url: publicStorageUrl(row.large_storage_path), width: 1800 },
    },
  }));
  const counts = new Map<string, number>();
  photos.forEach((photo) => photo.visitId && counts.set(photo.visitId, (counts.get(photo.visitId) || 0) + 1));
  const visits = timeline.visits.map((visit) => {
    const place = timeline.places.find((candidate) => candidate.id === visit.placeId)!;
    return {
      id: visit.id, chronologyIndex: visit.chronologyIndex, placeId: visit.placeId,
      place: place.name, country: place.countryName, latitude: place.latitude, longitude: place.longitude,
      start: visit.start, end: visit.end, sourceDateText: visit.sourceDateText, publicBlurb: visit.publicBlurb || null, photoCount: counts.get(visit.id) || 0,
    };
  });
  const stage17 = await import("@/data/brain/editorial-updates/2026-08-28-stage17.v1.json");
  const lifetime = stage17.default.travelDirection;
  const recentCountries = new Set(visits.map((visit) => visit.country));
  if (timeline.currentState?.location.country_name) recentCountries.add(timeline.currentState.location.country_name);
  const lifetimeCountries = Array.from(new Set([...Array.from(recentCountries), ...lifetime.pre2023CountriesSupplied])).sort();
  return {
    schemaVersion: "synergetic-lived-history.supabase.v1",
    stats: {
      photos: photos.length, wallpapers: photos.filter((photo) => photo.wallpaper).length,
      visits: visits.length, visitsWithPhotos: counts.size, lifetimeCountries: lifetime.reconciledKnownLifetimeCount,
      recentCountries: recentCountries.size,
      relationshipStates: photos.reduce<Record<string, number>>((values, photo) => ({ ...values, [photo.relationshipState]: (values[photo.relationshipState] || 0) + 1 }), {}),
    },
    journeyStart: "2023-09", lifetimeCountries,
    currentLocation: timeline.currentState?.location || null,
    visits, photos,
  };
}

export async function getLivedHistory(): Promise<LivedHistory> {
  return process.env.BRAIN_DATA_SOURCE === "supabase" ? supabaseHistory() : localHistory();
}
