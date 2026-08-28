import { createClient } from "@supabase/supabase-js";
import { groundedConversations } from "../../data/messages.ts";

const expectedRef = "agzcvkdmlrumuqefbtcb";
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey || !url.includes(expectedRef) || process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Isolated staging validation connection is required.");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const expectedNames = ["Joe Hudson", "Ellen J. Langer", "Bruce Lipton", "Madhava Setty", "Andy Galpin", "Steven Young", "David R. Hawkins", "Gabor Maté"];
const { data: contacts, count, error } = await anon.from("brain_public_contacts").select("display_name,factual_identity", { count: "exact" });
if (error || count !== 33) throw new Error(`Expected 33 public Contacts after Messages selection; received ${count}: ${error?.message || "count mismatch"}`);
for (const name of expectedNames) {
  const contact = contacts.find((item) => item.display_name === name);
  if (!contact || !contact.factual_identity) throw new Error(`Messages Contact is missing or has no identity: ${name}`);
}
if (groundedConversations.length !== 8 || groundedConversations.some((item) => item.exchanges.length !== 3)) throw new Error("Messages pilot must contain eight conversations with three grounded exchanges each.");
if (groundedConversations.some((item) => item.exchanges.some((exchange) => !exchange.sources.length))) throw new Error("Every reconstructed answer must expose at least one source.");
console.log(JSON.stringify({ status: "valid", publicContacts: count, conversations: groundedConversations.length, exchanges: groundedConversations.reduce((sum, item) => sum + item.exchanges.length, 0), everyAnswerHasSource: true }, null, 2));
