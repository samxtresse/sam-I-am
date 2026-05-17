# Setup — Sam I am

## 1. Clone & install

```bash
git clone git@github.com:samxtresse/sam-I-am.git
cd sam-I-am
npm install
cp .env.example .env.local
```

The app **boots in stub mode** with no env vars — every page renders with canned data. Wire vars one at a time.

## 2. Required env vars

```bash
# Public URL (used to build OAuth redirect URLs)
APP_URL=https://xtresse-hub.vercel.app

# Owner identity (single-tenant for v1)
SECRETARY_OWNER_EMAIL=sam@xtresse.com
SECRETARY_OWNER_NAME=Sam

# Cookie-gate password — generate something long & random
# openssl rand -base64 32
SECRETARY_AUTH_TOKEN=...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7

# Supabase (use the service-role key — server-only)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Google OAuth (Cloud Console → Credentials → OAuth 2.0 Client)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://xtresse-hub.vercel.app/api/secretary/auth/google/callback

# Vercel cron secret (any long random string)
CRON_SECRET=...
```

Optional integrations: `SLACK_*`, `TWILIO_*`, `NOTION_*` (each gated independently — leave unset to skip).

## 3. Supabase

1. Create a new Supabase project (or reuse an existing one).
2. SQL Editor → run the migrations in order:
   - `supabase/migrations/0001_secretary.sql`
   - `supabase/migrations/0002_booking_loop_and_notes.sql`
   - `supabase/migrations/0003_slack.sql`
   - `supabase/migrations/0004_sms.sql`
   - `supabase/migrations/0005_slack_approvals.sql`
   - `supabase/migrations/0006_pre_meeting.sql`
3. Copy `SUPABASE_URL` and the **service_role** key into your env.

## 4. Google Cloud

1. Console → APIs & Services → enable **Google Calendar API** and **Gmail API**.
2. Credentials → Create Credentials → **OAuth client ID** → Web application.
3. Authorized redirect URI: `${APP_URL}/api/secretary/auth/google/callback` (and your local dev URL if you'll run locally).
4. Add yourself as a test user under OAuth consent screen → Test users.

## 5. Deploy + first-time login

1. Push to Vercel, add all env vars, deploy.
2. Visit `/secretary/setup`.
3. Paste your `SECRETARY_AUTH_TOKEN` to unlock (sets a 30-day cookie).
4. Click **Connect Google** and accept the scopes.
5. Open `/secretary` — you're in.

## 6. Sanity-check

Visit:
- `/` — hub home with integration status pills.
- `/secretary` — chat UI; ask "what's on my calendar tomorrow?" and watch the tool loop.
- `/secretary/approvals` — pending booking-outreach drafts.
- `/secretary/notes` — saved meeting notes.

## 7. v1.1 plan

- Approvals UI: send / edit / cancel buttons hooked to Gmail send.
- Booking-loop closure cron: parse replies, auto-confirm allowlisted agreements.
- Morning brief cron: compose from calendar+inbox+todos+approvals, send via Gmail (+ Slack).
- Pre-meeting briefs cron: scan next 25min, push prep to Slack DM.
- Slack DM bot + Twilio SMS bot: same agent loop, persistent thread mapping.
- Notion sync: meeting notes → Notion pages, TODOs → tasks DB.
- Voice composer (Web Speech API, browser-only).
