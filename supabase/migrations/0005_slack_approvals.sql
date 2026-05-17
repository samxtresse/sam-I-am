-- 0005_slack_approvals.sql — Slack interactive approvals for booking outreach.

create table if not exists secretary_slack_approvals (
  id              bigserial primary key,
  outreach_id     bigint not null references secretary_booking_outreach(id) on delete cascade,
  slack_channel   text not null,
  slack_ts        text not null,        -- message timestamp (used to update the message inline)
  action          text,                 -- 'approved' | 'cancelled' | null while pending
  acted_at        timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists secretary_slack_approvals_outreach_idx
  on secretary_slack_approvals (outreach_id);
