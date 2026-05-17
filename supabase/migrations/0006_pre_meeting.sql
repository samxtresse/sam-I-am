-- 0006_pre_meeting.sql — dedupe table for the pre-meeting brief cron.

create table if not exists secretary_pre_meeting_log (
  calendar_event_id  text primary key,
  briefed_at         timestamptz not null default now(),
  brief              text
);

create index if not exists secretary_pre_meeting_log_briefed_idx
  on secretary_pre_meeting_log (briefed_at desc);
