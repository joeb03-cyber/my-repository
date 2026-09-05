import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request) {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as any;
  const action = String(input?.action || "");
  const bookId = String(input?.bookId || "");
  if (!uuid.test(bookId)) return NextResponse.json({ error: "Choose a valid Library book." }, { status: 400 });
  const { data: book, error: bookError } = await auth.supabase.from("books").select("entity_id").eq("entity_id", bookId).maybeSingle();
  if (bookError || !book) return NextResponse.json({ error: "That book is not available." }, { status: 404 });

  if (action === "prepare") {
    const size = Number(input?.size || 0);
    if (!size || size > 8 * 1024 * 1024) return NextResponse.json({ error: "The prepared cover must be 8 MB or smaller." }, { status: 400 });
    const assetId = crypto.randomUUID();
    const path = `book-covers/control-center/manual/${bookId}/${assetId}.webp`;
    const signed = await auth.supabase.storage.from("brain-public-media").createSignedUploadUrl(path);
    if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });
    return NextResponse.json({ assetId, path, signedUrl: signed.data.signedUrl });
  }

  if (action === "finalize") {
    const assetId = String(input?.assetId || "");
    if (!uuid.test(assetId)) return NextResponse.json({ error: "Invalid cover upload." }, { status: 400 });
    const path = `book-covers/control-center/manual/${bookId}/${assetId}.webp`;
    const width = Math.max(1, Number(input?.width || 0));
    const height = Math.max(1, Number(input?.height || 0));
    const byteSize = Math.max(1, Number(input?.byteSize || 0));
    // Finalize is called only after the signed upload returns 2xx. Storage
    // directory listings can lag immediately afterward and caused false
    // verification failures for otherwise successful phone uploads.
    const { error: mediaError } = await auth.supabase.from("media_assets").insert({
      id: assetId, kind: "book_cover", storage_path: path, provider: "manual_control_center",
      provider_identifier: `${bookId}:${assetId}`, mime_type: "image/webp", byte_size: byteSize,
      width, height, sha256: String(input?.sha256 || "").slice(0, 128) || null,
      confidence: 1, editorial_state: "approved",
      provenance: { source: "control_center_manual_cover", suppliedBy: auth.user.id, suppliedAt: new Date().toISOString(), canonicalOverride: true },
    });
    if (mediaError) return NextResponse.json({ error: mediaError.message }, { status: 500 });
    const { error: updateError } = await auth.supabase.from("books").update({ cover_asset_id: assetId }).eq("entity_id", bookId);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true, bookId, coverPath: path });
  }

  return NextResponse.json({ error: "Unknown cover action." }, { status: 400 });
}
