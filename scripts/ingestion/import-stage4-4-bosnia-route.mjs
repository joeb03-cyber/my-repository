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
const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const uid = (value) => uuidv5(value, namespace);
const recordedAt = "2026-09-02T12:00:00+02:00";
const additions = [
  { slug: "kulen-vakuf", name: "Kulen Vakuf", latitude: 44.5608, longitude: 16.0886, geonamesId: "3196967", chronologyIndex: 114, sourcePosition: 104, visitId: uid("travel-visit:kulen-vakuf:2026-09:joe-direct") },
  { slug: "mostar", name: "Mostar", latitude: 43.34333, longitude: 17.80806, geonamesId: "3194828", chronologyIndex: 115, sourcePosition: 105, visitId: uid("travel-visit:mostar:2026-09:joe-direct") },
];
const { data: source, error: sourceError } = await db.from("travel_source_snapshots").select("id").order("captured_on", { ascending: false }).limit(1).single();
if (sourceError) throw sourceError;

for (const addition of additions) {
  const { data: existingPlace, error: placeLookupError } = await db.from("travel_places").select("id").eq("slug", addition.slug).maybeSingle();
  if (placeLookupError) throw placeLookupError;
  const placeId = existingPlace?.id || uid(`travel-place:${addition.slug}`);
  const { error: placeError } = await db.from("travel_places").upsert({ id: placeId, slug: addition.slug, source_name: addition.name, name: addition.name, place_type: "populated_place", country_code: "BA", country_name: "Bosnia and Herzegovina", latitude: addition.latitude, longitude: addition.longitude, coordinates_state: "editorial", visibility: "public", editorial_state: "approved", provenance: { authority: "Joe Burt", coordinateProvider: "GeoNames", geonamesId: addition.geonamesId, recordedAt } }, { onConflict: "id" });
  if (placeError) throw placeError;
  const { data: existingVisit, error: visitLookupError } = await db.from("travel_visits").select("id").eq("id", addition.visitId).maybeSingle();
  if (visitLookupError) throw visitLookupError;
  if (!existingVisit) {
    const { error: visitError } = await db.from("travel_visits").insert({ id: addition.visitId, source_snapshot_id: source.id, place_id: placeId, visit_kind: "visit", source_position: addition.sourcePosition, group_position: 1, chronology_index: addition.chronologyIndex, start_year: 2026, start_month: 9, end_year: 2026, end_month: 9, temporal_precision: "month", source_date_text: "September 2026", source_value: addition.name, source_raw_line: "Joe traveled Jajce → Kulen Vakuf → Mostar; Mostar is NOW.", visibility: "public", editorial_state: "approved", provenance: { authority: "Joe Burt", recordedAt, exactDateNotAsserted: true } });
    if (visitError) throw visitError;
  }
}

const { data: previous, error: previousError } = await db.from("current_state_snapshots").select("id,state").eq("publication_state", "published").order("effective_at", { ascending: false }).limit(1).single();
if (previousError) throw previousError;
const nextId = uid("current-state:mostar:2026-09-02");
const state = { ...previous.state, effectiveAt: recordedAt, lastConfirmedAt: recordedAt, where: { ...previous.state.where, city: "Mostar", country: "Bosnia and Herzegovina", coordinates: "43.34333, 17.80806", timezone: "Europe/Sarajevo" } };
const { error: stateError } = await db.from("current_state_snapshots").upsert({ id: nextId, effective_at: recordedAt, last_confirmed_at: recordedAt, publication_state: "published", state, provenance: { source: "joe_direct_update_2026_09_02", priorSnapshotId: previous.id, coordinateProvider: "GeoNames" } }, { onConflict: "id" });
if (stateError) throw stateError;
const { data: priorLinks, error: linksError } = await db.from("current_state_entity_links").select("role,entity_id").eq("snapshot_id", previous.id);
if (linksError) throw linksError;
if (priorLinks?.length) {
  const { error: copyError } = await db.from("current_state_entity_links").upsert(priorLinks.map((link) => ({ snapshot_id: nextId, role: link.role, entity_id: link.entity_id })), { onConflict: "snapshot_id,role" });
  if (copyError) throw copyError;
}
const { error: archiveError } = await db.from("current_state_snapshots").update({ publication_state: "archived" }).eq("publication_state", "published").neq("id", nextId);
if (archiveError) throw archiveError;

const [placesCheck, visitsCheck, currentCheck] = await Promise.all([
  anon.from("brain_public_places").select("name,country_name,latitude,longitude").in("slug", additions.map((item) => item.slug)).order("name"),
  anon.from("brain_public_travel_visits").select("source_value,chronology_index").in("chronology_index", [114, 115]).order("chronology_index"),
  anon.from("brain_public_current_state").select("state").limit(1).single(),
]);
if (placesCheck.error || visitsCheck.error || currentCheck.error) throw placesCheck.error || visitsCheck.error || currentCheck.error;
console.log(JSON.stringify({ places: placesCheck.data, visits: visitsCheck.data, now: currentCheck.data.state.where }, null, 2));
