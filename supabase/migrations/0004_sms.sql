-- 0004_sms.sql — Twilio SMS persistence.

create table if not exists secretary_sms_threads (
  phone_number       text primary key,
  secretary_thread_id text not null,
  created_at         timestamptz not null default now()
);

create table if not exists secretary_sms_messages (
  id          bigserial primary key,
  twilio_sid  text unique,
  direction   text not null,   -- 'in' | 'out'
  phone       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
