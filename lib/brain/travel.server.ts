import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TravelPlace, TravelTimeline, TravelVisit } from "./travel-types";

const localPath = path.join(process.cwd(), "data/brain/travel/travel-timeline.v1.json");

const recentJourneyPlaces: TravelPlace[] = [
  { id: "e95d0380-7ae4-5e7f-b94a-d7d3ccdd922b", slug: "sarajevo", sourceName: "Sarajevo", name: "Sarajevo", placeType: "populated_place", countryCode: "BA", countryName: "Bosnia and Herzegovina", latitude: 43.8563, longitude: 18.4131, coordinatesState: "editorial", reviewState: "approved" },
  { id: "df9f8e37-0889-5d22-b129-b40815618a53", slug: "jajce", sourceName: "Jajce", name: "Jajce", placeType: "populated_place", countryCode: "BA", countryName: "Bosnia and Herzegovina", latitude: 44.342029, longitude: 17.270593, coordinatesState: "editorial", reviewState: "approved" },
];
const recentJourneyVisits: TravelVisit[] = [
  { id: "7b65a195-9a9b-577f-add3-8358a87d80f4", placeId: recentJourneyPlaces[0].id, visitKind: "visit", sourcePosition: 102, groupPosition: 1, chronologyIndex: 112, start: { year: 2026, month: 8 }, end: { year: 2026, month: 8 }, temporalPrecision: "month", sourceDateText: "August 2026", sourceValue: "Sarajevo", sourceRawLine: "Joe flew Warsaw → Sarajevo, then traveled to Jajce", reviewState: "approved" },
  { id: "323a7d12-5a8f-5ede-9047-8f6d5d6154e5", placeId: recentJourneyPlaces[1].id, visitKind: "visit", sourcePosition: 103, groupPosition: 1, chronologyIndex: 113, start: { year: 2026, month: 8 }, end: { year: 2026, month: 8 }, temporalPrecision: "month", sourceDateText: "August 2026", sourceValue: "Jajce", sourceRawLine: "Joe flew Warsaw → Sarajevo, then traveled to Jajce", reviewState: "approved" },
];

function withRecentJourney(timeline: TravelTimeline): TravelTimeline {
  const places = [...timeline.places];
  const visits = [...timeline.visits];
  for (const place of recentJourneyPlaces) if (!places.some((item) => item.id === place.id)) places.push(place);
  for (const visit of recentJourneyVisits) if (!visits.some((item) => item.id === visit.id)) visits.push(visit);
  visits.sort((a, b) => a.chronologyIndex - b.chronologyIndex);
  return { ...timeline, places, visits, stats: { ...timeline.stats, visits: visits.length, uniquePlaces: places.length, resolvedPlaces: places.filter((place) => place.latitude != null).length } };
}

async function localTimeline(): Promise<TravelTimeline> {
  return withRecentJourney(JSON.parse(await readFile(localPath, "utf8")));
}

async function allRows(client: any, view: string, order?: string) {
  const rows: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client.from(view).select("*");
    if (order) query = query.order(order);
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new Error(`Supabase ${view}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function getTravelTimeline(): Promise<TravelTimeline> {
  if (process.env.BRAIN_DATA_SOURCE !== "supabase") return localTimeline();
  const url = process.env.BRAIN_SUPABASE_URL;
  const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Staging Brain travel reads require BRAIN_SUPABASE_URL and BRAIN_SUPABASE_ANON_KEY.");
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [placeRows, visitRows, overviewRows, movementRows, currentRows] = await Promise.all([
    allRows(client, "brain_public_places", "name"),
    allRows(client, "brain_public_travel_visits", "chronology_index"),
    allRows(client, "brain_public_travel_overview"),
    allRows(client, "brain_public_travel_movements", "source_position"),
    allRows(client, "brain_public_current_state"),
  ]);
  const places: TravelPlace[] = placeRows.map((row) => ({
    id: row.id, slug: row.slug, sourceName: row.source_name, name: row.name, placeType: row.place_type,
    countryCode: row.country_code, countryName: row.country_name, latitude: row.latitude, longitude: row.longitude,
    coordinatesState: row.coordinates_state, reviewState: row.editorial_state,
  }));
  const visits: TravelVisit[] = visitRows.map((row) => ({
    id: row.id, placeId: row.place_id, visitKind: row.visit_kind, sourcePosition: row.source_position,
    groupPosition: row.group_position, chronologyIndex: row.chronology_index,
    start: { year: row.start_year, month: row.start_month }, end: { year: row.end_year, month: row.end_month },
    temporalPrecision: row.temporal_precision, sourceDateText: row.source_date_text,
    sourceValue: row.source_value, sourceRawLine: row.source_raw_line, publicBlurb: row.public_blurb || null, reviewState: row.editorial_state,
  }));
  const countries = Array.from(new Set(places.map((place) => place.countryName))).sort();
  const overview = overviewRows[0] || {};
  const current = currentRows[0]?.state?.where;
  const unresolved = places.filter((place) => place.latitude == null).map((place) => place.sourceName);
  return withRecentJourney({
    schemaVersion: "synergetic-travel-timeline.supabase.v1", generatedFrom: overview.source_url,
    sourceSnapshot: { id: overview.id, capturedOn: overview.captured_on, contentHash: overview.content_hash, intro: overview.intro || {} },
    stats: { sourceRecords: 101, visits: visits.length, movements: movementRows.length, uniquePlaces: places.length, countries: countries.length, resolvedPlaces: places.length - unresolved.length, unresolvedPlaces: unresolved.length },
    countries, places, visits, movements: movementRows,
    currentState: current ? { location: { canonical_name: current.city, country_code: "BA", country_name: current.country, state: "approved", provenance: { authority: "Joe Burt", recorded_at: currentRows[0].last_confirmed_at } } } : undefined,
    review: { unresolvedPlaceLabels: unresolved, currentLocationConflict: { sourceLatest: "warsaw", existingOsNow: current?.city || "Unreported", decision: "resolved_keep_chronology_and_now_separate" } },
    mapAttribution: "GeoNames geographical database, CC BY 4.0",
  });
}
