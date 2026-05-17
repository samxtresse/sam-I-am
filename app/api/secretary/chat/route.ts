import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth";
import { runAgentTurn, type ChatMessage } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isChatMessage(x: unknown): x is ChatMessage {
  if (typeof x !== "object" || x === null) return false;
  const r = (x as { role?: unknown }).role;
  return r === "user" || r === "assistant";
}

export async function POST(req: Request) {
  if (!hasSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { messages?: unknown };
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const history = raw.filter(isChatMessage);
  if (!history.length) {
    return NextResponse.json({ error: "messages[] required" }, { status: 400 });
  }
  try {
    const result = await runAgentTurn(history);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
