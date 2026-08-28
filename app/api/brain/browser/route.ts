import { NextResponse } from "next/server";
import { getBrowserIndex } from "@/lib/brain/browser.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBrowserIndex(), {
    headers: { "Cache-Control": "public, max-age=30" },
  });
}
