// Minimal Supabase client. We hit the REST surface directly via fetch so we
// don't have to take on @supabase/supabase-js until there's a reason to.
// All callers should branch on `isStubMode()` and use in-memory fallbacks
// when Supabase isn't configured — so the dashboard always renders.

import { env, isStub } from "./env";

export const isStubMode = () => isStub("supabase");

type FetchOpts = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: unknown;
  prefer?: string;
};

async function rest(path: string, opts: FetchOpts = {}): Promise<unknown> {
  if (isStubMode()) {
    throw new Error("supabase stub_mode — callers should check isStubMode() first");
  }
  const url = new URL(`${env.supabase.url}/rest/v1/${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      apikey: env.supabase.serviceRoleKey,
      Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const sb = {
  select: <T = unknown>(table: string, query: Record<string, string | undefined> = {}) =>
    rest(table, { query }) as Promise<T[]>,
  insert: <T = unknown>(table: string, row: unknown) =>
    rest(table, {
      method: "POST",
      body: Array.isArray(row) ? row : [row],
      prefer: "return=representation",
    }) as Promise<T[]>,
  update: <T = unknown>(
    table: string,
    patch: unknown,
    query: Record<string, string | undefined>,
  ) =>
    rest(table, {
      method: "PATCH",
      query,
      body: patch,
      prefer: "return=representation",
    }) as Promise<T[]>,
  delete: (table: string, query: Record<string, string | undefined>) =>
    rest(table, { method: "DELETE", query, prefer: "return=minimal" }),
};
