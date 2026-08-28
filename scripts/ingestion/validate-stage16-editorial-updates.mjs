import { createClient } from "@supabase/supabase-js";

const expectedRef = "agzcvkdmlrumuqefbtcb";
const url = process.env.SUPABASE_URL || process.env.BRAIN_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey || !url.includes(expectedRef)) throw new Error("Staging validation credentials are required.");
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging" || process.env.BRAIN_IMPORT_PROJECT_REF !== expectedRef) throw new Error("Refusing validation outside isolated staging.");
const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const expectedBooks = [
  ["what-your-body-wants-you-to-know", "What Your Body Wants You to Know", "Lauren Hill"],
  ["you-can-just-do-things", "You Can Just Do Things", "Cate Hall"],
  ["just-keep-buying", "Just Keep Buying", "Nick Maggiulli"],
];
const { data: books, count: bookCount, error: bookError } = await anon.from("brain_public_books").select("id,slug,title,original_author", { count: "exact" });
if (bookError || bookCount !== 166) throw new Error(`Expected 166 public books; received ${bookCount}: ${bookError?.message || "count mismatch"}`);
for (const [slug, title, author] of expectedBooks) {
  const row = books.find((book) => book.slug === slug);
  if (!row || row.title !== title || row.original_author !== author) throw new Error(`Public book mismatch: ${slug}`);
  const { count, error } = await anon.from("brain_public_highlights").select("*", { count: "exact", head: true }).eq("book_id", row.id);
  if (error || !count) throw new Error(`No public passages for ${slug}: ${error?.message || "empty"}`);
}

const { data: contacts, count: contactCount, error: contactError } = await anon.from("brain_public_contacts").select("display_name,topics,books", { count: "exact" });
if (contactError || contactCount !== 28) throw new Error(`Expected 28 public Contacts; received ${contactCount}: ${contactError?.message || "count mismatch"}`);
if (contacts.some((contact) => contact.display_name === "Aleena Kanner")) throw new Error("Aleena Kanner remains public.");
const madhava = contacts.find((contact) => contact.display_name === "Madhava Setty");
if (!madhava) throw new Error("Madhava Setty is missing from Contacts.");
const madhavaTopics = new Set((madhava.topics || []).map((topic) => topic.slug));
if (!madhavaTopics.has("topic-truth-institutions-hidden-history") || !madhavaTopics.has("topic-society-culture-systems")) throw new Error("Madhava Setty's corrected topics are incomplete.");
if ([...madhavaTopics].some((slug) => /health|biology|longevity/.test(slug))) throw new Error(`Madhava Setty still exposes the rejected health framing: ${[...madhavaTopics].join(", ")}`);

const mustHaveMultipleBooks = ["Anna Wise", "Catherine Ponder", "David Deida", "David R. Hawkins", "Erich Fromm", "Frederick Dodson", "Gabor Maté", "Gay Hendricks", "Joel S. Goldsmith", "Kapil Gupta", "Lao Russell", "Manly Palmer Hall", "Paul Selig"];
for (const name of mustHaveMultipleBooks) {
  const contact = contacts.find((row) => row.display_name === name);
  if (!contact || (contact.books || []).length < 2) throw new Error(`Multi-book Contact rule failed for ${name}`);
}

const { data: stateRows, error: stateError } = await anon.from("brain_public_current_state").select("state").limit(1);
const where = stateRows?.[0]?.state?.where;
if (stateError || where?.city !== "Jajce" || where?.country !== "Bosnia and Herzegovina") throw new Error("Public current state is not Jajce, Bosnia and Herzegovina.");
const { count: placeCount, error: placeError } = await anon.from("brain_public_places").select("*", { count: "exact", head: true });
if (placeError || placeCount !== 104) throw new Error(`Expected 104 public places; received ${placeCount}: ${placeError?.message || "count mismatch"}`);
const { data: jajce, error: jajceError } = await anon.from("brain_public_places").select("name,country_name,latitude,longitude").eq("name", "Jajce").maybeSingle();
if (jajceError || !jajce || jajce.country_name !== "Bosnia and Herzegovina") throw new Error("Jajce is missing from Maps places.");

for (const table of ["sources", "source_versions", "source_fragments", "editorial_assertions"]) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  if (!error && data?.length) throw new Error(`${table} unexpectedly exposes protected records anonymously.`);
}
const { count: publishedStates, error: publishedStateError } = await service.from("current_state_snapshots").select("*", { count: "exact", head: true }).eq("publication_state", "published");
if (publishedStateError || publishedStates !== 1) throw new Error(`Expected exactly one published current-state snapshot; received ${publishedStates}.`);

console.log(JSON.stringify({ status: "valid", publicBooks: bookCount, addedBooks: expectedBooks.length, publicContacts: contactCount, multiBookContactRule: mustHaveMultipleBooks.length, aleenaPublic: false, madhavaTopics: [...madhavaTopics], currentLocation: `${where.city}, ${where.country}`, publicPlaces: placeCount, protectedEditorialTablesAnonymous: false }, null, 2));
