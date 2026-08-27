import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [htmlPath, outputDir] = process.argv.slice(2);

if (!htmlPath || !outputDir) {
  console.error("Usage: node extract-bookshelf-source.mjs <page.html> <output-dir>");
  process.exit(1);
}

const pageUrl = "https://www.synergetichuman.com/notes/books";
const html = await readFile(htmlPath, "utf8");
const flightChunks = [];
const chunkPattern = /<script>self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)<\/script>/g;

for (const match of html.matchAll(chunkPattern)) {
  flightChunks.push(JSON.parse(match[1]));
}

const flightPayload = flightChunks.join("");
const textMarker = /f:T([0-9a-f]+),/i.exec(flightPayload);

if (!textMarker) {
  throw new Error("Could not locate the Books note text payload in the Next.js response.");
}

const byteLength = Number.parseInt(textMarker[1], 16);
const payloadAfterMarker = flightPayload.slice(textMarker.index + textMarker[0].length);
const sourceMarkdown = Buffer.from(payloadAfterMarker, "utf8").subarray(0, byteLength).toString("utf8");
const sourceHash = createHash("sha256").update(sourceMarkdown).digest("hex");
const fetchedAt = new Date().toISOString();
const lines = sourceMarkdown.split(/\r?\n/);
const records = [];
const unparsedBullets = [];
let section = null;
let sourcePosition = 0;

for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
  const line = lines[lineIndex].trim();
  const sectionMatch = /^\*\*(.+)\*\*$/.exec(line);
  if (sectionMatch) {
    section = sectionMatch[1].trim();
    continue;
  }
  if (!line.startsWith("* ")) continue;
  sourcePosition += 1;

  // Keep malformed source URLs identifiable and exact. `hhttps://` occurs twice on
  // the live page and is intentionally captured rather than silently corrected.
  const links = [...line.matchAll(/\[([^\]]+)\]\((h?https?:\/\/[^)]+)\)/g)].map((match) => ({
    label: match[1],
    url: match[2],
    raw: match[0],
  }));
  const titleLink = links.find((link) => !/highlight/i.test(link.label));
  const highlightLink = links.find((link) => /docs\.google\.com\/document\//i.test(link.url) || /highlight/i.test(link.label));

  if (!titleLink) {
    unparsedBullets.push({ source_position: sourcePosition, source_line: lineIndex + 1, source_text: line, reason: "No identifiable title link" });
    continue;
  }

  const withoutLinks = links.reduce((text, link) => text.replace(link.raw, link.label), line.slice(2));
  const authorMatch = /\s+by\s+(.+?)(?:(?:\s+[—–-]\s+)?\s*my highlights|\s*$)/i.exec(withoutLinks);
  const amazonOrExternalUrl = titleLink.url;
  const sourceWarnings = [];
  if (!/^https?:\/\//i.test(amazonOrExternalUrl)) {
    sourceWarnings.push("external_book_url is malformed in the source");
  }

  records.push({
    source_position: sourcePosition,
    source_line: lineIndex + 1,
    source_section: section,
    title_displayed: titleLink.label,
    displayed_author: authorMatch?.[1]?.trim() ?? null,
    external_book_url: amazonOrExternalUrl,
    highlights_url: highlightLink?.url ?? null,
    source_text: line,
    source_warnings: sourceWarnings,
  });
}

const inventory = {
  schema_version: "bookshelf-inventory.v1",
  generated_at: fetchedAt,
  source: {
    url: pageUrl,
    fetched_at: fetchedAt,
    content_sha256: sourceHash,
    extraction_method: "Next.js flight text payload → Markdown bullets",
  },
  constraints: {
    titles_and_authors_are_source_display_values: true,
    urls_are_preserved_exactly: true,
    metadata_enrichment_performed: false,
  },
  records,
  extraction_issues: unparsedBullets,
};

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "bookshelf-source.v1.md"), sourceMarkdown);
await writeFile(path.join(outputDir, "bookshelf-inventory.v1.json"), `${JSON.stringify(inventory, null, 2)}\n`);

console.log(JSON.stringify({
  source_bytes: byteLength,
  source_sha256: sourceHash,
  records: records.length,
  with_highlights: records.filter((record) => record.highlights_url).length,
  without_highlights: records.filter((record) => !record.highlights_url).length,
  unparsed_bullets: unparsedBullets.length,
}, null, 2));
