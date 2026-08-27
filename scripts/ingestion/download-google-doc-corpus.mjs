import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const [inventoryPath, auditPath, outputDir] = process.argv.slice(2);
if (!inventoryPath || !auditPath || !outputDir) {
  console.error("Usage: node download-google-doc-corpus.mjs <inventory.json> <audit.json> <output-dir>");
  process.exit(1);
}

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const recordsByPosition = new Map(inventory.records.map((record) => [record.source_position, record]));
const accessible = audit.results.filter((result) => result.publicly_exportable);
const concurrency = 5;
await mkdir(outputDir, { recursive: true });

function safeName(title) {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function download(result) {
  const record = recordsByPosition.get(result.source_position);
  const fileName = `${String(record.source_position).padStart(3, "0")}-${safeName(record.title_displayed)}.docx`;
  const filePath = path.join(outputDir, fileName);
  try {
    await access(filePath);
    const fileStats = await stat(filePath);
    if (fileStats.size > 500) {
      return { ...result, displayed_author: record.displayed_author, downloaded: true, bytes: fileStats.size, local_file: fileName, resumed_from_cache: true };
    }
  } catch {}

  const exportUrl = `https://docs.google.com/document/d/${result.document_id}/export?format=docx`;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(exportUrl, { redirect: "follow", signal: AbortSignal.timeout(30000) });
      const contentType = response.headers.get("content-type");
      const body = Buffer.from(await response.arrayBuffer());
      const looksLikeDocx = body[0] === 0x50 && body[1] === 0x4b;
      if (!response.ok || !looksLikeDocx) {
        lastError = `HTTP ${response.status}; ${contentType}; ${body.byteLength} bytes`;
      } else {
        await writeFile(filePath, body);
        return {
          source_position: record.source_position,
          title_displayed: record.title_displayed,
          displayed_author: record.displayed_author,
          highlights_url: record.highlights_url,
          document_id: result.document_id,
          http_status: response.status,
          content_type: contentType,
          downloaded: true,
          bytes: body.byteLength,
          local_file: fileName,
          resumed_from_cache: false,
        };
      }
    } catch (error) {
      lastError = `${error.name}: ${error.message}`;
    }
    await wait(500 * attempt);
  }
  return {
    source_position: record.source_position,
    title_displayed: record.title_displayed,
    displayed_author: record.displayed_author,
    highlights_url: record.highlights_url,
    document_id: result.document_id,
    downloaded: false,
    error: lastError,
  };
}

const results = [];
for (let offset = 0; offset < accessible.length; offset += concurrency) {
  const batch = accessible.slice(offset, offset + concurrency);
  results.push(...await Promise.all(batch.map(download)));
  process.stderr.write(`Downloaded/checked ${Math.min(offset + concurrency, accessible.length)}/${accessible.length}\n`);
}
results.sort((left, right) => left.source_position - right.source_position);

const manifest = {
  schema_version: "bookshelf-docx-download-manifest.v1",
  generated_at: new Date().toISOString(),
  note: "Temporary non-destructive DOCX exports for local parsing; do not commit the binary source files.",
  expected_publicly_exportable: accessible.length,
  downloaded: results.filter((result) => result.downloaded).length,
  failed: results.filter((result) => !result.downloaded).length,
  results,
};
await writeFile(path.join(outputDir, "sample-download-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ expected: accessible.length, downloaded: manifest.downloaded, failed: manifest.failed }, null, 2));
