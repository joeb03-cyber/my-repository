import { NextResponse } from "next/server";
import { getMessages } from "@/lib/brain/messages.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ conversations: await getMessages() }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
