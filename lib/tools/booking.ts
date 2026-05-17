import { sb, isStubMode } from "@/lib/supabase";
import { draftEmail } from "./email";
import { sendGmail } from "@/lib/google";
import { listAllowlist } from "@/lib/allowlist";

type Input = Record<string, unknown>;
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export type Outreach = {
  id?: number;
  recipient: string;
  recipient_name?: string | null;
  subject: string;
  body: string;
  proposed_slots: unknown[];
  status:
    | "auto_sent"
    | "pending_approval"
    | "sent"
    | "declined"
    | "confirmed"
    | "cancelled";
  draft_id?: string | null;
  thread_id?: string | null;
  confirmed_slot?: { start: string; end: string } | null;
  created_at?: string;
};

// In-memory pending store for stub mode. (Allowlist lives in lib/allowlist.ts.)
const STUB_PENDING: Outreach[] = [];

async function isAllowlisted(email: string): Promise<boolean> {
  const lc = email.toLowerCase();
  const all = await listAllowlist();
  return all.some((e) => e.email === lc);
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
  const status: Outreach["status"] = allowed ? "auto_sent" : "pending_approval";

  const row: Omit<Outreach, "id"> = {
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
    const next: Outreach = { id: STUB_PENDING.length + 1, ...row };
    STUB_PENDING.push(next);
    if (status === "auto_sent") {
      // Best-effort auto-send for stub mode — sendGmail short-circuits to a
      // stub message id when Google isn't connected.
      try {
        const sent = await sendGmail({ to: [recipient], subject, body });
        next.status = "sent";
        next.thread_id = sent.id;
      } catch {
        /* leave as auto_sent so the next pass can retry */
      }
    }
    return JSON.stringify({ stub_mode: true, outreach: next });
  }

  const inserted = (await sb.insert<Outreach>("secretary_booking_outreach", row))[0];
  if (status === "auto_sent" && inserted?.id != null) {
    try {
      const sent = await sendGmail({ to: [recipient], subject, body });
      await sb.update(
        "secretary_booking_outreach",
        { status: "sent", thread_id: sent.id, updated_at: new Date().toISOString() },
        { id: `eq.${inserted.id}` },
      );
      inserted.status = "sent";
      inserted.thread_id = sent.id;
    } catch {
      /* leave as auto_sent so a manual retry can pick it up */
    }
  }
  return JSON.stringify({ outreach: inserted });
}

export async function listPendingApprovals(): Promise<Outreach[]> {
  if (isStubMode()) return STUB_PENDING.filter((r) => r.status === "pending_approval");
  return sb.select<Outreach>("secretary_booking_outreach", {
    status: "eq.pending_approval",
    order: "created_at.desc",
  });
}

// Walked by the check-replies cron to look for inbound replies and try to
// auto-confirm the booking.
export async function listAwaitingReply(): Promise<Outreach[]> {
  if (isStubMode()) {
    return STUB_PENDING.filter((r) => r.status === "sent" && !!r.thread_id);
  }
  return sb.select<Outreach>("secretary_booking_outreach", {
    status: "eq.sent",
    thread_id: "not.is.null",
    order: "created_at.desc",
    limit: "50",
  });
}

export async function confirmOutreach(
  id: number,
  confirmedSlot: { start: string; end: string },
) {
  const row = await patchOutreach(id, {
    status: "confirmed",
    confirmed_slot: confirmedSlot,
  });
  return { ok: true as const, outreach: row, confirmedSlot };
}

export async function declineOutreach(id: number) {
  return patchOutreach(id, { status: "declined" }).then((row) => ({
    ok: true as const,
    outreach: row,
  }));
}

async function getOutreach(id: number): Promise<Outreach | null> {
  if (isStubMode()) {
    return STUB_PENDING.find((r) => r.id === id) ?? null;
  }
  const rows = await sb.select<Outreach>("secretary_booking_outreach", {
    id: `eq.${id}`,
    limit: "1",
  });
  return rows[0] ?? null;
}

async function patchOutreach(id: number, patch: Partial<Outreach>) {
  if (isStubMode()) {
    const row = STUB_PENDING.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return row ?? null;
  }
  const rows = await sb.update<Outreach>(
    "secretary_booking_outreach",
    { ...patch, updated_at: new Date().toISOString() },
    { id: `eq.${id}` },
  );
  return rows[0] ?? null;
}

export async function sendOutreach(id: number) {
  const row = await getOutreach(id);
  if (!row) return { error: "not found" as const };
  if (row.status !== "pending_approval" && row.status !== "auto_sent") {
    return { error: `cannot send from status=${row.status}` as const };
  }
  const sent = await sendGmail({
    to: [row.recipient],
    subject: row.subject,
    body: row.body,
  });
  const updated = await patchOutreach(id, { status: "sent", thread_id: sent.id });
  return { ok: true as const, sent, outreach: updated };
}

export async function cancelOutreach(id: number) {
  const row = await getOutreach(id);
  if (!row) return { error: "not found" as const };
  const updated = await patchOutreach(id, { status: "cancelled" });
  return { ok: true as const, outreach: updated };
}

export async function updateOutreach(
  id: number,
  patch: { subject?: string; body?: string },
) {
  const row = await getOutreach(id);
  if (!row) return { error: "not found" as const };
  if (row.status !== "pending_approval") {
    return { error: `cannot edit from status=${row.status}` as const };
  }
  const updated = await patchOutreach(id, {
    subject: patch.subject ?? row.subject,
    body: patch.body ?? row.body,
  });
  return { ok: true as const, outreach: updated };
}
