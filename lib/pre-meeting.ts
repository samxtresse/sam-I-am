// pre-meeting briefs cron (every 15 min): for each event starting in the
// next ~25 minutes, compose a short prep brief from recent attendee emails
// and long-term memory snippets, and persist to `secretary_pre_meeting_log`
// so we never brief the same event twice.
//
// v0.5: composes + stores. Slack DM delivery lands once the bot is wired.
// Without Anthropic, returns a basic "next meeting" stub so the cron is
// still observable in logs.

import Anthropic from "@anthropic-ai/sdk";
import { env, isStub } from "./env";
import { sb, isStubMode } from "./supabase";
import { googleFetch, isGoogleStub } from "./google";
import { memorySummary } from "./tools/memory";

type CalEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; responseStatus?: string }[];
};

const LOOKAHEAD_MIN = 25;

const STUB_LOG = new Set<string>();

async function fetchUpcomingEvents(): Promise<CalEvent[]> {
  if (isGoogleStub()) {
    // Stub: pretend there's one event in 12 minutes so the cron does something.
    const start = new Date(Date.now() + 12 * 60_000).toISOString();
    const end = new Date(Date.now() + 42 * 60_000).toISOString();
    return [
      {
        id: "stub_upcoming_1",
        summary: "[stub] Investor coffee",
        attendees: [{ email: "investor@vc.com" }],
        start: { dateTime: start },
        end: { dateTime: end },
      },
    ];
  }
  const now = new Date();
  const until = new Date(now.getTime() + LOOKAHEAD_MIN * 60_000);
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", now.toISOString());
  url.searchParams.set("timeMax", until.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "10");
  const data = (await googleFetch(url.toString())) as { items?: CalEvent[] };
  return data.items ?? [];
}

async function fetchAttendeeEmails(addresses: string[]): Promise<Record<string, string[]>> {
  // Returns a map of email → up to 3 recent message snippets (subject + snippet).
  if (isGoogleStub() || addresses.length === 0) return {};
  const out: Record<string, string[]> = {};
  for (const addr of addresses) {
    try {
      const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
      listUrl.searchParams.set("q", `from:${addr} OR to:${addr} newer_than:30d`);
      listUrl.searchParams.set("maxResults", "3");
      const list = (await googleFetch(listUrl.toString())) as {
        threads?: { id: string; snippet?: string }[];
      };
      out[addr] = (list.threads ?? [])
        .map((t) => t.snippet ?? "")
        .filter(Boolean);
    } catch {
      out[addr] = [];
    }
  }
  return out;
}

async function wasBriefed(eventId: string): Promise<boolean> {
  if (isStubMode()) return STUB_LOG.has(eventId);
  const rows = await sb.select<{ calendar_event_id: string }>(
    "secretary_pre_meeting_log",
    { calendar_event_id: `eq.${eventId}`, limit: "1" },
  );
  return rows.length > 0;
}

async function recordBrief(eventId: string, brief: string) {
  if (isStubMode()) {
    STUB_LOG.add(eventId);
    return;
  }
  await sb.insert("secretary_pre_meeting_log", {
    calendar_event_id: eventId,
    briefed_at: new Date().toISOString(),
    brief,
  });
}

async function composeBrief(
  event: CalEvent,
  attendeeEmails: Record<string, string[]>,
  memoryExcerpt: string,
): Promise<string> {
  const title = event.summary ?? "(untitled)";
  const start = event.start?.dateTime ?? event.start?.date ?? "soon";
  const attendees = (event.attendees ?? [])
    .map((a) => a.email)
    .filter((a): a is string => !!a);

  if (!env.anthropic.apiKey || isStub("anthropic")) {
    const lines = [
      `Meeting in ~15 min: ${title}`,
      `Start: ${start}`,
      attendees.length ? `Attendees: ${attendees.join(", ")}` : null,
      event.location ? `Location: ${event.location}` : null,
      "(stub mode — no ANTHROPIC_API_KEY, skipping prep generation)",
    ];
    return lines.filter(Boolean).join("\n");
  }

  const client = new Anthropic({ apiKey: env.anthropic.apiKey });
  const userContent = [
    `Upcoming meeting: ${title}`,
    `Starts: ${start}`,
    event.location ? `Location: ${event.location}` : "",
    attendees.length ? `Attendees: ${attendees.join(", ")}` : "",
    event.description ? `\nDescription:\n${event.description}` : "",
    "\nRecent email exchanges with attendees:",
    Object.entries(attendeeEmails)
      .map(
        ([email, snippets]) =>
          `- ${email}\n${snippets.map((s) => `    · ${s}`).join("\n") || "    (no recent exchanges)"}`,
      )
      .join("\n"),
    "\nLong-term memory (snippets):",
    memoryExcerpt,
    "",
    "Compose a tight prep brief (≤6 lines, plain text). Lead with the single most useful thing for the conversation. Note one open question if obvious. Skip pleasantries.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 600,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: `You write pre-meeting prep briefs for ${env.owner.name}. Be sharp and short.`,
    messages: [{ role: "user", content: userContent }],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export type PreMeetingOutcome = {
  event_id: string;
  title: string;
  start?: string;
  result: "briefed" | "skipped_duplicate" | "skipped_no_attendees" | "error";
  brief?: string;
  detail?: string;
};

export async function runPreMeetingBriefs(): Promise<{
  scanned: number;
  outcomes: PreMeetingOutcome[];
}> {
  const events = await fetchUpcomingEvents();
  const outcomes: PreMeetingOutcome[] = [];

  for (const event of events) {
    const eventId = event.id;
    const title = event.summary ?? "(untitled)";
    const start = event.start?.dateTime ?? event.start?.date;

    try {
      if (await wasBriefed(eventId)) {
        outcomes.push({ event_id: eventId, title, start, result: "skipped_duplicate" });
        continue;
      }
      const attendees = (event.attendees ?? [])
        .map((a) => a.email)
        .filter((a): a is string => !!a && a !== env.owner.email);
      if (!attendees.length && !event.description) {
        // Solo block / focus time — not worth a brief.
        outcomes.push({
          event_id: eventId,
          title,
          start,
          result: "skipped_no_attendees",
        });
        await recordBrief(eventId, "(skipped — no external attendees)");
        continue;
      }
      const [snippets, memory] = await Promise.all([
        fetchAttendeeEmails(attendees),
        memorySummary().catch(() => "(memory unavailable)"),
      ]);
      const brief = await composeBrief(event, snippets, memory);
      await recordBrief(eventId, brief);
      outcomes.push({ event_id: eventId, title, start, result: "briefed", brief });
      // TODO v1.x: push `brief` to Slack DM once the bot is wired.
    } catch (err) {
      outcomes.push({
        event_id: eventId,
        title,
        start,
        result: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { scanned: events.length, outcomes };
}
