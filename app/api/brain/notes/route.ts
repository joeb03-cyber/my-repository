import { NextResponse } from "next/server";
import { getNotesIndex } from "@/lib/brain/notes.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getNotesIndex(), { headers: { "Cache-Control": "public, max-age=300" } });
}
