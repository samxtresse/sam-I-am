import { sb, isStubMode } from "@/lib/supabase";
import { draftEmail } from "./email";

type Input = Record<string, unknown>;
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

// In-memory allowlist for stub mode. Real allowlist lives in secretary_allowlist.
const STUB_ALLOWLIST = new Set<string>();
const STUB_PENDING: Record<string, unknown>[] = [];

async function isAllowlisted(email: string): Promise<boolean> {
  const lc = email.toLowerCase();
  if (isStubMode()) return STUB_ALLOWLIST.has(lc);
  const rows = await sb.select<{ email: string }>("secretary_allowlist", {
    email: `eq.${lc}`,
    limit: "1",
  });
  return rows.length > 0;
}

export async function proposeMeeting(input: Input): Promise<string> {
  const recipient = str(input.recipient_email).toLowerCase();
  const subject = str(input.subject);
  const body = str(input.body);
  const slotsRaw = Array.isArray(input.proposed_slots) ? (input.proposed_slots as unknown[]) : [];
  if (!recipient || !subject || !body || !slotsRaw.length) {
    return JSON.stringify({ error: "recipient_email, subject, body, proposed_slots required" });
  }

  // Always create a Gmail draft so Sam can see it in normal Drafts.
  const draftResult = JSON.parse(await draftEmail({ to: [recipient], subject, body }));

  const allowed = await isAllowlisted(recipient);
  const status = allowed ? "auto_sent" : "pending_approval";

  const row = {
    recipient,
    recipient_name: str(input.recipient_name) || null,
    subject,
    body,
    proposed_slots: slotsRaw,
    status,
    draft_id: (draftResult as { draft?: { id?: string } }).draft?.id ?? null,
    created_at: new Date().toISOString(),
  };

  if (isStubMode()) {
    STUB_PENDING.push({ id: STUB_PENDING.length + 1, ...row });
    return JSON.stringify({ stub_mode: true, outreach: row });
  }

  const inserted = await sb.insert("secretary_booking_outreach", row);
  // TODO v1.1: actually send the Gmail draft when status==='auto_sent'.
  return JSON.stringify({ outreach: inserted[0] });
}

export async function listPendingApprovals() {
  if (isStubMode()) return STUB_PENDING.filter((r) => r.status === "pending_approval");
  return sb.select("secretary_booking_outreach", {
    status: "eq.pending_approval",
    order: "created_at.desc",
  });
}
