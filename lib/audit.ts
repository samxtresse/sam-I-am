// Writes to secretary_audit_log. Always fire-and-forget — audit failures
// must never break the agent turn or a tool call.

import { sb, isStubMode } from "./supabase";

type Kind = "tool_call" | "agent_turn" | "cron";

type Row = {
  kind: Kind;
  name?: string;
  input?: unknown;
  output?: unknown;
  duration_ms?: number;
};

const STUB: (Row & { id: number; created_at: string })[] = [];

export async function audit(row: Row): Promise<void> {
  try {
    if (isStubMode()) {
      STUB.push({ id: STUB.length + 1, created_at: new Date().toISOString(), ...row });
      if (STUB.length > 500) STUB.splice(0, STUB.length - 500);
      return;
    }
    await sb.insert("secretary_audit_log", {
      kind: row.kind,
      name: row.name ?? null,
      input: row.input ?? null,
      output: row.output ?? null,
      duration_ms: row.duration_ms ?? null,
    });
  } catch {
    /* swallow — never break the caller */
  }
}

export function getStubAudit() {
  return [...STUB];
}
