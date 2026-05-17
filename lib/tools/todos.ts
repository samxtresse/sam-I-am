import { sb, isStubMode } from "@/lib/supabase";

type Input = Record<string, unknown>;
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

type Todo = { id: number; text: string; due?: string | null; done?: boolean };
const STUB_TODOS: Todo[] = [];

export async function addTodo(input: Input): Promise<string> {
  const text = str(input.text);
  if (!text) return JSON.stringify({ error: "text required" });
  const row = { text, due: str(input.due) || null, source: "chat" };

  if (isStubMode()) {
    const next = { id: STUB_TODOS.length + 1, text, due: row.due ?? undefined };
    STUB_TODOS.push(next);
    return JSON.stringify({ stub_mode: true, todo: next });
  }

  const inserted = await sb.insert<Todo>("secretary_todos", row);
  return JSON.stringify({ todo: inserted[0] });
}

export async function listTodos(input: Input): Promise<string> {
  const limit = num(input.limit, 20);

  if (isStubMode()) {
    return JSON.stringify({
      stub_mode: true,
      todos: STUB_TODOS.filter((t) => !t.done).slice(0, limit),
    });
  }

  const rows = await sb.select<Todo>("secretary_todos", {
    done: "is.false",
    order: "created_at.desc",
    limit: String(limit),
  });
  return JSON.stringify({ todos: rows });
}
