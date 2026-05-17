import { sb, isStubMode } from "@/lib/supabase";
import { getStubAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Row = {
  id?: number;
  kind?: string;
  name?: string | null;
  input?: unknown;
  output?: unknown;
  duration_ms?: number | null;
  created_at?: string;
};

async function load(): Promise<Row[]> {
  if (isStubMode()) return getStubAudit().slice(-100).reverse();
  return sb.select<Row>("secretary_audit_log", { order: "created_at.desc", limit: "100" });
}

function preview(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.length > 200 ? `${v.slice(0, 200)}…` : v;
  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  } catch {
    return String(v);
  }
}

export default async function AuditPage() {
  const rows = await load();
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="display text-2xl">Audit log</h1>
        <p className="text-sm text-ink-muted">
          Every tool call and agent turn. Most-recent first. Limited to 100 entries.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="card p-6 text-sm text-ink-muted">
          Nothing logged yet. Send a message in chat and reload.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id ?? i} className="card p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="tag tag-stub">{r.kind}</span>
                  <span className="font-medium">{r.name ?? "—"}</span>
                </div>
                <span className="text-ink-muted">
                  {r.duration_ms != null ? `${r.duration_ms}ms · ` : ""}
                  {r.created_at ? new Date(r.created_at).toLocaleTimeString() : ""}
                </span>
              </div>
              {r.input !== undefined ? (
                <div className="mt-1 text-ink-muted">
                  <span className="opacity-60">in:</span> {preview(r.input)}
                </div>
              ) : null}
              {r.output !== undefined ? (
                <div className="text-ink-muted">
                  <span className="opacity-60">out:</span> {preview(r.output)}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
