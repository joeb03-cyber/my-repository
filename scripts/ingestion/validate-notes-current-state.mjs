import { createClient } from "@supabase/supabase-js";

if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing validation outside staging.");
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) throw new Error("Staging Supabase environment is incomplete.");
const projectRef = new URL(url).hostname.split(".")[0];
if (projectRef !== process.env.BRAIN_IMPORT_PROJECT_REF) throw new Error("Target project-ref mismatch.");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const [{ data: publicNotes, error: notesError }, { data: current, error: currentError }, { data: baseAnon, error: baseAnonError }, { data: drafts, error: draftError }] = await Promise.all([
  anon.from("brain_public_notes").select("id,slug,title"),
  anon.from("brain_public_current_state").select("id,state"),
  anon.from("brain_notes").select("entity_id,publication_state"),
  service.from("brain_notes").select("entity_id,publication_state,entities!inner(slug,visibility)").eq("publication_state", "draft"),
]);

expect(!notesError, `Public Notes view failed: ${notesError?.message}`);
expect(!currentError, `Public current-state view failed: ${currentError?.message}`);
expect(!draftError, `Protected draft validation failed: ${draftError?.message}`);
expect(baseAnonError?.message?.includes("permission denied"), "Anonymous role unexpectedly received base-table access.");
expect(publicNotes.length === 5, `Expected 5 public notes, got ${publicNotes.length}.`);
expect(!publicNotes.some((item) => item.slug === "work-with-me-biofield-tuning"), "Protected Work With Me draft leaked into public view.");
expect(current.length === 1, `Expected one public current-state snapshot, got ${current.length}.`);
expect(baseAnon === null, "Anonymous base-table query unexpectedly returned rows.");
expect(drafts.length === 1 && drafts[0].entities.slug === "work-with-me-biofield-tuning", "Expected exactly one protected Work With Me draft.");
expect(current[0].state.humanBattery.level === null, "Human Battery must remain null until manually reported.");

console.log(JSON.stringify({ publicNotes: publicNotes.length, publicCurrentStateSnapshots: current.length, anonBaseTableAccess: "denied", protectedDrafts: drafts.length, workWithMePublic: false, humanBatteryInferred: false }, null, 2));
