import { NextResponse } from "next/server";
import { getOsState } from "@/lib/brain/os-state.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getOsState(), { headers: { "Cache-Control": "public, max-age=30" } });
}
