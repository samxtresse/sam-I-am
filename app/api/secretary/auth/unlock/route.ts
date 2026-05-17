import { NextResponse } from "next/server";
import { checkToken, setSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = typeof body.token === "string" ? body.token : "";
  if (!checkToken(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  setSessionCookie();
  return NextResponse.json({ ok: true });
}
