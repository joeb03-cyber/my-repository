import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing import outside staging.");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Staging Supabase environment is required.");
const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== process.env.BRAIN_IMPORT_PROJECT_REF || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Staging guard failed.");

const client = createClient(url, key, { auth: { persistSession: false } });
const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const id = (key) => uuidv5(`stage-13:${key}`, namespace);

const softwareUpdate = {
  id: id("software-update:41.x"),
  version_label: "41.x",
  new_items: ["Building Synergetic Human OS", "Experimenting with AI-assisted creation"],
  exploring_items: ["Traveling through Bosnia", "Reading Cosmos and Psyche", "Exploring planetary transits"],
  performance_items: ["More creative energy going toward curiosity, building, writing, exploration, and making things", "Attempting to turn years of collected information into something useful"],
  known_issue_items: ["Capable of opening too many rabbit holes simultaneously", "Unclear how much information is too much"],
  publication_state: "published",
  effective_at: "2026-08-28T19:00:00+02:00",
};
const { error: updateError } = await client.from("software_update_snapshots").upsert(softwareUpdate);
if (updateError) throw new Error(`software_update_snapshots: ${updateError.message}`);
const { error: archiveUpdateError } = await client.from("software_update_snapshots").update({ publication_state: "archived" }).neq("id", softwareUpdate.id).eq("publication_state", "published");
if (archiveUpdateError) throw new Error(`archive software updates: ${archiveUpdateError.message}`);

const previousPrototypeIds = [
  "a3bef66e-d759-4a63-9514-49a46d2a4001", "a3bef66e-d759-4a63-9514-49a46d2a4002",
  "a3bef66e-d759-4a63-9514-49a46d2a4003", "a3bef66e-d759-4a63-9514-49a46d2a4004",
];
const { error: hideError } = await client.from("os_trash_records").update({ visibility: "private" }).in("id", previousPrototypeIds);
if (hideError) throw new Error(`hide prototype trash: ${hideError.message}`);

const trash = [
  { key: "day-trader", title: "Become a Day Trader", description: "Short-term trading and watching markets too closely. Trading itself remains installed.", category: "former plan" },
  { key: "optimize-health", title: "Optimize Every Health Variable", description: "Every possible health variable, all at once.", category: "deprecated operating mode" },
  { key: "lease-life", title: "One-Year Lease Life", description: "The assumption that home requires a long lease and one fixed place.", category: "former default" },
  { key: "atheism", title: "Atheism", description: "Status: complicated.", category: "belief" },
].map((item, index) => ({ id: id(`trash:${item.key}`), title: item.title, description: item.description, category: item.category, trashed_at: null, state: "trashed", visibility: "public", sort_order: (index + 1) * 10 }));
const { error: trashError } = await client.from("os_trash_records").upsert(trash);
if (trashError) throw new Error(`os_trash_records: ${trashError.message}`);

const activity = [
  { key: "os", name: "Synergetic Human OS", status: "running", detail: "Turning years of collected information into something useful.", started_label: "August 2026", related_items: ["AI", "Creativity", "Notes", "Books"] },
  { key: "bosnia", name: "Bosnia", status: "running", detail: "The current region and immediate field of exploration.", started_label: "2026", related_items: ["Maps", "Walking", "Travel"] },
  { key: "ai", name: "AI-assisted creation", status: "running", detail: "A tool for building, organizing, and making things—not an author of Joe.", started_label: "2026", related_items: ["Synergetic Human OS", "Writing"] },
  { key: "transits", name: "Planetary Transits", status: "background", detail: "An open question rather than a settled conclusion.", started_label: null, related_items: ["Cosmos and Psyche", "Astrology"] },
  { key: "trading", name: "Trading", status: "background", detail: "Still present, with less interest in watching every short-term movement.", started_label: null, related_items: ["Markets"] },
  { key: "newsletter", name: "Newsletter", status: "sleeping", detail: "No longer installed as an obligation.", started_label: null, related_items: ["Writing", "Archive"] },
].map(({ key: processKey, ...item }, index) => ({ id: id(`activity:${processKey}`), ...item, visibility: "public", editorial_state: "approved", lifecycle_state: "active", sort_order: (index + 1) * 10 }));
const { error: activityError } = await client.from("activity_monitor_processes").upsert(activity);
if (activityError) throw new Error(`activity_monitor_processes: ${activityError.message}`);

console.log(JSON.stringify({ softwareUpdates: 1, trash: trash.length, activity: activity.length }));
