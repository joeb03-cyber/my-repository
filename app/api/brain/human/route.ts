import { NextResponse } from "next/server";
import { getHumanIndex } from "@/lib/brain/human.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getHumanIndex(), { headers: { "Cache-Control": "public, max-age=30" } });
}
