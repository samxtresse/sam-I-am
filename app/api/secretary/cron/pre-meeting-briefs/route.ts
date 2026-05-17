import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runPreMeetingBriefs } from "@/lib/pre-meeting";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every 15 min: scans the next ~25 min of Sam's calendar and composes a
// short prep brief per event (deduped by calendar_event_id in
// secretary_pre_meeting_log). Slack DM delivery lands once the bot is wired.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const t0 = Date.now();
  try {
    const result = await runPreMeetingBriefs();
    void audit({
      kind: "cron",
      name: "pre-meeting-briefs",
      output: { scanned: result.scanned, outcomes: result.outcomes },
      duration_ms: Date.now() - t0,
    });
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      outcomes: result.outcomes,
      triggered_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
