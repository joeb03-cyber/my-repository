import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";
import { bookDisplayTitleOverrides, hiddenPublicBookSlugs } from "../../lib/brain/books-editorial.ts";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing import outside staging.");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Staging Supabase environment is required.");
const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== process.env.BRAIN_IMPORT_PROJECT_REF || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Staging guard failed.");

const client = createClient(url, key, { auth: { persistSession: false } });

for (const [slug, title] of Object.entries(bookDisplayTitleOverrides)) {
  const { error } = await client.from("entities").update({ title }).eq("kind", "book").eq("slug", slug);
  if (error) throw new Error(`title ${slug}: ${error.message}`);
}
const { error: hideError } = await client.from("entities").update({ visibility: "excluded" }).eq("kind", "book").in("slug", [...hiddenPublicBookSlugs]);
if (hideError) throw new Error(`hide public books: ${hideError.message}`);

const namespace = "cd16dcf0-a399-4c71-93bc-abaf07f31a65";
const activity = [
  { key: "nomadic-life", name: "Nomadic Life", status: "running", detail: "Living between places as an ongoing operating condition.", related_items: ["Maps", "Travel"] },
  { key: "information-collection", name: "Information Collection", status: "running", detail: "A long-running habit of gathering books, sources, notes, and questions.", related_items: ["Books", "Notes", "Archive"] },
  { key: "os", name: "Synergetic Human OS", status: "running", detail: "Turning years of collected information into something useful.", started_label: "August 2026", related_items: ["Notes", "Books"] },
  { key: "trading", name: "Trading", status: "background", detail: "Still installed without occupying the foreground.", related_items: ["Markets"] },
  { key: "healing", name: "Healing", status: "background", detail: "A long-running personal process, described without measurement.", related_items: ["Human"] },
  { key: "newsletter", name: "Newsletter", status: "not_responding", detail: "The process exists; it is not currently answering requests.", related_items: ["Writing", "Archive"] },
].map(({ key: processKey, ...item }, index) => ({
  id: uuidv5(`stage-13.5:activity:${processKey}`, namespace), ...item, started_label: item.started_label || null,
  visibility: "public", editorial_state: "approved", lifecycle_state: "active", sort_order: (index + 1) * 10,
}));

const activityIds = activity.map((item) => item.id);
const { error: archiveError } = await client.from("activity_monitor_processes").update({ lifecycle_state: "archived", visibility: "private" }).not("id", "in", `(${activityIds.join(",")})`).eq("lifecycle_state", "active");
if (archiveError) throw new Error(`archive old activity: ${archiveError.message}`);
const { error: activityError } = await client.from("activity_monitor_processes").upsert(activity);
if (activityError) throw new Error(`activity: ${activityError.message}`);

console.log(JSON.stringify({ titleCorrections: Object.keys(bookDisplayTitleOverrides).length, hiddenPublicBooks: hiddenPublicBookSlugs.size, activity: activity.length }));
