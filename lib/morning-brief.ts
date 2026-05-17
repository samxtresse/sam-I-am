// Morning brief composer — pulls today's calendar, unread inbox highlights,
// open TODOs, and pending booking approvals, then asks Claude to compose a
// short friendly brief. Used by the daily cron and exposed as an on-demand
// tool ("brief me on today").

import Anthropic from "@anthropic-ai/sdk";
import { env, isStub } from "./env";
import { listCalendarEvents } from "./tools/calendar";
import { listEmailThreads } from "./tools/email";
import { listTodos } from "./tools/todos";
import { listPendingApprovals } from "./tools/booking";
import { memorySummary } from "./tools/memory";
import { sendGmail, isGoogleStub } from "./google";

const PT_TZ = "America/Los_Angeles";

function todayBoundsPT(): { start: string; end: string; label: string } {
  // Compute today's start (00:00) and end (24:00) in America/Los_Angeles,
  // then convert back to ISO 8601 with offset so Google's timeMin/timeMax
  // line up with Sam's day.
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  // Determine PT offset (handles DST).
  const tzOffset = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    timeZoneName: "shortOffset",
  })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = /GMT([+-]\d+)/.exec(tzOffset ?? "GMT-8");
  const offsetHours = m ? parseInt(m[1], 10) : -8;
  const sign = offsetHours >= 0 ? "+" : "-";
  const offsetStr = `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;
  const start = `${parts.year}-${parts.month}-${parts.day}T00:00:00${offsetStr}`;
  const end = `${parts.year}-${parts.month}-${parts.day}T23:59:59${offsetStr}`;
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  return { start, end, label };
}

export type BriefSources = {
  date_label: string;
  calendar: unknown;
  inbox: unknown;
  todos: unknown;
  pending_approvals: unknown;
  memory_excerpt: string;
};

export async function gatherBriefSources(): Promise<BriefSources> {
  const { start, end, label } = todayBoundsPT();
  const [calendar, inbox, todos, pending, memory] = await Promise.all([
    listCalendarEvents({ time_min: start, time_max: end, max_results: 20 }),
    listEmailThreads({ query: "is:unread newer_than:1d in:inbox", max_results: 8 }),
    listTodos({ limit: 10 }),
    listPendingApprovals(),
    memorySummary().catch(() => "(memory unavailable)"),
  ]);
  return {
    date_label: label,
    calendar: JSON.parse(calendar),
    inbox: JSON.parse(inbox),
    todos: JSON.parse(todos),
    pending_approvals: pending,
    memory_excerpt: memory,
  };
}

const FALLBACK_BRIEF = (s: BriefSources) =>
  [
    `Good morning, ${env.owner.name}. Here's ${s.date_label}.`,
    "",
    "[stub mode — no ANTHROPIC_API_KEY. Composing a basic brief from the raw data.]",
    "",
    `Calendar: ${(s.calendar as { events?: unknown[] }).events?.length ?? 0} events.`,
    `Unread inbox: ${(s.inbox as { threads?: unknown[] }).threads?.length ?? 0} threads.`,
    `Open TODOs: ${(s.todos as { todos?: unknown[] }).todos?.length ?? 0}.`,
    `Pending approvals: ${Array.isArray(s.pending_approvals) ? s.pending_approvals.length : 0}.`,
  ].join("\n");

export async function composeMorningBrief(sources: BriefSources): Promise<string> {
  if (!env.anthropic.apiKey || isStub("anthropic")) {
    return FALLBACK_BRIEF(sources);
  }
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });
  const system = [
    `You are ${env.owner.name}'s personal AI secretary writing his morning brief.`,
    "Be warm, direct, and concise — like a chief of staff sending a Slack DM, not a corporate newsletter.",
    "Use short sections with markdown-ish headers (e.g. **Today**, **Inbox**, **TODOs**, **Approvals**) but keep prose tight.",
    "Skip empty sections. Lead with the most schedule-relevant item.",
    "Surface 1-2 specific suggested actions at the bottom under **Suggested**.",
    "Never invent details — only use what's in the JSON payload.",
  ].join("\n");

  const userContent = [
    `Date: ${sources.date_label}`,
    "",
    "## Long-term memory (snippets)",
    sources.memory_excerpt,
    "",
    "## Today's calendar (JSON)",
    JSON.stringify(sources.calendar, null, 2),
    "",
    "## Unread inbox (JSON)",
    JSON.stringify(sources.inbox, null, 2),
    "",
    "## Open TODOs (JSON)",
    JSON.stringify(sources.todos, null, 2),
    "",
    "## Pending booking approvals (JSON)",
    JSON.stringify(sources.pending_approvals, null, 2),
    "",
    "Compose the brief now. Plain text with light markdown — no preamble.",
  ].join("\n");

  const response = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n\n")
    .trim();
  return text || FALLBACK_BRIEF(sources);
}

export async function runMorningBrief(opts: { send?: boolean } = {}): Promise<{
  composed: string;
  sources: BriefSources;
  sent: { kind: "gmail"; id: string; stub?: true } | { kind: "skipped"; reason: string } | null;
}> {
  const sources = await gatherBriefSources();
  const composed = await composeMorningBrief(sources);
  let sent: Awaited<ReturnType<typeof runMorningBrief>>["sent"] = null;
  if (opts.send) {
    if (isGoogleStub()) {
      sent = { kind: "skipped", reason: "google not connected — brief composed but not sent" };
    } else {
      try {
        const subject = `Morning brief — ${sources.date_label}`;
        const result = await sendGmail({
          to: [env.owner.email],
          subject,
          body: composed,
        });
        sent = { kind: "gmail", id: result.id, stub: result.stub };
      } catch (err) {
        sent = {
          kind: "skipped",
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  return { composed, sources, sent };
}
