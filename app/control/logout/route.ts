import { NextResponse } from "next/server";
import { createBrainAuthClient } from "@/lib/brain/control-auth.server";

export async function POST(request: Request) {
  await createBrainAuthClient().auth.signOut();
  return NextResponse.redirect(new URL("/control/login", request.url), { status: 303 });
}
