import { sb, isStubMode } from "@/lib/supabase";

type Input = Record<string, unknown>;
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// In-memory store for stub mode so the agent can still "remember" within a process.
const STUB_MEMORIES: { id: number; content: string; category?: string; subject?: string }[] = [];

export async function searchMemory(input: Input): Promise<string> {
  const query = str(input.query);
  const limit = num(input.limit, 10);
  if (!query) return JSON.stringify({ error: "query required" });

  if (isStubMode()) {
    const lc = query.toLowerCase();
    const hits = STUB_MEMORIES.filter(
      (m) =>
        m.content.toLowerCase().includes(lc) ||
        (m.subject ?? "").toLowerCase().includes(lc) ||
        (m.category ?? "").toLowerCase().includes(lc),
    ).slice(0, limit);
    return JSON.stringify({ stub_mode: true, memories: hits });
  }

  // PostgREST full-text: use ilike on content for now (pg_trgm/tsvector is a later upgrade).
  const rows = await sb.select<{ id: number; content: string; category?: string; subject?: string }>(
    "secretary_memories",
    {
      content: `ilike.*${query}*`,
      order: "created_at.desc",
      limit: String(limit),
    },
  );
  return JSON.stringify({ memories: rows });
}

export async function saveMemory(input: Input): Promise<string> {
  const content = str(input.content);
  if (!content) return JSON.stringify({ error: "content required" });
  const row = {
    content,
    category: str(input.category) || null,
    subject: str(input.subject) || null,
  };

  if (isStubMode()) {
    const next = { id: STUB_MEMORIES.length + 1, ...row };
    STUB_MEMORIES.push({
      id: next.id,
      content: row.content,
      category: row.category ?? undefined,
      subject: row.subject ?? undefined,
    });
    return JSON.stringify({ stub_mode: true, memory: next });
  }

  const inserted = await sb.insert<{ id: number }>("secretary_memories", row);
  return JSON.stringify({ memory: inserted[0] });
}

// Used by the agent route to inject Sam's persistent context into the system prompt.
export async function memorySummary(): Promise<string> {
  if (isStubMode()) {
    if (!STUB_MEMORIES.length) return "(no memories saved yet)";
    return STUB_MEMORIES.slice(-20)
      .map((m) => `- ${m.subject ? `[${m.subject}] ` : ""}${m.content}`)
      .join("\n");
  }
  const rows = await sb.select<{ content: string; subject?: string }>("secretary_memories", {
    order: "created_at.desc",
    limit: "30",
  });
  if (!rows.length) return "(no memories saved yet)";
  return rows
    .map((m) => `- ${m.subject ? `[${m.subject}] ` : ""}${m.content}`)
    .join("\n");
}
