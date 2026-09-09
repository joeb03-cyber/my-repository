import { NextResponse } from "next/server";
import { getMessages } from "@/lib/brain/messages.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ conversations: await getMessages() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Messages could not be loaded." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
