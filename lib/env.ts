// Centralized env access + stub-mode helpers.
// Mirror of the pattern used by xtresse-ops-tracker / xtresse-finance-tracker:
// if the required keys for an integration are missing, the relevant lib
// returns canned data so the UI keeps working.

export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  owner: {
    email: process.env.SECRETARY_OWNER_EMAIL ?? "sam@xtresse.com",
    name: process.env.SECRETARY_OWNER_NAME ?? "Sam",
  },
  authToken: process.env.SECRETARY_AUTH_TOKEN ?? "",
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      `${process.env.APP_URL ?? "http://localhost:3000"}/api/secretary/auth/google/callback`,
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN ?? "",
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    ownerUserId: process.env.SLACK_OWNER_USER_ID ?? "",
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    authToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
    ownerNumber: process.env.TWILIO_OWNER_NUMBER ?? "",
  },
  notion: {
    token: process.env.NOTION_TOKEN ?? "",
    notesPageId: process.env.NOTION_NOTES_PAGE_ID ?? "",
    tasksDbId: process.env.NOTION_TASKS_DB_ID ?? "",
  },
  cronSecret: process.env.CRON_SECRET ?? "",
};

export type IntegrationKey =
  | "anthropic"
  | "supabase"
  | "google"
  | "slack"
  | "twilio"
  | "notion";

export function integrationStatus(key: IntegrationKey): "live" | "stub" {
  switch (key) {
    case "anthropic":
      return env.anthropic.apiKey ? "live" : "stub";
    case "supabase":
      return env.supabase.url && env.supabase.serviceRoleKey ? "live" : "stub";
    case "google":
      return env.google.clientId && env.google.clientSecret ? "live" : "stub";
    case "slack":
      return env.slack.botToken && env.slack.signingSecret ? "live" : "stub";
    case "twilio":
      return env.twilio.accountSid && env.twilio.authToken && env.twilio.fromNumber
        ? "live"
        : "stub";
    case "notion":
      return env.notion.token ? "live" : "stub";
  }
}

export const isStub = (key: IntegrationKey) => integrationStatus(key) === "stub";
