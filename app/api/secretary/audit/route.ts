import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth";
import { sb, isStubMode } from "@/lib/supabase";
import { getStubAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id?: number;
  kind?: string;
  name?: string | null;
  input?: unknown;
  output?: unknown;
  duration_ms?: number | null;
  created_at?: string;
};

export async function GET() {
  if (!hasSession()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let rows: Row[];
  if (isStubMode()) {
    rows = getStubAudit().slice(-50).reverse();
  } else {
    rows = await sb.select<Row>("secretary_audit_log", {
      order: "created_at.desc",
      limit: "50",
    });
  }
  return NextResponse.json({ rows });
}
