import { listPendingApprovals } from "@/lib/tools/booking";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const pending = (await listPendingApprovals()) as Array<{
    id?: number;
    recipient?: string;
    subject?: string;
    body?: string;
    proposed_slots?: unknown[];
    created_at?: string;
  }>;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="display text-2xl">Pending approvals</h1>
        <p className="text-sm text-ink-muted">
          Booking-outreach drafts to recipients not on the allowlist. Approve, edit, or skip.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">Nothing waiting on you. Nice.</div>
      ) : (
        <ul className="space-y-3">
          {pending.map((row) => (
            <li key={row.id} className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{row.subject ?? "(no subject)"}</div>
                  <div className="text-xs text-ink-muted">To: {row.recipient}</div>
                </div>
                <span className="tag tag-stub">pending</span>
              </div>
              <pre className="mt-3 text-xs whitespace-pre-wrap bg-cream-50 rounded-lg p-3 border border-cream-200">
                {row.body}
              </pre>
              <div className="mt-3 text-xs text-ink-muted">
                {Array.isArray(row.proposed_slots) ? row.proposed_slots.length : 0} proposed slots ·
                created {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
              </div>
              <p className="mt-3 text-xs text-ink-muted italic">
                Approve / edit / send buttons land in v1.1 — for now, this view is read-only.
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
