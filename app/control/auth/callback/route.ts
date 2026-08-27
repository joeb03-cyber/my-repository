import { NextResponse } from "next/server";
import { createBrainAuthClient } from "@/lib/brain/control-auth.server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await createBrainAuthClient().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/control", url.origin));
  }
  return NextResponse.redirect(new URL("/control/login?error=link", url.origin));
}
