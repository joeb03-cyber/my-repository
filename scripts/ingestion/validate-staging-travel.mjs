import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) throw new Error("Staging Supabase URL, service key, and anonymous key are required.");
const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== process.env.BRAIN_IMPORT_PROJECT_REF || process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing validation outside the explicitly matched staging project.");
const expected = JSON.parse(await readFile("data/brain/travel/import-v1/manifest.json", "utf8")).counts;
const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

for (const [table, count] of Object.entries(expected)) {
  const { count: actual, error } = await service.from(table).select("*", { count: "exact", head: true });
  if (error || actual !== count) throw new Error(`${table}: expected ${count}, received ${actual}; ${error?.message || "count mismatch"}`);
}
for (const [view, count] of [["brain_public_places",104],["brain_public_travel_visits",110],["brain_public_travel_movements",1],["brain_public_photos",0]]) {
  const { count: actual, error } = await anon.from(view).select("*", { count: "exact", head: true });
  if (error || actual !== count) throw new Error(`${view}: expected anonymous count ${count}, received ${actual}; ${error?.message || "count mismatch"}`);
}
for (const table of ["travel_places","travel_visits","photo_private_metadata"]) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  if (!error && data?.length) throw new Error(`${table}: anonymous base-table data unexpectedly readable`);
}
const { error: privateColumnError } = await anon.from("brain_public_photos").select("exact_latitude").limit(1);
if (!privateColumnError) throw new Error("brain_public_photos unexpectedly exposes exact_latitude");
const approvedNames = {"st. petersburg":"St. Petersburg","isabela":"Isabela","antigua":"Antigua Guatemala","la libertad":"La Libertad","santiago":"Santiago","polignano de mare":"Polignano a Mare"};
const { data: approvedRows, error: approvedError } = await anon.from("brain_public_places").select("source_name,name,editorial_state").in("source_name", Object.keys(approvedNames));
if (approvedError || approvedRows?.length !== 6) throw new Error(`Approved travel identities unavailable: ${approvedError?.message || approvedRows?.length}`);
for (const row of approvedRows) if (row.name !== approvedNames[row.source_name] || row.editorial_state !== "approved") throw new Error(`Editorial identity mismatch for ${row.source_name}`);
const { data: sourceRows, error: sourceError } = await service.from("travel_source_snapshots").select("source_metadata").limit(1);
const now = sourceRows?.[0]?.source_metadata?.editorial_decisions?.current_state?.location;
if (sourceError || now?.canonical_name !== "Jajce" || now?.country_name !== "Bosnia and Herzegovina" || now?.state !== "approved") throw new Error("Approved NOW location is missing from protected travel provenance.");
console.log(JSON.stringify({status:"valid",projectRef,counts:expected,anonymousViews:{places:104,visits:110,movements:1,photos:0},privatePhotoGpsExposed:false,approvedIdentityCorrections:6,approvedNow:"Jajce, Bosnia and Herzegovina"},null,2));
