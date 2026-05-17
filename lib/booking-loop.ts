// check-replies cron: walk sent booking outreach, look for a reply from
// the recipient, classify via Claude, and act:
//   - clear agreement → create calendar event + send confirmation, mark confirmed
//   - decline → mark declined
//   - ambiguous → leave alone; Sam handles it manually
//
// Stub fallbacks throughout — without Anthropic the loop still runs but
// classifies every reply as "ambiguous" so nothing auto-progresses.

import Anthropic from "@anthropic-ai/sdk";
import { env, isStub } from "./env";
import { googleFetch, isGoogleStub, sendGmail } from "./google";
import {
  listAwaitingReply,
  confirmOutreach,
  declineOutreach,
  type Outreach,
} from "./tools/booking";
import { createCalendarEvent } from "./tools/calendar";

type Reply = { from: string; date: string; body: string };

function decodeBase64Url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function extractBody(payload: unknown): string {
  // Walks the Gmail MIME tree looking for text/plain; falls back to text/html stripped.
  if (typeof payload !== "object" || payload === null) return "";
  const p = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };
  if (p.mimeType === "text/plain" && p.body?.data) return decodeBase64Url(p.body.data);
  if (Array.isArray(p.parts)) {
    for (const sub of p.parts) {
      const text = extractBody(sub);
      if (text) return text;
    }
  }
  if (p.mimeType?.startsWith("text/html") && p.body?.data) {
    return decodeBase64Url(p.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

function headerVal(headers: { name?: string; value?: string }[] | undefined, key: string) {
  if (!headers) return "";
  const lc = key.toLowerCase();
  return headers.find((h) => h.name?.toLowerCase() === lc)?.value ?? "";
}

async function fetchReplies(threadId: string, ownerEmail: string): Promise<Reply[]> {
  if (isGoogleStub()) return [];
  const data = (await googleFetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,
  )) as {
    messages?: {
      payload?: { headers?: { name?: string; value?: string }[] } & Record<string, unknown>;
    }[];
  };
  const messages = data.messages ?? [];
  const replies: Reply[] = [];
  for (const m of messages) {
    const headers = m.payload?.headers;
    const from = headerVal(headers, "From");
    if (from.toLowerCase().includes(ownerEmail.toLowerCase())) continue;
    replies.push({
      from,
      date: headerVal(headers, "Date"),
      body: extractBody(m.payload),
    });
  }
  return replies;
}

type Classification = {
  result: "agree" | "decline" | "ambiguous";
  agreed_slot: { start: string; end: string } | null;
  explanation: string;
};

const AMBIGUOUS: Classification = {
  result: "ambiguous",
  agreed_slot: null,
  explanation: "stub mode — no ANTHROPIC_API_KEY, leaving for Sam to handle.",
};

async function classifyReply(
  outreach: Outreach,
  replies: Reply[],
): Promise<Classification> {
  if (!env.anthropic.apiKey || isStub("anthropic")) return AMBIGUOUS;
  const client = new Anthropic({ apiKey: env.anthropic.apiKey });

  const userPayload = [
    `Outreach subject: ${outreach.subject}`,
    `Recipient: ${outreach.recipient}`,
    "",
    "Originally proposed slots (ISO 8601):",
    JSON.stringify(outreach.proposed_slots, null, 2),
    "",
    "Latest reply from the recipient:",
    replies[replies.length - 1]?.body ?? "(empty)",
    "",
    "If the recipient clearly agreed to one of the proposed slots, return result='agree' and agreed_slot matching exactly one of the proposed slots (copy its start/end verbatim).",
    "If the recipient declined or said the meeting won't happen, return result='decline'.",
    "Otherwise (counter-proposal, ambiguous, more questions, etc.), return result='ambiguous'.",
    "Never invent a slot the recipient didn't accept.",
  ].join("\n");

  const response = await client.messages.create({
    model: env.anthropic.model,
    max_tokens: 600,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            result: { type: "string", enum: ["agree", "decline", "ambiguous"] },
            agreed_slot: {
              anyOf: [
                {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    start: { type: "string" },
                    end: { type: "string" },
                  },
                  required: ["start", "end"],
                },
                { type: "null" },
              ],
            },
            explanation: { type: "string" },
          },
          required: ["result", "agreed_slot", "explanation"],
        },
      },
    },
    system:
      "You classify meeting-reply emails for a personal secretary. Be conservative — when in doubt, return ambiguous.",
    messages: [{ role: "user", content: userPayload }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as Classification;
  } catch {
    return AMBIGUOUS;
  }
}

async function sendConfirmation(outreach: Outreach, slot: { start: string; end: string }) {
  const when = new Date(slot.start).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  });
  const body = [
    `Great — confirming ${when}.`,
    "",
    `A calendar invite from ${env.owner.name} is on its way.`,
    "",
    "—",
    `Sent on behalf of ${env.owner.name}.`,
  ].join("\n");
  await sendGmail({
    to: [outreach.recipient],
    subject: `Re: ${outreach.subject}`,
    body,
  });
}

export type ClosureOutcome = {
  outreach_id: number | undefined;
  recipient: string;
  result: "agree" | "decline" | "ambiguous" | "no_replies" | "error";
  detail?: string;
};

export async function runCheckReplies(): Promise<{
  scanned: number;
  outcomes: ClosureOutcome[];
}> {
  const rows = await listAwaitingReply();
  const outcomes: ClosureOutcome[] = [];

  for (const row of rows) {
    if (!row.thread_id || row.id == null) continue;
    try {
      const replies = await fetchReplies(row.thread_id, env.owner.email);
      if (!replies.length) {
        outcomes.push({
          outreach_id: row.id,
          recipient: row.recipient,
          result: "no_replies",
        });
        continue;
      }
      const cls = await classifyReply(row, replies);

      if (cls.result === "agree" && cls.agreed_slot) {
        await createCalendarEvent({
          title: row.subject.replace(/^Re:\s*/i, ""),
          start: cls.agreed_slot.start,
          end: cls.agreed_slot.end,
          attendees: [row.recipient, env.owner.email],
          description: `Auto-confirmed by secretary from booking reply.\n\nClassification: ${cls.explanation}`,
        });
        await sendConfirmation(row, cls.agreed_slot);
        await confirmOutreach(row.id, cls.agreed_slot);
        outcomes.push({
          outreach_id: row.id,
          recipient: row.recipient,
          result: "agree",
          detail: `confirmed ${cls.agreed_slot.start}`,
        });
      } else if (cls.result === "decline") {
        await declineOutreach(row.id);
        outcomes.push({
          outreach_id: row.id,
          recipient: row.recipient,
          result: "decline",
          detail: cls.explanation,
        });
      } else {
        outcomes.push({
          outreach_id: row.id,
          recipient: row.recipient,
          result: "ambiguous",
          detail: cls.explanation,
        });
      }
    } catch (err) {
      outcomes.push({
        outreach_id: row.id,
        recipient: row.recipient,
        result: "error",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { scanned: rows.length, outcomes };
}
