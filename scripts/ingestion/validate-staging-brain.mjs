import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishable = process.env.BRAIN_SUPABASE_ANON_KEY;
if (!url || !secret || !publishable) throw new Error("Staging Supabase environment is incomplete.");
if (process.env.BRAIN_IMPORT_ENVIRONMENT !== "staging") throw new Error("Refusing validation outside staging.");

const expectedProjectRef = process.env.BRAIN_IMPORT_PROJECT_REF;
const actualProjectRef = new URL(url).hostname.split(".")[0];
if (!expectedProjectRef || expectedProjectRef !== actualProjectRef) throw new Error("Staging project-ref guard failed.");

const service = createClient(url, secret, { auth: { persistSession: false } });
const anonymous = createClient(url, publishable, { auth: { persistSession: false } });
const manifest = JSON.parse(await readFile("data/brain/import-manifest.v1.json", "utf8"));

async function exactCount(client, relation, configure = (query) => query) {
  const { count, error } = await configure(client.from(relation).select("*", { count: "exact", head: true }));
  return { count, error: error?.message || null };
}

const tableCounts = {};
for (const [table, expected] of Object.entries(manifest.tables)) {
  const result = await exactCount(service, table);
  if (result.error) throw new Error(`${table}: ${result.error}`);
  tableCounts[table] = result.count;
  if (result.count !== expected.rows) throw new Error(`${table}: expected ${expected.rows}, received ${result.count}`);
}

const publicBooks = await exactCount(anonymous, "brain_public_books");
const publicHighlights = await exactCount(anonymous, "brain_public_highlights");
const publicStandouts = await exactCount(anonymous, "brain_public_highlights", (query) => query.not("standout_rank", "is", null));
const incompleteBooks = await exactCount(anonymous, "brain_public_books", (query) => query.eq("import_state", "incomplete"));
const privateSummaries = await exactCount(service, "highlights", (query) => query.eq("content_kind", "possible_personal_summary"));
async function protectedProbe(relation) {
  const { data, error } = await anonymous.from(relation).select("*").limit(1);
  if (error) return { state: "permission_denied", rowCount: 0, error: error.message };
  return { state: data?.length ? "EXPOSED" : "zero_rows_under_rls", rowCount: data?.length || 0, error: null };
}
const anonymousBaseHighlights = await protectedProbe("highlights");
const anonymousIssues = await protectedProbe("ingestion_issues");

const publicChecks = {
  books: publicBooks.count,
  highlightsAndStructure: publicHighlights.count,
  standouts: publicStandouts.count,
  incompleteBooks: incompleteBooks.count,
};
if (publicBooks.error || publicBooks.count !== 165) throw new Error(`Public books validation failed: ${publicBooks.error || publicBooks.count}`);
if (publicHighlights.error || publicHighlights.count !== manifest.counts.publicReaderUnits) throw new Error(`Public highlights validation failed: ${publicHighlights.error || publicHighlights.count}`);
if (publicStandouts.error || publicStandouts.count !== 0) throw new Error("Generated standouts were exposed.");
if (incompleteBooks.error || incompleteBooks.count !== 8) throw new Error("Incomplete book preservation validation failed.");
if (privateSummaries.error || privateSummaries.count !== 3) throw new Error("Private summary preservation validation failed.");

const security = {
  possiblePersonalSummariesStoredPrivately: privateSummaries.count,
  anonymousBaseHighlights,
  anonymousEditorialIssues: anonymousIssues,
};
if ([security.anonymousBaseHighlights.state, security.anonymousEditorialIssues.state].includes("EXPOSED")) throw new Error(`An anonymous base/editorial table was exposed: ${JSON.stringify(security)}`);

console.log(JSON.stringify({
  valid: true,
  projectRef: actualProjectRef,
  tableCounts,
  publicChecks,
  security,
}, null, 2));
