import { sb, isStubMode } from "@/lib/supabase";

type Input = Record<string, unknown>;
type ActionItem = { owner?: string; text: string };

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

const STUB_NOTES: Record<string, unknown>[] = [];

export async function saveMeetingNotes(input: Input): Promise<string> {
  const title = str(input.title);
  const summary = str(input.summary);
  if (!title || !summary) return JSON.stringify({ error: "title, summary required" });

  const attendees = Array.isArray(input.attendees)
    ? (input.attendees as unknown[]).filter((a): a is string => typeof a === "string")
    : [];

  const aiRaw = Array.isArray(input.action_items) ? (input.action_items as unknown[]) : [];
  const actionItems: ActionItem[] = aiRaw
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({ owner: str(x.owner) || undefined, text: str(x.text) }))
    .filter((a) => a.text);

  const row = {
    title,
    summary,
    attendees,
    action_items: actionItems,
    meeting_date: str(input.meeting_date) || new Date().toISOString(),
  };

  if (isStubMode()) {
    STUB_NOTES.push({ id: STUB_NOTES.length + 1, ...row });
    return JSON.stringify({ stub_mode: true, note: row, action_items_saved: actionItems.length });
  }

  const inserted = await sb.insert<{ id: number }>("secretary_meeting_notes", row);

  // Surface Sam's action items as TODOs.
  const mine = actionItems.filter((a) => !a.owner || /sam/i.test(a.owner));
  if (mine.length) {
    await sb.insert(
      "secretary_todos",
      mine.map((a) => ({ text: a.text, source: "meeting_notes" })),
    );
  }

  return JSON.stringify({ note: inserted[0], action_items_saved: actionItems.length });
}

export async function listMeetingNotes(limit = 20) {
  if (isStubMode()) return STUB_NOTES.slice(-limit).reverse();
  return sb.select("secretary_meeting_notes", { order: "created_at.desc", limit: String(limit) });
}
