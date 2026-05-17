import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth";
import { googleAuthUrl } from "@/lib/google";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  if (!hasSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!env.google.clientId || !env.google.clientSecret) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured" },
      { status: 400 },
    );
  }
  const state = crypto.randomUUID();
  return NextResponse.redirect(googleAuthUrl(state));
}
