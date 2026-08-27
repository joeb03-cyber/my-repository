import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.argv[2] || "data/brain/people-sources";
const files = [];
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(full);
    else files.push(full);
  }
}
await collect(root);

const forbiddenKeys = ["private_locator", "raw_text", "summary_body", "journal", "transcript", "source_snapshot", "ai_conversation"];
const forbiddenPathFragments = ["/Users/", "Downloads/", "Kortex Workspace:", "AI Chat History/", "My Writing/"];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const fragment of forbiddenPathFragments) if (text.includes(fragment)) throw new Error(`${file} contains forbidden private locator fragment: ${fragment}`);
  if (file.endsWith(".json") || file.endsWith(".jsonl")) {
    const rows = file.endsWith(".jsonl") ? text.trim().split("\n").filter(Boolean).map(JSON.parse) : [JSON.parse(text)];
    const visit = (value, trail = []) => {
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, [...trail, index]));
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (forbiddenKeys.includes(key)) throw new Error(`${file} contains forbidden key ${[...trail, key].join(".")}`);
        visit(child, [...trail, key]);
      }
    };
    rows.forEach((row) => visit(row));
  }
}

const index = JSON.parse(await readFile(path.join(root, "index.v1.json"), "utf8"));
if (index.contactCount !== 15 || index.contacts.length !== 15) throw new Error("Expected exactly 15 published Contacts.");
if (index.podcastEpisodeCount !== 15 || index.podcastEpisodes.length !== 15) throw new Error("Expected exactly 15 podcast episodes.");
if (index.contacts.some((person) => person.endorsement !== false || person.curatedInterest !== true)) throw new Error("Curated-interest semantics are invalid.");
if (index.contacts.some((person) => "startHere" in person || "relatedPeople" in person)) throw new Error("Unapproved Start Here or Related People data found.");
if (index.podcastEpisodes.some((episode) => !episode.originalUrl || !episode.credits.length)) throw new Error("Podcast metadata is incomplete.");
console.log(`Validated ${files.length} public-safe files, ${index.contactCount} Contacts, and ${index.podcastEpisodeCount} podcast episodes.`);
