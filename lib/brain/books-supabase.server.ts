import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { BrainBookDetail, BrainBookSummary, BrainBooksIndex, BrainContentUnit, BrainPassageGroup, BrainTopic } from "./types";

type Row = Record<string, any>;

function client() {
  const url = process.env.BRAIN_SUPABASE_URL;
  const anonKey = process.env.BRAIN_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("BRAIN_SUPABASE_URL and BRAIN_SUPABASE_ANON_KEY are required when BRAIN_DATA_SOURCE=supabase");
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function rows(view: string, query?: (value: any) => any): Promise<Row[]> {
  let request = client().from(view).select("*");
  if (query) request = query(request);
  const { data, error } = await request;
  if (error) throw new Error(`Supabase ${view}: ${error.message}`);
  return data || [];
}

function topicsFor(bookId: string, topicRows: Row[]): BrainTopic[] {
  return topicRows.filter((row) => row.book_id === bookId).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((row) => ({
    slug: row.slug,
    label: row.label,
    confidence: Number(row.confidence ?? 0),
    editorialState: row.editorial_state || "suggested",
  }));
}

function authorsFor(bookId: string, authorRows: Row[], fallback?: string | null): string[] {
  const authors = authorRows.filter((row) => row.book_id === bookId).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((row) => row.display_name);
  return authors.length ? authors : fallback ? [fallback] : [];
}

function summary(row: Row, authorRows: Row[], topicRows: Row[], highlightCounts: Map<string, number>): BrainBookSummary {
  return {
    id: row.id,
    slug: row.slug,
    sourcePosition: row.source_position,
    title: row.title,
    originalTitle: row.original_title,
    subtitle: row.subtitle,
    authors: authorsFor(row.id, authorRows, row.original_author),
    topics: topicsFor(row.id, topicRows),
    cover: row.cover_path ? {
      status: "cached",
      public_path: row.cover_path.startsWith("/") ? row.cover_path : `/${row.cover_path}`,
      source_url: row.cover_source_url,
      provider: row.cover_provider,
      provider_id: row.cover_provider_id,
      width: row.cover_width,
      height: row.cover_height,
    } : { status: "placeholder", public_path: "/book-covers/placeholder.svg" },
    highlightCount: highlightCounts.get(row.id) || 0,
    importState: row.import_state === "complete" ? "complete" : "incomplete",
    metadataStatus: row.metadata_status,
    reviewFlagCount: 0,
  };
}

export async function getSupabaseBooksIndex(): Promise<BrainBooksIndex> {
  const [bookRows, authorRows, topicRows, highlightRows] = await Promise.all([
    rows("brain_public_books", (query) => query.order("source_position")),
    rows("brain_public_book_authors"),
    rows("brain_public_book_topics"),
    rows("brain_public_highlights"),
  ]);
  const counts = new Map<string, number>();
  for (const row of highlightRows) if (!["chapter_label", "section_label"].includes(row.content_kind)) counts.set(row.book_id, (counts.get(row.book_id) || 0) + 1);
  const books = bookRows.map((row) => summary(row, authorRows, topicRows, counts));
  return { schemaVersion: "brain-books-index.supabase.v1", bookCount: books.length, generatedFrom: "staging Supabase public views", books };
}

function unit(row: Row): BrainContentUnit {
  return {
    id: row.id,
    sourceUnitKey: row.source_unit_key,
    ordinal: row.ordinal,
    text: row.text,
    kind: row.content_kind,
    sectionPath: row.section_path || [],
    locator: row.locator,
    standoutRank: row.standout_rank,
    classificationConfidence: Number(row.classification_confidence ?? 1),
    publicEligible: true,
  };
}

export async function getSupabaseBookDetail(slug: string): Promise<BrainBookDetail | null> {
  const index = await getSupabaseBooksIndex();
  const base = index.books.find((book) => book.slug === slug);
  if (!base) return null;
  const [highlightRows, groupRows, linkRows, relatedRows] = await Promise.all([
    rows("brain_public_highlights", (query) => query.eq("book_id", base.id).order("ordinal")),
    rows("brain_public_passage_groups", (query) => query.eq("book_id", base.id).order("ordinal").order("member_ordinal")),
    rows("brain_public_book_links", (query) => query.eq("book_id", base.id)),
    rows("brain_public_related_books", (query) => query.eq("book_id", base.id).order("rank")),
  ]);
  const units = highlightRows.map(unit);
  const byId = new Map(units.map((item) => [item.id, item]));
  const grouped = new Map<string, BrainPassageGroup>();
  const groupedUnitIds = new Set<string>();
  for (const row of groupRows) {
    const member = byId.get(row.highlight_id);
    if (!member) continue;
    groupedUnitIds.add(member.id);
    const existing = grouped.get(row.id) || {
      id: row.id,
      ordinal: row.ordinal,
      kind: ["chapter_label", "section_label"].includes(member.kind) ? "structure" : "passage",
      confidence: Number(row.confidence ?? 1),
      groupingMethod: row.grouping_method,
      rationale: "Imported presentation grouping",
      units: [],
    } as BrainPassageGroup;
    existing.units.push(member);
    grouped.set(row.id, existing);
  }
  // Structural labels are deliberately not passage-group table rows. Restore
  // them as standalone display groups so the staging reader matches the local
  // read model without turning headings into passages.
  for (const item of units) if (!groupedUnitIds.has(item.id)) grouped.set(`structure-${item.id}`, {
    id: `structure-${item.id}`,
    ordinal: item.ordinal,
    kind: ["chapter_label", "section_label"].includes(item.kind) ? "structure" : "passage",
    confidence: 1,
    groupingMethod: ["chapter_label", "section_label"].includes(item.kind) ? "structural" : "conservative_rules_v1",
    rationale: ["chapter_label", "section_label"].includes(item.kind) ? "structural label" : "standalone public unit",
    units: [item],
  });
  const passageGroups = Array.from(grouped.values()).sort((a, b) => a.units[0].ordinal - b.units[0].ordinal);
  const link = (type: string) => linkRows.find((row) => row.link_type === type)?.url || null;
  return {
    schemaVersion: "brain-book-detail.supabase.v1",
    ...base,
    standouts: units.filter((item) => item.standoutRank).sort((a, b) => (a.standoutRank || 9) - (b.standoutRank || 9)),
    readerUnits: units,
    passageGroups,
    relatedBooks: relatedRows.map((row) => index.books.find((book) => book.id === row.related_book_id || book.slug === row.related_slug)).filter(Boolean) as BrainBookSummary[],
    links: {
      sourceHighlights: link("source_highlights"),
      externalReference: link("retail_reference"),
      providerRecord: link("provider_record") || link("book_information"),
    },
  };
}
