import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Composes a morning brief covering today's calendar, unread email highlights,
// open TODOs, and pending approvals. Sends to Gmail (+ Slack DM if present).
// v1: scaffold — the live composer/sender lands once Gmail send + Slack are wired.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    todo: "v1.1: compose brief from calendar+inbox+todos+approvals, send via Gmail + Slack",
    scheduled_for: "Mon-Fri 08:00 PT",
    triggered_at: new Date().toISOString(),
  });
}
