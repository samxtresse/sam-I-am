# Changelog

## v0.3 — approvals action buttons

`/secretary/approvals` is interactive now. Each pending outreach renders
with **Send**, **Edit**, and **Cancel** controls; Send invokes the new
`sendGmail()` helper, Cancel marks it cancelled, Edit swaps the subject +
body into editable fields (Save persists, Discard reverts). Status pills
update in place after success.

Also: `propose_meeting` with an allowlisted recipient now actually fires
the Gmail send during the agent turn (previously it stored `auto_sent`
without sending). On failure it leaves the row at `auto_sent` so a manual
retry can pick it up.

Per-version notes:

- `lib/tools/booking.ts` — adds typed `Outreach`, `sendOutreach`,
  `cancelOutreach`, `updateOutreach`, plus auto-send on allowlisted
  proposals (stub + live).
- `app/api/secretary/approvals/[id]/route.ts` — gated `POST` with
  `action: 'send' | 'cancel' | 'update'` discriminator.
- `components/approvals/approval-row.tsx` — client row component with
  inline edit, optimistic disabled-state, error surfacing, and a
  post-action "sent"/"cancelled" pill so the row collapses cleanly.
- `app/secretary/approvals/page.tsx` — server shell now hands each row
  to the client component.

## v0.2 — morning brief composer

The `/api/secretary/cron/morning-brief` endpoint is real now. Mon-Fri at 08:00 PT it:

1. Pulls today's calendar (PT-aware day bounds, DST-handled), unread inbox highlights, open TODOs, and pending booking approvals in parallel.
2. Sends them to Claude (`claude-opus-4-7`, adaptive thinking, effort `medium`) with a chief-of-staff system prompt and a long-term-memory excerpt.
3. Sends the composed brief to `SECRETARY_OWNER_EMAIL` via the new `sendGmail()` helper in `lib/google.ts`.

Stub fallbacks all the way down — if Anthropic isn't wired, returns a basic count-summary; if Google isn't connected, returns the composed brief without sending.

Also exposed on-demand via a new `morning_brief` tool, so saying "brief me on today" in chat works the same way (defaults to compose-only; pass `send: true` to also email).

Per-version notes:

- `lib/morning-brief.ts` — new composer; `gatherBriefSources()` parallel-fetches, `composeMorningBrief()` calls Claude, `runMorningBrief({send})` orchestrates.
- `lib/google.ts` — adds `sendGmail()` that base64url-encodes RFC 822 and hits `/users/me/messages/send` (stub-safe).
- `lib/tools/brief.ts` + `lib/tools/index.ts` — wires the `morning_brief` tool into the agent.
- `app/api/secretary/cron/morning-brief/route.ts` — calls `runMorningBrief({send: true})` and returns a JSON preview.

## v0.1 — initial bootstrap

Brought sam-I-am up from an empty repo as the personal-hub sibling to ops-tracker and finance-tracker.

### Scaffold

