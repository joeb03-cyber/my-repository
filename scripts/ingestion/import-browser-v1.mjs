import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
const namespace = "11c0b884-c3d8-489c-8099-f8a590d9e81c";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Browser import is locked to the acknowledged staging Brain.");
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !url.includes(expectedRef)) throw new Error("The staging service connection is not configured.");
const db = createClient(url, key, { auth: { persistSession: false } });
const source = JSON.parse(await readFile(new URL("../../data/brain/browser.v1.json", import.meta.url), "utf8"));

const allRelated = new Map();
for (const hole of source.rabbitHoles) for (const link of hole.related) allRelated.set(link.slug, link.title);
const publishedSlugs = new Set(source.rabbitHoles.map((hole) => hole.slug));
const draftRows = [...allRelated].filter(([slug]) => !publishedSlugs.has(slug)).map(([slug,title], index) => ({
  id: uuidv5(`rabbit:${slug}`, namespace), slug, title, central_question: "", short_intro: "", current_take: "",
  status: "open", accent: "ocean", publication_state: "draft", visibility: "private", editorial_state: "needs_review",
  sort_order: 500 + index * 10, provenance: { source: "stage15_research_map", public_shell_only: true },
}));
const publicRows = source.rabbitHoles.map((hole) => ({
  id: hole.id, slug: hole.slug, title: hole.title, central_question: hole.centralQuestion,
  short_intro: hole.shortIntro, current_take: hole.currentTake, status: hole.status, accent: hole.accent,
  publication_state: "published", visibility: "public", editorial_state: "approved", sort_order: hole.sortOrder,
  provenance: { source: "stage15_private_research_plus_editorial_interview", interview_authoritative_for_joe_view: true },
}));
let result = await db.from("rabbit_holes").upsert([...publicRows,...draftRows], { onConflict: "id" });
if (result.error) throw result.error;

const blocks = source.rabbitHoles.flatMap((hole) => hole.blocks.map((block) => ({
  id: block.id, rabbit_hole_id: hole.id, block_type: block.type, heading: block.heading, body: block.body,
  items: block.items, sort_order: block.sortOrder, provenance: { source: "curated_browser_v1" },
})));
const resources = source.rabbitHoles.flatMap((hole) => hole.resources.map((item) => ({
  id: item.id, rabbit_hole_id: hole.id, title: item.title, url: item.url, resource_type: item.resourceType,
  note: item.note, public_role: item.publicRole, evidence_layer: item.evidenceLayer, sort_order: item.sortOrder,
  provenance: { source: "stage15_source_matrix", reviewed_for_public_pilot: true },
})));
result = await db.from("rabbit_hole_blocks").upsert(blocks, { onConflict: "id" }); if (result.error) throw result.error;
result = await db.from("rabbit_hole_resources").upsert(resources, { onConflict: "id" }); if (result.error) throw result.error;

await db.from("rabbit_hole_entity_links").delete().in("rabbit_hole_id", publicRows.map((row) => row.id));
const entityLinks = [];
for (const hole of source.rabbitHoles) for (const link of hole.entities) {
  const { data: entity, error } = await db.from("entities").select("id").eq("slug", link.entitySlug).maybeSingle();
  if (error) throw error;
  if (!entity) { console.warn(`Entity relationship unresolved: ${link.entitySlug}`); continue; }
  entityLinks.push({ rabbit_hole_id: hole.id, entity_id: entity.id, label: link.label, public_role: link.publicRole, evidence_layer: "model", sort_order: link.sortOrder, provenance: { source: "browser_v1_editorial_relationship" } });
}
if (entityLinks.length) { result = await db.from("rabbit_hole_entity_links").insert(entityLinks); if (result.error) throw result.error; }

await db.from("rabbit_hole_links").delete().in("from_rabbit_hole_id", publicRows.map((row) => row.id));
const idsBySlug = new Map([...publicRows,...draftRows].map((row) => [row.slug,row.id]));
const trailLinks = source.rabbitHoles.flatMap((hole) => hole.related.map((link) => ({
  from_rabbit_hole_id: hole.id, to_rabbit_hole_id: idsBySlug.get(link.slug), label: link.label,
  sort_order: link.sortOrder, provenance: { source: "stage15_natural_trail_map" },
})));
if (trailLinks.length) { result = await db.from("rabbit_hole_links").insert(trailLinks); if (result.error) throw result.error; }

const humanReplacements = [
  { slug:"psychoemotional-health-is-physical", section:"inner_life", relationship_state:"believe_matters", entry_type:"principle", title:"Psychoemotional Health Is Physical", summary:"I think the emotional, psychospiritual, and field-level parts of a person can be upstream of what shows up physically.", current_take:"I don't experience mind and body as separate systems. Repressed emotion, chronic stress, meaning, and the structure of a life can all become physical. Somatic and altered-state exploration have sometimes helped me access things that analysis did not. I use that as an operating lens, not a claim that one model explains every symptom.", supporting_details:["Ask what else was happening when something began.","Listen to what the body is doing before immediately trying to suppress it.","Experience and explanation are separate questions."], sort_order:30 },
  { slug:"reduce-wireless-exposure", section:"environment", relationship_state:"do_this", entry_type:"practice", title:"Reduce Wireless Exposure", summary:"I take a few simple EMF precautions without making my life revolve around them.", current_take:"I use airplane mode when my phone is in my pocket and while I sleep, keep devices away from the bed, use wired headphones instead of AirPods, and would hardwire more of my home if I had a permanent one. Distance and timing are easy wins. I care about this, but I don't want to live in fear of an environment I can't completely control.", supporting_details:["Airplane mode in my pocket and at night.","Wired headphones and distance from devices.","A lower-wireless sleep environment when practical."], sort_order:35 },
].map((entry) => ({ id:uuidv5(`human:${entry.slug}`, "bd2c691d-2016-44d2-8307-7bc65f9dc102"), ...entry, publication_state:"published", visibility:"public", editorial_state:"approved", provenance:{ source:"browser_v1_human_boundary_cleanup" } }));
result = await db.from("human_entries").update({ publication_state:"archived", visibility:"private" }).eq("section","frontiers"); if (result.error) throw result.error;
result = await db.from("human_entries").upsert(humanReplacements, { onConflict:"id" }); if (result.error) throw result.error;

await db.from("rabbit_hole_human_links").delete().in("rabbit_hole_id", publicRows.map((row) => row.id));
const humanLinks = [];
for (const hole of source.rabbitHoles) for (const link of hole.humanLinks) {
  const { data: entry, error } = await db.from("human_entries").select("id").eq("slug",link.humanEntrySlug).maybeSingle();
  if (error) throw error;
  if (!entry) { console.warn(`Human relationship unresolved: ${link.humanEntrySlug}`); continue; }
  humanLinks.push({ rabbit_hole_id:hole.id, human_entry_id:entry.id, browser_label:link.browserLabel, human_label:link.humanLabel, sort_order:link.sortOrder, provenance:{ source:"browser_v1_cross_link" } });
}
if (humanLinks.length) { result = await db.from("rabbit_hole_human_links").insert(humanLinks); if (result.error) throw result.error; }

console.log(JSON.stringify({ publishedRabbitHoles:publicRows.length, draftTrailShells:draftRows.length, blocks:blocks.length, resources:resources.length, entityLinks:entityLinks.length, trailLinks:trailLinks.length, humanLinks:humanLinks.length, humanReplacements:humanReplacements.length }, null, 2));
