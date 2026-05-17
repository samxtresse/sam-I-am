import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth";
import { sendOutreach, cancelOutreach, updateOutreach } from "@/lib/tools/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: "send" | "cancel" | "update";
  subject?: string;
  body?: string;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!hasSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const payload = (await req.json().catch(() => ({}))) as Body;
  try {
    let result;
    switch (payload.action) {
      case "send":
        result = await sendOutreach(id);
        break;
      case "cancel":
        result = await cancelOutreach(id);
        break;
      case "update":
        result = await updateOutreach(id, {
          subject: typeof payload.subject === "string" ? payload.subject : undefined,
          body: typeof payload.body === "string" ? payload.body : undefined,
        });
        break;
      default:
        return NextResponse.json({ error: "action required" }, { status: 400 });
    }
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
