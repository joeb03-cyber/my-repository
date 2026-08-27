import { NextResponse } from "next/server";
import { getPeopleSourcesIndex } from "@/lib/brain/people.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getPeopleSourcesIndex(), { headers: { "Cache-Control": "public, max-age=300" } });
}
