import { listMeetingNotes } from "@/lib/tools/notes";

export const dynamic = "force-dynamic";

type Note = {
  id?: number;
  title?: string;
  summary?: string;
  attendees?: string[];
  action_items?: { owner?: string; text: string }[];
  meeting_date?: string;
};

export default async function NotesPage() {
  const notes = (await listMeetingNotes()) as Note[];
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="display text-2xl">Meeting notes</h1>
        <p className="text-sm text-ink-muted">
          Saved summaries with attendees and action items. Sam's action items become TODOs.
        </p>
      </div>

      {notes.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          No notes yet. Paste a transcript or ask the secretary to "save meeting notes" to create one.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id ?? n.title} className="card p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="display text-lg">{n.title ?? "(untitled)"}</h2>
                <span className="text-xs text-ink-muted">
                  {n.meeting_date ? new Date(n.meeting_date).toLocaleDateString() : ""}
                </span>
              </div>
              {n.attendees?.length ? (
                <div className="text-xs text-ink-muted mt-1">
                  Attendees: {n.attendees.join(", ")}
                </div>
              ) : null}
              <p className="mt-3 text-sm whitespace-pre-wrap">{n.summary}</p>
              {n.action_items?.length ? (
                <div className="mt-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Action items
                  </div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {n.action_items.map((a, i) => (
                      <li key={i}>
                        — {a.owner ? <strong>{a.owner}:</strong> : null} {a.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