- Next.js 14 (App Router) + TypeScript + Tailwind, brand-matched to the sibling apps (maroon + cream, with a gold accent that swaps in for finance's sage).
- `app/layout.tsx` + `components/nav.tsx` — hub-wide chrome with links to Secretary surfaces.
- `app/page.tsx` — hub home with feature cards + live/stub status pills for Anthropic, Supabase, Google.

### Secretary v1 (primary inhabitant of the hub)

Lives at `/secretary`. Single-tenant, cookie-gated by `SECRETARY_AUTH_TOKEN`.

- **Agent loop** (`lib/agent.ts`) — manual tool-use loop on Claude (`claude-opus-4-7`, `thinking: adaptive`, `effort: high`), capped at 10 rounds per turn. System prompt injects a recent-memory summary.
- **Tools** (`lib/tools/`):
  - `list_calendar_events`, `find_free_slots`, `create_calendar_event` (Google Calendar)
  - `list_email_threads`, `get_email_thread`, `draft_email` (Gmail)
  - `search_memory`, `save_memory`, `save_meeting_notes`, `add_todo`, `list_todos`, `propose_meeting`
- **Chat UI** (`/secretary`, `components/chat/secretary-chat.tsx`) — composer + bubble list + status pills + stub-mode banner via integration tags.
- **Setup page** (`/secretary/setup`) — 4-step walkthrough: unlock cookie → connect Google → run migrations → wire ANTHROPIC_API_KEY.
- **Pending approvals** (`/secretary/approvals`) — read-only list of booking-outreach drafts held for review (allowlist routes auto-send, others land here).
- **Meeting notes** (`/secretary/notes`) — saved summaries with attendees + action items.

### Plumbing

- `lib/env.ts` — central env access with per-integration `integrationStatus()`.
- `lib/auth.ts` + `middleware.ts` — cookie gate on `/secretary/*` (except setup + auth callbacks).
- `lib/supabase.ts` — thin REST client over the service-role key with `isStubMode()` everywhere callers branch.
- `lib/google.ts` — OAuth code exchange, token refresh, authed fetch wrapper for Calendar/Gmail.

### API routes

- `POST /api/secretary/chat` — gated chat endpoint that runs the agent turn.
- `POST /api/secretary/auth/unlock` — sets the session cookie after constant-time-ish token compare.
- `GET /api/secretary/auth/google` + `/callback` — OAuth handshake, persists tokens to `secretary_google_tokens`.
- `GET /api/secretary/cron/{check-replies,morning-brief,pre-meeting-briefs}` — scaffolds returning `todo` payloads. Bearer-gated on `CRON_SECRET`.
- `POST /api/secretary/slack/events` + `POST /api/secretary/twilio/sms` — webhook scaffolds with URL-verification handshake.

### Database

`supabase/migrations/`:

- `0001_secretary.sql` — `secretary_google_tokens`, `secretary_memories`, `secretary_todos`, `secretary_audit_log`.
- `0002_booking_loop_and_notes.sql` — `secretary_allowlist`, `secretary_booking_outreach`, `secretary_meeting_notes`.
- `0003_slack.sql` — `secretary_slack_threads`, `secretary_slack_events`.
- `0004_sms.sql` — `secretary_sms_threads`, `secretary_sms_messages`.
- `0005_slack_approvals.sql` — `secretary_slack_approvals` (FK → outreach).
- `0006_pre_meeting.sql` — `secretary_pre_meeting_log` dedupe table.

### Cron schedule (`vercel.json`)

- `/api/secretary/cron/check-replies` — every 30 min.
- `/api/secretary/cron/morning-brief` — Mon-Fri 16:00 UTC (08:00 PT).
- `/api/secretary/cron/pre-meeting-briefs` — every 15 min.

## Known follow-ups (v1.1)

- **Booking-loop closure** — `check-replies` cron: parse inbound replies, detect agreement, auto-create the calendar event, send confirmation.
- **Allowlist management UI** — add/remove recipients from `secretary_allowlist` so future proposals to them skip the approval queue.
- **Pre-meeting brief composer** — scan calendar for next 25 min; pull recent emails with attendees + memory; push to Slack DM with `secretary_pre_meeting_log` dedupe.
- **Morning brief — Slack delivery** — v0.2 sends via Gmail only; Slack delivery lands once the bot is wired.
- **Slack DM bot** — verify signing secret, gate on `SLACK_OWNER_USER_ID`, dispatch every DM through the agent loop, persist thread mapping.
- **Slack interactive approvals** — block-kit "Approve / Cancel" buttons on outreach DMs.
- **Twilio SMS bot** — validate Twilio signature, gate on `TWILIO_OWNER_NUMBER`, reply via TwiML (≤12s) or REST API.
- **Notion sync** — `save_meeting_notes` → page under `NOTION_NOTES_PAGE_ID`; TODOs → rows in `NOTION_TASKS_DB_ID`; `search_notion` tool.
- **Voice composer** — mic button + speaker toggle via Web Speech API; preference persists in localStorage.
- **Audit log writes** — wire `secretary_audit_log` inserts in `lib/agent.ts` around each tool call.
- **Streaming chat** — switch the agent route to SSE; render tokens incrementally in `secretary-chat.tsx`.
