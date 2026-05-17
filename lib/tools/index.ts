// Tool definitions for the secretary agent. Each tool's `handler` runs
// server-side (so it can hit Supabase, Google APIs, etc.) and returns
// content to feed back into the next Claude turn.

import { listCalendarEvents, findFreeSlots, createCalendarEvent } from "./calendar";
import { listEmailThreads, getEmailThread, draftEmail } from "./email";
import { searchMemory, saveMemory } from "./memory";
import { saveMeetingNotes } from "./notes";
import { addTodo, listTodos } from "./todos";
import { proposeMeeting } from "./booking";
import { morningBrief } from "./brief";

export type ToolHandler = (input: Record<string, unknown>) => Promise<string>;

export type ToolSpec = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  handler: ToolHandler;
};

export const TOOLS: ToolSpec[] = [
  {
    name: "list_calendar_events",
    description:
      "Read events from Sam's primary Google Calendar. Use this whenever a question needs Sam's schedule — today, tomorrow, this week, a specific date range.",
    input_schema: {
      type: "object",
      properties: {
        time_min: {
          type: "string",
          description: "ISO 8601 lower bound (inclusive). Defaults to now.",
        },
        time_max: {
          type: "string",
          description: "ISO 8601 upper bound (exclusive). Defaults to 7 days from time_min.",
        },
        max_results: { type: "number", description: "Cap on returned events. Defaults to 20." },
      },
    },
    handler: (i) => listCalendarEvents(i),
  },
  {
    name: "find_free_slots",
    description:
      "Find open windows on Sam's calendar of a given duration within a date range. Returns ISO 8601 candidate start times.",
    input_schema: {
      type: "object",
      properties: {
        duration_minutes: { type: "number" },
        time_min: { type: "string", description: "ISO 8601 lower bound." },
        time_max: { type: "string", description: "ISO 8601 upper bound." },
        working_hours: {
          type: "object",
          properties: {
            start_hour: { type: "number", description: "0-23, defaults to 9" },
            end_hour: { type: "number", description: "0-23, defaults to 18" },
            timezone: { type: "string", description: "IANA tz, defaults to America/Los_Angeles" },
          },
        },
      },
      required: ["duration_minutes", "time_min", "time_max"],
    },
    handler: (i) => findFreeSlots(i),
  },
  {
    name: "create_calendar_event",
    description:
      "Create an event on Sam's primary calendar. Send invites to all attendee emails. Only call this once a meeting time is confirmed — for outreach use draft_meeting_outreach instead.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        start: { type: "string", description: "ISO 8601" },
        end: { type: "string", description: "ISO 8601" },
        attendees: { type: "array", items: { type: "string" }, description: "Attendee emails" },
        description: { type: "string" },
        location: { type: "string" },
      },
      required: ["title", "start", "end"],
    },
    handler: (i) => createCalendarEvent(i),
  },
  {
    name: "list_email_threads",
    description: "Search Sam's Gmail for recent threads matching a query. Returns thread metadata + snippets.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query syntax." },
        max_results: { type: "number" },
      },
    },
    handler: (i) => listEmailThreads(i),
  },
  {
    name: "get_email_thread",
    description: "Fetch the full message history of a Gmail thread by ID.",
    input_schema: {
      type: "object",
      properties: { thread_id: { type: "string" } },
      required: ["thread_id"],
    },
    handler: (i) => getEmailThread(i),
  },
  {
    name: "draft_email",
    description:
      "Create a Gmail draft. Always creates the draft (visible to Sam in Gmail Drafts); the secretary auto-sends only if the recipient is allowlisted, otherwise it goes into Pending approvals.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "array", items: { type: "string" } },
        subject: { type: "string" },
        body: { type: "string" },
        in_reply_to_thread_id: { type: "string", description: "Optional Gmail thread to reply on." },
      },
      required: ["to", "subject", "body"],
    },
    handler: (i) => draftEmail(i),
  },
  {
    name: "search_memory",
    description:
      "Search Sam's long-term memory for facts, preferences, notes about people, prior decisions. Plain text search.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
    handler: (i) => searchMemory(i),
  },
  {
    name: "save_memory",
    description:
      "Save a fact, preference, or note to long-term memory. Tag it with a category (person, preference, decision, project, etc.) so future searches can scope.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string" },
        category: { type: "string" },
        subject: { type: "string", description: "Person/project/topic this is about." },
      },
      required: ["content"],
    },
    handler: (i) => saveMemory(i),
  },
  {
    name: "save_meeting_notes",
    description:
      "Store a meeting summary, attendee list, and action items. Sam's action items become TODOs surfaced in long-term memory.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
        action_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Email or name." },
              text: { type: "string" },
            },
            required: ["text"],
          },
        },
        meeting_date: { type: "string", description: "ISO 8601" },
      },
      required: ["title", "summary"],
    },
    handler: (i) => saveMeetingNotes(i),
  },
  {
    name: "add_todo",
    description: "Add a TODO to Sam's task list.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string" },
        due: { type: "string", description: "Optional ISO 8601" },
      },
      required: ["text"],
    },
    handler: (i) => addTodo(i),
  },
  {
    name: "list_todos",
    description: "List Sam's open TODOs.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
    handler: (i) => listTodos(i),
  },
  {
    name: "morning_brief",
    description:
      "Compose Sam's daily morning brief on demand — pulls today's calendar, unread inbox, open TODOs, and pending approvals, then writes a short friendly digest. Set send=true to also email it to Sam; default is false (just return the text so the agent can quote it in chat).",
    input_schema: {
      type: "object",
      properties: {
        send: {
          type: "boolean",
          description: "If true, also send via Gmail to the owner email. Default false.",
        },
      },
    },
    handler: (i) => morningBrief(i),
  },
  {
    name: "propose_meeting",
    description:
      "Compose and send a meeting-outreach email proposing specific times. If the recipient is allowlisted the email is auto-sent; otherwise it lands in Pending approvals for one-click review.",
    input_schema: {
      type: "object",
      properties: {
        recipient_email: { type: "string" },
        recipient_name: { type: "string" },
        subject: { type: "string" },
        body: { type: "string", description: "The proposal email body." },
        proposed_slots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              start: { type: "string", description: "ISO 8601" },
              end: { type: "string", description: "ISO 8601" },
            },
            required: ["start", "end"],
          },
        },
        duration_minutes: { type: "number" },
      },
      required: ["recipient_email", "subject", "body", "proposed_slots"],
    },
    handler: (i) => proposeMeeting(i),
  },
];

export function toolByName(name: string) {
  return TOOLS.find((t) => t.name === name);
}
