import { NextResponse } from "next/server";
import { getBooksIndex } from "@/lib/brain/books.server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBooksIndex(), { headers: { "Cache-Control": "public, max-age=300" } });
}
