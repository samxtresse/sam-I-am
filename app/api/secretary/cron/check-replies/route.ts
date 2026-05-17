import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runCheckReplies } from "@/lib/booking-loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every 30 minutes: walks sent booking outreach, parses replies, and
// auto-confirms clear agreements (creates calendar event + sends confirmation).
// Ambiguous replies are left for Sam to handle manually.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (env.cronSecret && auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runCheckReplies();
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
