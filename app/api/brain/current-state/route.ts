import { NextResponse } from "next/server";
import { getCurrentState } from "@/lib/brain/notes.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getCurrentState(), { headers: { "Cache-Control": "public, max-age=30" } });
}
