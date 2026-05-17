"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Outreach = {
  id?: number;
  recipient?: string;
  recipient_name?: string | null;
  subject?: string;
  body?: string;
  proposed_slots?: unknown[];
  created_at?: string;
};

export function ApprovalRow({ row }: { row: Outreach }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(row.subject ?? "");
  const [body, setBody] = useState(row.body ?? "");
  const [pending, setPending] = useState<null | "send" | "cancel" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "sent" | "cancelled" | "saved">(null);

  async function call(action: "send" | "cancel" | "update") {
    if (row.id == null) return;
    setPending(action === "update" ? "save" : action);
    setError(null);
    try {
      const res = await fetch(`/api/secretary/approvals/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      if (action === "send") setDone("sent");
      else if (action === "cancel") setDone("cancelled");
      else {
        setDone("saved");
        setEditing(false);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  }

  if (done === "sent" || done === "cancelled") {
    return (
      <div className="card p-5 opacity-70">
        <div className="text-sm">
          <span className="font-medium">{row.subject}</span> →{" "}
          <span className="tag tag-live">{done}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-cream-300 bg-cream-50 px-2 py-1 text-sm font-medium"
            />
          ) : (
            <div className="font-medium truncate">{subject || "(no subject)"}</div>
          )}
          <div className="text-xs text-ink-muted mt-0.5">
            To: {row.recipient} ·{" "}
            {Array.isArray(row.proposed_slots) ? row.proposed_slots.length : 0} proposed slots
          </div>
        </div>
        <span className="tag tag-stub">pending</span>
      </div>

      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full text-xs rounded-lg border border-cream-300 bg-cream-50 p-3 font-mono"
        />
      ) : (
        <pre className="text-xs whitespace-pre-wrap bg-cream-50 rounded-lg p-3 border border-cream-200">
          {body}
        </pre>
      )}

      {error ? <div className="text-xs text-loss">{error}</div> : null}
      {done === "saved" ? (
        <div className="text-xs text-gain">Saved. Send when ready.</div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending !== null}
          onClick={() => call("send")}
        >
          {pending === "send" ? "Sending…" : "Send"}
        </button>
        {editing ? (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending !== null}
              onClick={() => call("update")}
            >
              {pending === "save" ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending !== null}
              onClick={() => {
                setEditing(false);
                setSubject(row.subject ?? "");
                setBody(row.body ?? "");
              }}
            >
              Discard
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending !== null}
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost text-loss"
          disabled={pending !== null}
          onClick={() => call("cancel")}
        >
          {pending === "cancel" ? "Cancelling…" : "Cancel"}
        </button>
      </div>
      <div className="text-xs text-ink-muted">
        created {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
      </div>
    </div>
  );
}
