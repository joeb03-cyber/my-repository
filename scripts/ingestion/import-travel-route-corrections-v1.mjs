import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (
  process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" ||
  process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef ||
  process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes"
) throw new Error("Travel route corrections are locked to the acknowledged isolated staging Brain.");

const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey || !url.includes(expectedRef)) throw new Error("Staging Supabase credentials are not configured.");

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicDb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const payload = JSON.parse(await readFile("data/brain/travel/editorial-route-corrections.v1.json", "utf8"));
const correction = payload.corrections.find((item) => item.place.slug === "vaduz");
if (!correction) throw new Error("Vaduz correction is missing.");

const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const placeId = uuidv5("travel-place:vaduz", namespace);
const visitId = uuidv5("travel-visit:vaduz:2026-05:joe-direct", namespace);
const { data: snapshot, error: snapshotError } = await db.from("travel_source_snapshots").select("id").order("captured_on", { ascending: false }).limit(1).single();
if (snapshotError) throw snapshotError;

const { error: placeError } = await db.from("travel_places").upsert({
  id: placeId,
  slug: correction.place.slug,
  source_name: correction.place.sourceName,
  name: correction.place.name,
  place_type: correction.place.placeType,
  country_code: correction.place.countryCode,
  country_name: correction.place.countryName,
  latitude: correction.place.latitude,
  longitude: correction.place.longitude,
  coordinates_state: correction.place.coordinatesState,
  visibility: "public",
  editorial_state: "approved",
  provenance: { ...correction.provenance, routeContext: correction.routeContext, recordedAt: payload.recordedAt },
}, { onConflict: "id" });
if (placeError) throw placeError;

const { data: existingVisit, error: existingVisitError } = await db.from("travel_visits").select("id,chronology_index").eq("id", visitId).maybeSingle();
if (existingVisitError) throw existingVisitError;
if (!existingVisit) {
  const targetIndex = correction.visit.chronologyIndex;
  const { data: occupant, error: occupantError } = await db.from("travel_visits").select("id").eq("chronology_index", targetIndex).maybeSingle();
  if (occupantError) throw occupantError;
  if (occupant) {
    const { data: following, error: followingError } = await db.from("travel_visits").select("id,chronology_index").gte("chronology_index", targetIndex).order("chronology_index", { ascending: false });
    if (followingError) throw followingError;
    for (const row of following) {
      const { error } = await db.from("travel_visits").update({ chronology_index: row.chronology_index + 1 }).eq("id", row.id);
      if (error) throw new Error(`Could not shift chronology ${row.chronology_index}: ${error.message}`);
    }
  }
  const v = correction.visit;
  const { error: visitError } = await db.from("travel_visits").insert({
    id: visitId,
    source_snapshot_id: snapshot.id,
    place_id: placeId,
    visit_kind: v.visitKind,
    source_position: v.sourcePosition,
    group_position: v.groupPosition,
    chronology_index: v.chronologyIndex,
    start_year: v.startYear,
    start_month: v.startMonth,
    end_year: v.endYear,
    end_month: v.endMonth,
    temporal_precision: v.temporalPrecision,
    source_date_text: v.sourceDateText,
    source_value: v.sourceValue,
    source_raw_line: v.sourceRawLine,
    visibility: "public",
    editorial_state: "approved",
    provenance: { ...correction.provenance, routeContext: correction.routeContext, recordedAt: payload.recordedAt },
  });
  if (visitError) throw visitError;
}

const { data: routeVisits, error: routeError } = await publicDb.from("brain_public_travel_visits").select("place_id,chronology_index").in("chronology_index", [86, 87, 88]).order("chronology_index");
if (routeError) throw routeError;
const { data: routePlaces, error: placesError } = await publicDb.from("brain_public_places").select("id,slug,name,country_name").in("id", routeVisits.map((visit) => visit.place_id));
if (placesError) throw placesError;
const placeById = new Map(routePlaces.map((place) => [place.id, place]));
const route = routeVisits.map((visit) => ({ chronologyIndex: visit.chronology_index, ...placeById.get(visit.place_id) }));
if (route.map((item) => item.slug).join(",") !== "zurich,vaduz,innsbruck") throw new Error(`Route validation failed: ${route.map((item) => item.slug).join(",")}`);

console.log(JSON.stringify({ imported: "Vaduz, Liechtenstein", route, idempotentExistingVisit: Boolean(existingVisit) }, null, 2));
