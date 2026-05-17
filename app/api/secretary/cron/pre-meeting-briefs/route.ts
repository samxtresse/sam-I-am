import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// For each meeting starting in the next 25 minutes, pulls recent email exchanges
// with attendees + long-term memory and composes a short prep brief.
// v1: scaffold — relies on secretary_pre_meeting_log dedupe table for idempotency.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    todo: "v1.1: scan calendar for meetings in next 25min, compose brief, push to Slack DM (dedupe via secretary_pre_meeting_log)",
    triggered_at: new Date().toISOString(),
  });
}
