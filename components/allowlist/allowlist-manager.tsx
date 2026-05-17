"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Entry = { email: string; notes?: string | null; added_at?: string };

export function AllowlistManager({ initial }: { initial: Entry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/secretary/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setEntries((prev) => {
          const lc = (data.entry as Entry).email;
          const without = prev.filter((p) => p.email !== lc);
          return [...without, data.entry].sort((a, b) => a.email.localeCompare(b.email));
        });
        setEmail("");
        setNotes("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(target: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/secretary/allowlist?email=${encodeURIComponent(target)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setEntries((prev) => prev.filter((p) => p.email !== target));
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card p-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@partner.co"
            className="flex-1 min-w-[200px] rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
            disabled={pending}
            autoComplete="off"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="flex-1 min-w-[200px] rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
            disabled={pending}
          />
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Add"}
          </button>
        </div>
        {error ? <p className="text-xs text-loss">{error}</p> : null}
        <p className="text-xs text-ink-muted">
          Proposals to addresses on this list auto-send via Gmail and skip the approval queue.
        </p>
      </form>

      {entries.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          No allowlisted recipients yet. Every proposal will land in pending approvals.
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.email} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{entry.email}</div>
                {entry.notes ? (
                  <div className="text-xs text-ink-muted truncate">{entry.notes}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(entry.email)}
                disabled={pending}
                className="btn btn-ghost text-loss"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
