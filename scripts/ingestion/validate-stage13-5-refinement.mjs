import { createClient } from "@supabase/supabase-js";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing validation outside staging.");
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) throw new Error("Staging Supabase environment is incomplete.");
if (new URL(url).hostname.split(".")[0] !== process.env.BRAIN_IMPORT_PROJECT_REF) throw new Error("Target project-ref mismatch.");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const [publicBooks, hiddenEntities, hiddenBookRows, activity, publicLinks, baseLinks, publicNotes, workDraft] = await Promise.all([
  anon.from("brain_public_books").select("id,slug,title"),
  service.from("entities").select("id,slug,title,visibility").in("slug", ["100m-offers", "1929"]),
  service.from("books").select("entity_id,original_title,source_position").in("source_position", [1, 2]),
  anon.from("brain_public_activity_processes").select("name,status").order("sort_order"),
  anon.from("brain_public_current_state_reading").select("snapshot_id,book_id"),
  anon.from("current_state_entity_links").select("snapshot_id,entity_id"),
  anon.from("brain_public_notes").select("slug"),
  service.from("brain_notes").select("publication_state,entities!inner(slug,visibility)").eq("entities.slug", "work-with-me-biofield-tuning").maybeSingle(),
]);

for (const result of [publicBooks, hiddenEntities, hiddenBookRows, activity, publicLinks, publicNotes, workDraft]) expect(!result.error, result.error?.message || "Validation query failed.");
expect(publicBooks.data.length === 163, `Expected 163 public Books, got ${publicBooks.data.length}.`);
expect(!publicBooks.data.some((book) => ["100m-offers", "1929"].includes(book.slug)), "Excluded Books leaked through the public view.");
expect(hiddenEntities.data.length === 2 && hiddenEntities.data.every((entity) => entity.visibility === "excluded"), "Excluded Books were not retained with non-public visibility.");
expect(hiddenBookRows.data.length === 2, "Underlying Book rows/provenance were not retained.");
expect(activity.data.length === 6, `Expected six Activity processes, got ${activity.data.length}.`);
expect(activity.data.map((item) => item.name).join("|") === "Nomadic Life|Information Collection|Synergetic Human OS|Trading|Healing|Newsletter", "Activity seed order/content differs from the accepted set.");
expect(!baseLinks.data && baseLinks.error?.message?.includes("permission denied"), "Anonymous role unexpectedly received current-state link table access.");
expect(Array.isArray(publicLinks.data), "Public Reading relationship view is unavailable.");
expect(!publicNotes.data.some((note) => note.slug === "work-with-me-biofield-tuning"), "Protected Work With Me draft leaked publicly.");
expect(workDraft.data?.publication_state === "draft" && workDraft.data.entities.visibility === "private", "Work With Me is not a protected private draft.");

console.log(JSON.stringify({ publicBooks: 163, hiddenSourceRecordsPreserved: 2, activityProcesses: 6, anonymousLinkBaseTable: "denied", publicReadingLinks: publicLinks.data.length, workWithMe: "private draft" }, null, 2));
