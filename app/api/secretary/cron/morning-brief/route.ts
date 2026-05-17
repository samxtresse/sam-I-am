import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runMorningBrief } from "@/lib/morning-brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily cron — Mon-Fri at 16:00 UTC (08:00 PT). Composes a brief from
// calendar + inbox + todos + approvals via Claude and sends it via Gmail
// to env.owner.email. Slack delivery lands in a follow-up once the bot
// is wired.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runMorningBrief({ send: true });
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      composed_preview: result.composed.slice(0, 400),
      composed_length: result.composed.length,
      triggered_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
