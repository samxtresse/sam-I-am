import { listAllowlist } from "@/lib/allowlist";
import { AllowlistManager } from "@/components/allowlist/allowlist-manager";

export const dynamic = "force-dynamic";

export default async function AllowlistPage() {
  const entries = await listAllowlist();
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="display text-2xl">Allowlist</h1>
        <p className="text-sm text-ink-muted">
          Recipients whose meeting proposals skip the approval queue and auto-send.
        </p>
      </div>
      <AllowlistManager initial={entries} />
    </div>
  );
}
