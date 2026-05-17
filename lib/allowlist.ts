// Persistent allowlist for booking outreach auto-send. Recipients on the
// allowlist have propose_meeting skip the approval queue and fire Gmail
// directly. Backed by secretary_allowlist; in-memory in stub mode.

import { sb, isStubMode } from "./supabase";

export type AllowlistEntry = {
  email: string;
  notes?: string | null;
  added_at?: string;
};

const STUB: AllowlistEntry[] = [];

function normalize(email: string) {
  return email.trim().toLowerCase();
}

export async function listAllowlist(): Promise<AllowlistEntry[]> {
  if (isStubMode()) return [...STUB].sort((a, b) => a.email.localeCompare(b.email));
  return sb.select<AllowlistEntry>("secretary_allowlist", {
    order: "email.asc",
  });
}

export async function addAllowlist(email: string, notes?: string): Promise<AllowlistEntry> {
  const lc = normalize(email);
  if (!/.+@.+\..+/.test(lc)) throw new Error("invalid email");
  if (isStubMode()) {
    const existing = STUB.find((e) => e.email === lc);
    if (existing) {
      if (notes !== undefined) existing.notes = notes;
      return existing;
    }
    const row: AllowlistEntry = {
      email: lc,
      notes: notes ?? null,
      added_at: new Date().toISOString(),
    };
    STUB.push(row);
    return row;
  }
  // Upsert via delete-then-insert (PostgREST has Prefer: resolution=merge-duplicates
  // for true upsert, but we keep this simple).
  await sb.delete("secretary_allowlist", { email: `eq.${lc}` });
  const inserted = await sb.insert<AllowlistEntry>("secretary_allowlist", {
    email: lc,
    notes: notes ?? null,
  });
  return inserted[0];
}

export async function removeAllowlist(email: string): Promise<void> {
  const lc = normalize(email);
  if (isStubMode()) {
    const idx = STUB.findIndex((e) => e.email === lc);
    if (idx >= 0) STUB.splice(idx, 1);
    return;
  }
  await sb.delete("secretary_allowlist", { email: `eq.${lc}` });
}
