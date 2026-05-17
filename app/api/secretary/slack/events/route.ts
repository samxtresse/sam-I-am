import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Slack DM bot webhook. Every DM goes through the same agent loop as web chat.
// v1: scaffold — verify signing secret, dispatch to agent, persist Slack-thread→chat-thread mapping.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { type?: string; challenge?: string };
  // Slack URL verification handshake.
  if (body.type === "url_verification" && typeof body.challenge === "string") {
    return NextResponse.json({ challenge: body.challenge });
  }
  return NextResponse.json({
    ok: true,
    todo: "v1.1: verify SLACK_SIGNING_SECRET, gate on SLACK_OWNER_USER_ID, run agent loop, post reply",
  });
}
