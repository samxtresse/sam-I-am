-- 0003_slack.sql — Slack DM bot persistence.

create table if not exists secretary_slack_threads (
  slack_channel_id   text primary key,
  secretary_thread_id text not null,
  created_at         timestamptz not null default now()
);

create table if not exists secretary_slack_events (
  id          bigserial primary key,
  event_id    text unique,         -- Slack event id for dedupe
  channel_id  text not null,
  payload     jsonb not null,
  processed   boolean not null default false,
  created_at  timestamptz not null default now()
);
