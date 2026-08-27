import { readFile, writeFile } from "node:fs/promises";

const [inventoryPath, outputPath] = process.argv.slice(2);

if (!inventoryPath || !outputPath) {
  console.error("Usage: node audit-google-doc-links.mjs <inventory.json> <output.json>");
  process.exit(1);
}

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const linkedRecords = inventory.records.filter((record) => record.highlights_url);

function documentId(url) {
  return /\/document\/d\/([^/]+)/.exec(url)?.[1] ?? null;
}

async function probe(record) {
  const id = documentId(record.highlights_url);
  const exportUrl = id ? `https://docs.google.com/document/d/${id}/export?format=docx` : null;
  const checkedAt = new Date().toISOString();

  if (!exportUrl) {
    return {
      source_position: record.source_position,
      title_displayed: record.title_displayed,
      highlights_url: record.highlights_url,
      document_id: null,
      checked_at: checkedAt,
      publicly_exportable: false,
      error: "Could not extract a Google document ID",
    };
  }

  try {
    const response = await fetch(exportUrl, { method: "HEAD", redirect: "follow" });
    const contentType = response.headers.get("content-type");
    let publiclyExportable = response.ok && contentType?.includes("wordprocessingml.document");
    let verification = null;
    if (!publiclyExportable) {
      const getResponse = await fetch(exportUrl, { method: "GET", redirect: "follow" });
      const body = await getResponse.arrayBuffer();
      const getContentType = getResponse.headers.get("content-type");
      publiclyExportable = getResponse.ok && getContentType?.includes("wordprocessingml.document");
      verification = {
        method: "GET performed only because the HEAD response was anomalous",
        http_status: getResponse.status,
        content_type: getContentType,
        response_bytes: body.byteLength,
      };
    }
    return {
      source_position: record.source_position,
      title_displayed: record.title_displayed,
      highlights_url: record.highlights_url,
      document_id: id,
      checked_at: checkedAt,
      check_method: "HEAD request to public DOCX export endpoint; no document body downloaded",
      http_status: response.status,
      content_type: contentType,
      publicly_exportable: Boolean(publiclyExportable),
      anomalous_response_verification: verification,
      error: publiclyExportable ? null : "Export endpoint did not return a public DOCX response",
    };
  } catch (error) {
    return {
      source_position: record.source_position,
      title_displayed: record.title_displayed,
      highlights_url: record.highlights_url,
      document_id: id,
      checked_at: checkedAt,
      check_method: "HEAD request to public DOCX export endpoint; no document body downloaded",
      http_status: null,
      content_type: null,
      publicly_exportable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const results = new Array(linkedRecords.length);
let cursor = 0;
const workerCount = 6;

async function worker() {
  while (cursor < linkedRecords.length) {
    const index = cursor;
    cursor += 1;
    results[index] = await probe(linkedRecords[index]);
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));

const audit = {
  schema_version: "bookshelf-google-doc-link-audit.v1",
  generated_at: new Date().toISOString(),
  source_inventory: inventoryPath,
  method: "HEAD requests to all public Google Docs DOCX export endpoints; GET verification only for anomalous non-DOCX responses",
  summary: {
    links_checked: results.length,
    publicly_exportable: results.filter((result) => result.publicly_exportable).length,
    inaccessible_or_broken: results.filter((result) => !result.publicly_exportable).length,
  },
  results,
};

await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify(audit.summary, null, 2));
