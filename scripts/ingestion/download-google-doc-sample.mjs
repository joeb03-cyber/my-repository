import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [inventoryPath, positionsArgument, outputDir] = process.argv.slice(2);

if (!inventoryPath || !positionsArgument || !outputDir) {
  console.error("Usage: node download-google-doc-sample.mjs <inventory.json> <comma-separated-positions> <output-dir>");
  process.exit(1);
}

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const positions = positionsArgument.split(",").map((value) => Number.parseInt(value, 10));
const requested = positions.map((position) => inventory.records.find((record) => record.source_position === position));

if (requested.some((record) => !record?.highlights_url)) {
  throw new Error("Every requested source position must identify a book with a highlights URL.");
}

function documentId(url) {
  return /\/document\/d\/([^/]+)/.exec(url)?.[1] ?? null;
}

function safeName(title) {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

await mkdir(outputDir, { recursive: true });
const results = [];

for (const record of requested) {
  const id = documentId(record.highlights_url);
  const exportUrl = `https://docs.google.com/document/d/${id}/export?format=docx`;
  const response = await fetch(exportUrl, { redirect: "follow" });
  const contentType = response.headers.get("content-type");
  const body = Buffer.from(await response.arrayBuffer());
  const fileName = `${String(record.source_position).padStart(3, "0")}-${safeName(record.title_displayed)}.docx`;
  const filePath = path.join(outputDir, fileName);

  if (!response.ok || !contentType?.includes("wordprocessingml.document")) {
    results.push({
      source_position: record.source_position,
      title_displayed: record.title_displayed,
      highlights_url: record.highlights_url,
      http_status: response.status,
      content_type: contentType,
      downloaded: false,
      response_bytes: body.byteLength,
    });
    continue;
  }

  await writeFile(filePath, body);
  results.push({
    source_position: record.source_position,
    title_displayed: record.title_displayed,
    displayed_author: record.displayed_author,
    highlights_url: record.highlights_url,
    document_id: id,
    http_status: response.status,
    content_type: contentType,
    downloaded: true,
    bytes: body.byteLength,
    local_file: fileName,
  });
}

await writeFile(path.join(outputDir, "sample-download-manifest.json"), `${JSON.stringify({
  generated_at: new Date().toISOString(),
  note: "Temporary parser-discovery downloads; document content is not intended for version control.",
  results,
}, null, 2)}\n`);

console.log(JSON.stringify(results, null, 2));
