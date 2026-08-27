import { NextResponse } from "next/server";
import { getTravelTimeline } from "@/lib/brain/travel.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getTravelTimeline(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Travel Brain read failed", error);
    return NextResponse.json({ error: "Travel timeline unavailable" }, { status: 503 });
  }
}
