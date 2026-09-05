import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream"]);

export async function POST(request: Request) {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as any;
  const name = String(input?.name || "photo").slice(0, 180);
  const size = Number(input?.size || 0);
  const type = String(input?.type || "application/octet-stream").toLowerCase();
  if (!size || size > 40 * 1024 * 1024) return NextResponse.json({ error: "Each original must be 40 MB or smaller." }, { status: 400 });
  if (!allowedTypes.has(type)) return NextResponse.json({ error: "Choose a JPEG, PNG, WebP, HEIC, or HEIF still image." }, { status: 400 });

  const assetId = crypto.randomUUID();
  const extension = (name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "jpg";
  const originalPath = `control-center/${auth.user.id}/${assetId}/original.${extension}`;
  const variants = ["small", "medium", "large"] as const;
  const original = await auth.supabase.storage.from("brain-photo-originals").createSignedUploadUrl(originalPath);
  if (original.error) return NextResponse.json({ error: original.error.message }, { status: 500 });
  const derivatives = await Promise.all(variants.map(async (variant) => {
    const path = `photos/control-center/${assetId}/${variant}.webp`;
    const result = await auth.supabase.storage.from("brain-public-media").createSignedUploadUrl(path);
    if (result.error) throw result.error;
    return { variant, path, signedUrl: result.data.signedUrl };
  }));
  return NextResponse.json({ assetId, original: { path: originalPath, signedUrl: original.data.signedUrl }, derivatives });
}
