import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads inbound messages on awaiting bookings and auto-confirms clear agreements.
// v1: scaffold — the real implementation lands once the booking-loop closure is wired.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    todo: "v1.1: walk pending bookings, fetch replies, auto-confirm allowlisted agreements",
    checked_at: new Date().toISOString(),
  });
}
