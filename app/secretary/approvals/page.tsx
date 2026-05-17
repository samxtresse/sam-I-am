import { listPendingApprovals } from "@/lib/tools/booking";
import { ApprovalRow } from "@/components/approvals/approval-row";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const pending = await listPendingApprovals();

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="display text-2xl">Pending approvals</h1>
        <p className="text-sm text-ink-muted">
          Booking-outreach drafts to recipients not on the allowlist. Edit, send, or cancel.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">Nothing waiting on you. Nice.</div>
      ) : (
        <ul className="space-y-3">
          {pending.map((row) => (
            <li key={row.id}>
              <ApprovalRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
