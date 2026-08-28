import { createClient } from "@supabase/supabase-js";
import { v5 as uuidv5 } from "uuid";

const expectedRef = "agzcvkdmlrumuqefbtcb";
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef || process.env.BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION !== "yes") throw new Error("Messages Contacts import is locked to isolated staging.");
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !url.includes(expectedRef)) throw new Error("Staging service connection is required.");
const db = createClient(url, key, { auth: { persistSession: false } });
const namespace = "0d3c8542-ae4b-4317-a918-254462cbdf8b";
const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const targets = [
  { name: "Joe Hudson", identity: "Founder of the Art of Accomplishment and a coach focused on emotion, self-discovery, relationships, and leadership.", sources: ["https://www.artofaccomplishment.com/about", "https://www.youtube.com/watch?v=vF4R9uDje0E"] },
  { name: "Ellen J. Langer", identity: "Harvard psychology professor whose research examines mindfulness, mindlessness, context, and the mind-body relationship.", sources: ["https://mbb.harvard.edu/people/ellen-langer", "/library/the-mindful-body"] },
  { name: "Bruce Lipton", identity: "Cell biologist and author known for extending ideas about environmental signaling and epigenetics into a broader theory of belief and biology.", sources: ["https://www.brucelipton.com/media-kit/"] },
  { name: "Madhava Setty", identity: "Physician, engineer, and independent writer whose work questions institutional narratives, including the official account of 9/11.", sources: ["https://madhavasetty.substack.com/p/uniting-911-truth-and-medical-freedom"] },
  { name: "Andy Galpin", identity: "Human-performance researcher and coach working across strength, conditioning, recovery, and performance nutrition.", sources: ["https://www.andygalpin.com/", "https://www.performpodcast.com/"] },
  { name: "Steven Young", identity: "Former theoretical physicist, musician, and author of A Fool’s Wisdom, exploring alchemy and critiques of scientific authority.", sources: ["https://www.youtube.com/watch?v=YOeZcIOUMas", "/library/a-fool-s-wisdom"] },
  { name: "David R. Hawkins", identity: "Psychiatrist and spiritual teacher whose books explore surrender, nonduality, the ego, and a proposed map of consciousness.", sources: ["https://www.penguinrandomhouse.com/books/601456/transcending-the-levels-of-consciousness-by-david-r-hawkins-md-phd/"] },
  { name: "Gabor Maté", identity: "Physician and author whose work focuses on trauma, addiction, childhood development, authenticity, and stress-related illness.", sources: ["https://drgabormate.com/trauma/", "/library/myth-of-normal"] },
];

const { data: people, error: peopleError } = await db.from("people").select("entity_id,display_name,normalized_name,factual_identity");
if (peopleError) throw peopleError;
const personByNormalized = new Map(people.map((person) => [normalize(person.display_name), person]));
const published = [];
for (const target of targets) {
  const person = personByNormalized.get(normalize(target.name));
  if (!person) throw new Error(`Existing Person entity not found for ${target.name}; refusing to invent a duplicate identity.`);
  const { error: personError } = await db.from("people").update({ contact_publication_state: "published", factual_identity: target.identity, identity_review_state: "approved" }).eq("entity_id", person.entity_id);
  if (personError) throw personError;
  const { error: entityError } = await db.from("entities").update({ visibility: "public", lifecycle_state: "active", editorial_state: "approved" }).eq("id", person.entity_id);
  if (entityError) throw entityError;
  const { data: existing, error: assertionLookupError } = await db.from("editorial_assertions").select("id").eq("target_entity_id", person.entity_id).eq("assertion_type", "interesting").eq("asserted_by", "joe_burt").maybeSingle();
  if (assertionLookupError) throw assertionLookupError;
  if (existing) {
    const { error } = await db.from("editorial_assertions").update({ approval_state: "approved", visibility: "public", endorsement: false }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("editorial_assertions").insert({ id: uuidv5(`messages-contact:${person.entity_id}`, namespace), target_entity_id: person.entity_id, assertion_type: "interesting", approval_state: "approved", context_domain: "Messages / source-grounded conversation", note: "Joe explicitly selected this person for a source-grounded Messages conversation.", asserted_by: "joe_burt", endorsement: false, visibility: "public", provenance: { source: "joe_direct_selection_2026_08_28", identitySources: target.sources, conversationIsReconstruction: true } });
    if (error) throw error;
  }
  published.push({ name: person.display_name, id: person.entity_id });
}

console.log(JSON.stringify({ status: "complete", publishedContacts: published, messagesConversations: targets.length }, null, 2));
