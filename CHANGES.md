# Changelog

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

- **Approvals action buttons** — send / edit / cancel on `/secretary/approvals` wired to Gmail send.
- **Booking-loop closure** — `check-replies` cron: parse inbound replies, detect agreement, auto-create the calendar event, send confirmation.
- **Morning brief composer** — read calendar + inbox + todos + approvals; compose; send via Gmail (+ Slack if connected).
- **Pre-meeting brief composer** — scan calendar for next 25 min; pull recent emails with attendees + memory; push to Slack DM with `secretary_pre_meeting_log` dedupe.
- **Slack DM bot** — verify signing secret, gate on `SLACK_OWNER_USER_ID`, dispatch every DM through the agent loop, persist thread mapping.
- **Slack interactive approvals** — block-kit "Approve / Cancel" buttons on outreach DMs.
- **Twilio SMS bot** — validate Twilio signature, gate on `TWILIO_OWNER_NUMBER`, reply via TwiML (≤12s) or REST API.
- **Notion sync** — `save_meeting_notes` → page under `NOTION_NOTES_PAGE_ID`; TODOs → rows in `NOTION_TASKS_DB_ID`; `search_notion` tool.
- **Voice composer** — mic button + speaker toggle via Web Speech API; preference persists in localStorage.
- **Audit log writes** — wire `secretary_audit_log` inserts in `lib/agent.ts` around each tool call.
- **Streaming chat** — switch the agent route to SSE; render tokens incrementally in `secretary-chat.tsx`.
