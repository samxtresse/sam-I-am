-- 0002_booking_loop_and_notes.sql — booking outreach, allowlist, meeting notes.

create table if not exists secretary_allowlist (
  email      text primary key,
  added_at   timestamptz not null default now(),
  notes      text
);

create table if not exists secretary_booking_outreach (
  id              bigserial primary key,
  recipient       text not null,
  recipient_name  text,
  subject         text not null,
  body            text not null,
  proposed_slots  jsonb not null,
  status          text not null,   -- 'auto_sent' | 'pending_approval' | 'sent' | 'declined' | 'confirmed' | 'cancelled'
  draft_id        text,            -- Gmail draft id
  thread_id       text,            -- Gmail thread once sent
  confirmed_slot  jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists secretary_booking_status_idx
  on secretary_booking_outreach (status, created_at desc);

create table if not exists secretary_meeting_notes (
  id            bigserial primary key,
  title         text not null,
  summary       text not null,
  attendees     jsonb not null default '[]'::jsonb,
  action_items  jsonb not null default '[]'::jsonb,
  meeting_date  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists secretary_meeting_notes_date_idx
  on secretary_meeting_notes (meeting_date desc);
