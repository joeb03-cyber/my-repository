import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";
import { downloadCover, findBookMetadata, normalizePerson, slugifyBook } from "@/lib/brain/book-intake.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as any;
  const title = String(input?.title || "").trim().slice(0, 180);
  const author = String(input?.author || "").trim().slice(0, 180);
  const highlightsReference = String(input?.highlightsReference || "").trim().slice(0, 4000) || null;
  if (!title) return NextResponse.json({ error: "Add the book title first." }, { status: 400 });
  if (!author) return NextResponse.json({ error: "Add the author so the Library entry is unambiguous." }, { status: 400 });
  const db = auth.supabase;

  try {
    const { data: existing, error: existingError } = await db.from("brain_public_books").select("id,slug,title,original_author,cover_path").ilike("title", title).limit(8);
    if (existingError) throw existingError;
    const duplicate = (existing || []).find((book) => normalizePerson(book.original_author || "") === normalizePerson(author));
    if (duplicate) {
      const { error } = await db.from("book_intake_requests").insert({ book_entity_id: duplicate.id, title, author, highlights_reference: highlightsReference, metadata_status: "matched", cover_status: duplicate.cover_path ? "cached" : "placeholder", highlights_status: highlightsReference ? "queued" : "not_provided", created_by: auth.user.id, provenance: { source: "control_center", duplicateMatched: true } });
      if (error) throw error;
      return NextResponse.json({ ok: true, existing: true, book: { id: duplicate.id, slug: duplicate.slug, title: duplicate.title, authors: [author], cover: coverPublicUrl(duplicate.cover_path) } });
    }

    const catalog = await findBookMetadata(title, author);
    const cover = await downloadCover(catalog?.coverUrl || null);
    let slug = slugifyBook(catalog?.title || title);
    const { data: slugRows, error: slugError } = await db.from("entities").select("slug").like("slug", `${slug}%`);
    if (slugError) throw slugError;
    const usedSlugs = new Set((slugRows || []).map((row) => row.slug));
    if (usedSlugs.has(slug)) { let suffix = 2; while (usedSlugs.has(`${slug}-${suffix}`)) suffix += 1; slug = `${slug}-${suffix}`; }

    const bookId = crypto.randomUUID();
    const authorNormalized = normalizePerson(author);
    const { data: existingPerson, error: personLookupError } = await db.from("people").select("entity_id,display_name").eq("normalized_name", authorNormalized).maybeSingle();
    if (personLookupError) throw personLookupError;
    const authorId = existingPerson?.entity_id || crypto.randomUUID();
    const { data: lastBook, error: positionError } = await db.from("books").select("source_position").order("source_position", { ascending: false }).limit(1).maybeSingle();
    if (positionError) throw positionError;
    const sourcePosition = Number(lastBook?.source_position || 0) + 1;
    let coverAssetId: string | null = null;
    let coverPath: string | null = null;

    if (cover) {
      coverAssetId = crypto.randomUUID();
      coverPath = `book-covers/control-center/${slug}.${cover.extension}`;
      const { error: uploadError } = await db.storage.from("brain-public-media").upload(coverPath, cover.bytes, { contentType: cover.contentType, upsert: false, cacheControl: "31536000" });
      if (uploadError) throw uploadError;
    }

    if (!existingPerson) {
      const initials = author.split(/\s+/).filter(Boolean).slice(0, 3).map((word) => word[0]).join("").toUpperCase();
      const { error: entityError } = await db.from("entities").insert({ id: authorId, kind: "person", slug: `person-${slugifyBook(author)}-${authorId.slice(0, 6)}`, title: author, visibility: "public", lifecycle_state: "active", editorial_state: "approved" });
      if (entityError) throw entityError;
      const { error: personError } = await db.from("people").insert({ entity_id: authorId, display_name: author, sort_name: author.split(/\s+/).at(-1), normalized_name: authorNormalized, initials, contact_publication_state: "hidden" });
      if (personError) throw personError;
    }
    const canonicalTitle = catalog?.title || title;
    const { error: bookEntityError } = await db.from("entities").insert({ id: bookId, kind: "book", slug, title: canonicalTitle, summary: catalog?.subtitle || null, visibility: "public", lifecycle_state: "incomplete", editorial_state: "approved" });
    if (bookEntityError) throw bookEntityError;
    if (coverAssetId && coverPath && cover) {
      const { error: mediaError } = await db.from("media_assets").insert({ id: coverAssetId, kind: "book_cover", storage_path: coverPath, source_url: catalog?.coverUrl, provider: "google_books", provider_identifier: catalog?.providerId, mime_type: cover.contentType, byte_size: cover.bytes.length, confidence: catalog?.score, editorial_state: "approved", provenance: { metadataRecord: catalog?.providerUrl, retrievedAt: new Date().toISOString(), providerTermsPreferred: true, noAmazonScrape: true } });
      if (mediaError) throw mediaError;
    }
    const { error: bookError } = await db.from("books").insert({ entity_id: bookId, source_position: sourcePosition, original_title: title, original_author: author, subtitle: catalog?.subtitle, isbn_10: catalog?.isbn10, isbn_13: catalog?.isbn13, publisher: catalog?.publisher, publication_date: catalog?.publishedDate, language_code: catalog?.language, cover_asset_id: coverAssetId, metadata_status: catalog ? "catalog_matched" : "source_only", metadata_confidence: catalog?.score || null, metadata_provenance: catalog ? { provider: "google_books", providerId: catalog.providerId, providerUrl: catalog.providerUrl, requestedTitle: title, requestedAuthor: author } : { source: "control_center", requestedTitle: title, requestedAuthor: author }, import_state: "incomplete", imported_at: new Date().toISOString(), import_version: "control-center-book-intake-v1" });
    if (bookError) throw bookError;
    const { data: relationshipType, error: relationshipTypeError } = await db.from("relationship_types").select("id").eq("key", "authored_by").single();
    if (relationshipTypeError) throw relationshipTypeError;
    const { error: relationshipError } = await db.from("relationships").insert({ id: crypto.randomUUID(), from_entity_id: bookId, relationship_type_id: relationshipType.id, to_entity_id: authorId, confidence: 1, rank: 1, context: { source: "control_center_book_intake" }, editorial_state: "approved" });
    if (relationshipError) throw relationshipError;
    const { error: intakeError } = await db.from("book_intake_requests").insert({ book_entity_id: bookId, title, author, highlights_reference: highlightsReference, metadata_status: catalog ? "matched" : "needs_review", cover_status: cover ? "cached" : "placeholder", highlights_status: highlightsReference ? "queued" : "not_provided", created_by: auth.user.id, provenance: { source: "control_center", catalogProvider: catalog ? "google_books" : null, catalogScore: catalog?.score || null } });
    if (intakeError) throw intakeError;
    return NextResponse.json({ ok: true, existing: false, book: { id: bookId, slug, title: canonicalTitle, authors: [author], cover: coverPublicUrl(coverPath) }, metadataMatched: Boolean(catalog), coverFound: Boolean(cover), highlightsQueued: Boolean(highlightsReference) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "The book could not be added." }, { status: 500 });
  }
}

function coverPublicUrl(path: string | null) {
  if (!path) return "/book-covers/placeholder.svg";
  if (path.startsWith("book-covers/control-center/")) return `${process.env.BRAIN_SUPABASE_URL}/storage/v1/object/public/brain-public-media/${path}`;
  return path.startsWith("/") ? path : `/${path}`;
}
