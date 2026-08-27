import "server-only";

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TravelPlace, TravelTimeline, TravelVisit } from "./travel-types";

const localPath = path.join(process.cwd(), "data/brain/travel/travel-timeline.v1.json");

async function localTimeline(): Promise<TravelTimeline> {
  return JSON.parse(await readFile(localPath, "utf8"));
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
  const [placeRows, visitRows, overviewRows, movementRows] = await Promise.all([
    allRows(client, "brain_public_places", "name"),
    allRows(client, "brain_public_travel_visits", "chronology_index"),
    allRows(client, "brain_public_travel_overview"),
    allRows(client, "brain_public_travel_movements", "source_position"),
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
    sourceValue: row.source_value, sourceRawLine: row.source_raw_line, reviewState: row.editorial_state,
  }));
  const countries = Array.from(new Set(places.map((place) => place.countryName))).sort();
  const overview = overviewRows[0] || {};
  const unresolved = places.filter((place) => place.latitude == null).map((place) => place.sourceName);
  return {
    schemaVersion: "synergetic-travel-timeline.supabase.v1", generatedFrom: overview.source_url,
    sourceSnapshot: { id: overview.id, capturedOn: overview.captured_on, contentHash: overview.content_hash, intro: overview.intro || {} },
    stats: { sourceRecords: 101, visits: visits.length, movements: movementRows.length, uniquePlaces: places.length, countries: countries.length, resolvedPlaces: places.length - unresolved.length, unresolvedPlaces: unresolved.length },
    countries, places, visits, movements: movementRows,
    review: { unresolvedPlaceLabels: unresolved, currentLocationConflict: { sourceLatest: "warsaw", existingOsNow: "Sarajevo", decision: "unresolved_do_not_overwrite_now" } },
    mapAttribution: "GeoNames geographical database, CC BY 4.0",
  };
}
