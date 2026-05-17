# Sam I am

Personal hub for Sam. Sibling to [xtresse-ops-tracker](https://xtresse-ops-tracker.vercel.app) and [xtresse-finance-tracker](https://xtresse-finance-tracker.vercel.app) — same Next.js 14 + Tailwind + maroon/cream shape, but personal rather than business.

The hub home is at `/`; the v1 inhabitant is **Secretary** at `/secretary`.

## Secretary v1

Personal AI secretary built on Claude with full tool use. Capabilities:

- **Chat** — request/response chat with the agent loop (max 10 tool rounds per turn).
- **Calendar** — read events, find free slots, create events (Google Calendar).
- **Email** — read threads, draft replies (Gmail).
- **Meeting booking** with rule-based autonomy:
  - Drafts a polished outreach email proposing specific times.
  - Auto-sends to addresses on the allowlist.
  - Holds others in `Pending approvals` for one-click review.
  - Always creates a Gmail draft (visible in normal Gmail Drafts).
- **Meeting notes** — store a summary + attendees + action items; Sam's items become TODOs.
- **Cross-conversation memory** — facts, preferences, notes about people persist in Postgres and get injected into the system prompt on every turn.

## Boots in stub mode

Every integration falls back to mock data when its key isn't set, mirroring the ops/finance trackers. Drop in keys one at a time as you go — the dashboard always renders.

Status pills on `/` (and `/secretary`) tell you which integrations are live vs stubbed.

## Stack

- Next.js 14 (App Router) · TypeScript · Tailwind
- `@anthropic-ai/sdk` for the agent loop — model `claude-opus-4-7`, adaptive thinking, effort `high`
- Supabase Postgres for memory / notes / todos / approvals
- Google OAuth (Calendar + Gmail scopes)
- Vercel cron for booking-loop closure, morning brief, pre-meeting briefs

See `SETUP.md` for the env-var checklist and deploy walkthrough. `CHANGES.md` is the per-version log.
