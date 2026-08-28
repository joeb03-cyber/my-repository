import { createClient } from "@supabase/supabase-js";
import { groundedConversations } from "../../data/messages.ts";

const expectedRef = "agzcvkdmlrumuqefbtcb";
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey || !url.includes(expectedRef) || process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Isolated staging validation connection is required.");
const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const expectedNames = ["Joe Hudson", "Ellen J. Langer", "Bruce Lipton", "Madhava Setty", "Andy Galpin", "Steven Young", "David R. Hawkins", "Gabor Maté", "Rolf Potts", "Kevin Kelly", "Richard Schwartz", "Lynne McTaggart", "Paul Millerd"];
const { data: contacts, count, error } = await anon.from("brain_public_contacts").select("display_name,factual_identity", { count: "exact" });
if (error || count !== 37) throw new Error(`Expected 37 public Contacts after Messages selection; received ${count}: ${error?.message || "count mismatch"}`);
for (const name of expectedNames) {
  const contact = contacts.find((item) => item.display_name === name);
  if (!contact || !contact.factual_identity) throw new Error(`Messages Contact is missing or has no identity: ${name}`);
}
const exchangeCounts = groundedConversations.map((item) => item.exchanges.length);
if (groundedConversations.length !== 13 || exchangeCounts.some((count) => count < 4 || count > 8) || new Set(exchangeCounts).size < 3) throw new Error("Messages release must contain thirteen conversations, each with 4–8 exchanges and varied thread lengths.");
if (groundedConversations.some((item) => item.exchanges.some((exchange) => !exchange.sources.length))) throw new Error("Every reconstructed answer must expose at least one source.");
console.log(JSON.stringify({ status: "valid", publicContacts: count, conversations: groundedConversations.length, exchangeCounts, exchanges: groundedConversations.reduce((sum, item) => sum + item.exchanges.length, 0), everyAnswerHasSource: true }, null, 2));
