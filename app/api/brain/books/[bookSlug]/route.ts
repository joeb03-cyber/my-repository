import { NextRequest, NextResponse } from "next/server";
import { getBookDetail } from "@/lib/brain/books.server";

export async function GET(request: NextRequest, { params }: { params: { bookSlug: string } }) {
  const detail = await getBookDetail(params.bookSlug);
  if (!detail) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  const includeReview = process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("review") === "1";
  if (!includeReview) {
    const { review: _review, ...publicDetail } = detail;
    return NextResponse.json(publicDetail, { headers: { "Cache-Control": "public, max-age=300" } });
  }
  return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
}
