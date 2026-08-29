import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sizes = new Set(["small", "medium", "large"]);

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (process.env.BRAIN_DATA_SOURCE === "supabase") return new NextResponse(null, { status: 404 });
  const size = new URL(request.url).searchParams.get("size") || "medium";
  if (!uuidPattern.test(params.id) || !sizes.has(size)) return new NextResponse(null, { status: 404 });
  const file = path.join(process.cwd(), "artifacts/photo-curation/stage4/derivatives.private", params.id, `${size}.webp`);
  try {
    const body = await readFile(file);
    return new NextResponse(body, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
