import { createClient } from "@supabase/supabase-js";

const url = process.env.BRAIN_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("Staging URL, anon key, and service-role key are required.");
const projectRef = new URL(url).hostname.split(".")[0];
if (process.env.BRAIN_IMPORT_PROJECT_REF !== projectRef || process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing validation against an unmatched/non-staging project.");

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const read = async (client, view) => {
  const { data, error } = await client.from(view).select("*");
  if (error) throw new Error(`${view}: ${error.message}`);
  return data || [];
};

const contacts = await read(anon, "brain_public_contacts");
const episodes = await read(anon, "brain_public_podcast_episodes");
if (contacts.length !== 15) throw new Error(`Expected 15 anonymous Contacts, received ${contacts.length}.`);
if (episodes.length !== 15) throw new Error(`Expected 15 anonymous episodes, received ${episodes.length}.`);
const serialized = JSON.stringify({ contacts, episodes }).toLowerCase();
for (const forbidden of ["private_locator", "raw_text", "summary_body", "journal", "transcript", "/users/", "downloads/"]) {
  if (serialized.includes(forbidden)) throw new Error(`Anonymous views expose forbidden marker: ${forbidden}`);
}
if (contacts.some((row) => row.endorsement !== false || row.curated_interest !== true)) throw new Error("Anonymous curated-interest semantics are invalid.");

const { count: curatedCount, error: curatedError } = await service.from("editorial_assertions").select("id", { count: "exact", head: true }).eq("assertion_type", "interesting").eq("approval_state", "approved").eq("asserted_by", "joe_burt");
if (curatedError) throw curatedError;
const { count: leverageCount, error: leverageError } = await service.from("editorial_assertions").select("id", { count: "exact", head: true }).eq("assertion_type", "high_leverage");
if (leverageError) throw leverageError;
if (curatedCount !== 62) throw new Error(`Expected 62 curated-interest assertions, received ${curatedCount}.`);
if (leverageCount !== 0) throw new Error(`Expected zero High Leverage assertions, received ${leverageCount}.`);
console.log(JSON.stringify({ anonymous_contacts: contacts.length, anonymous_podcast_episodes: episodes.length, curated_interest_assertions: curatedCount, high_leverage_assertions: leverageCount, private_markers_exposed: false }, null, 2));
