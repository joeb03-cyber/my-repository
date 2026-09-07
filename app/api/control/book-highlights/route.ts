import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

export const dynamic = "force-dynamic";

function validGoogleDoc(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "docs.google.com" && /^\/document\/d\/[A-Za-z0-9_-]+(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as any;
  const bookEntityId = String(input?.bookEntityId || "").trim();
  const highlightsReference = String(input?.highlightsReference || "").trim().slice(0, 4000);
  if (!bookEntityId) return NextResponse.json({ error: "Choose a Book first." }, { status: 400 });
  if (!validGoogleDoc(highlightsReference)) return NextResponse.json({ error: "Paste a full Google Docs document link beginning with https://docs.google.com/document/d/" }, { status: 400 });

  const db = auth.supabase;
  try {
    const [{ data: book, error: bookError }, { data: latest, error: latestError }] = await Promise.all([
      db.from("brain_public_books").select("id,title,original_author,cover_path").eq("id", bookEntityId).maybeSingle(),
      db.from("book_intake_requests").select("id,highlights_reference,metadata_status,cover_status,highlights_status,created_at").eq("book_entity_id", bookEntityId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (bookError) throw bookError;
    if (latestError) throw latestError;
    if (!book) return NextResponse.json({ error: "That canonical Book could not be found." }, { status: 404 });
    if (latest?.highlights_reference === highlightsReference && latest.highlights_status !== "inaccessible") {
      return NextResponse.json({ ok: true, unchanged: true, status: latest.highlights_status });
    }

    const { error: insertError } = await db.from("book_intake_requests").insert({
      book_entity_id: book.id,
      title: book.title,
      author: book.original_author || null,
      highlights_reference: highlightsReference,
      metadata_status: latest?.metadata_status || "matched",
      cover_status: latest?.cover_status || (book.cover_path ? "cached" : "placeholder"),
      highlights_status: "queued",
      created_by: auth.user.id,
      provenance: {
        source: "control_center_existing_book_highlights",
        supersedesIntakeId: latest?.id || null,
        sourceKind: "google_doc",
        submittedAt: new Date().toISOString(),
      },
    });
    if (insertError) throw insertError;
    return NextResponse.json({ ok: true, unchanged: false, status: "queued" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "The highlights source could not be saved." }, { status: 500 });
  }
}
