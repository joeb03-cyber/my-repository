import { NextResponse } from "next/server";
import { getControlAdmin } from "@/lib/brain/control-auth.server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/octet-stream"]);

export async function POST(request: Request) {
  const auth = await getControlAdmin();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as any;
  if (input?.uploadMode !== "optimized_publish_v3") return NextResponse.json({ error: "Control Center was updated. Refresh the page, then choose the photo again." }, { status: 409 });
  const name = String(input?.name || "photo").slice(0, 180);
  const size = Number(input?.size || 0);
  const type = String(input?.type || "application/octet-stream").toLowerCase();
  if (!size || size > 40 * 1024 * 1024) return NextResponse.json({ error: "Each source photo must be 40 MB or smaller." }, { status: 400 });
  if (!allowedTypes.has(type)) return NextResponse.json({ error: "Choose a JPEG, PNG, WebP, HEIC, or HEIF still image." }, { status: 400 });

  const assetId = crypto.randomUUID();
  const variants = ["small", "medium", "large"] as const;
  const requested = new Map((Array.isArray(input?.derivatives) ? input.derivatives : []).map((item: any) => [String(item.variant), item]));
  if (!variants.every((variant) => requested.has(variant))) return NextResponse.json({ error: "Small, medium, and large publishing copies are required." }, { status: 400 });
  const derivatives = await Promise.all(variants.map(async (variant) => {
    const item = requested.get(variant) as any;
    const mimeType = item?.mimeType === "image/jpeg" && item?.extension === "jpg" ? "image/jpeg" : item?.mimeType === "image/webp" && item?.extension === "webp" ? "image/webp" : null;
    if (!mimeType) throw new Error("Unsupported publishing image format.");
    const extension = mimeType === "image/webp" ? "webp" : "jpg";
    const path = `photos/control-center/${assetId}/${variant}.${extension}`;
    const result = await auth.supabase.storage.from("brain-public-media").createSignedUploadUrl(path);
    if (result.error) throw result.error;
    return { variant, path, mimeType, extension, signedUrl: result.data.signedUrl };
  }));
  return NextResponse.json({ assetId, uploadMode: "optimized_publish_v3", derivatives });
}
