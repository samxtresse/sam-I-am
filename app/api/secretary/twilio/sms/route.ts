import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Twilio SMS / iMessage webhook. Same agent loop as web + Slack.
// v1: scaffold — gate on TWILIO_OWNER_NUMBER, run agent, return TwiML for ≤12s replies / REST API otherwise.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const from = form?.get("From");
  return NextResponse.json({
    ok: true,
    received_from: typeof from === "string" ? from : null,
    todo: "v1.1: validate Twilio signature, gate on TWILIO_OWNER_NUMBER, run agent, reply via TwiML or REST",
  });
}
