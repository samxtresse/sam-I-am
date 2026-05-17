import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth";
import { addAllowlist, listAllowlist, removeAllowlist } from "@/lib/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const entries = await listAllowlist();
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  if (!hasSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    notes?: string;
  };
  if (typeof body.email !== "string" || !body.email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }
  try {
    const entry = await addAllowlist(body.email, body.notes);
    return NextResponse.json({ entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  if (!hasSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  await removeAllowlist(email);
  return NextResponse.json({ ok: true });
}
