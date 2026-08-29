import { NextResponse } from "next/server";
import { getLivedHistory } from "@/lib/brain/lived-history.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = await getLivedHistory();
    return NextResponse.json(history, {
      headers: { "Cache-Control": process.env.SITE_ENV === "staging" ? "private, no-store" : "public, max-age=60" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Travel photos unavailable" }, { status: 503 });
  }
}
