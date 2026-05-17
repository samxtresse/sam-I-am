-- 0001_secretary.sql — core tables for the secretary feature.

create table if not exists secretary_google_tokens (
  owner_email   text primary key,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);

create table if not exists secretary_memories (
  id         bigserial primary key,
  content    text not null,
  category   text,
  subject    text,
  created_at timestamptz not null default now()
);

create index if not exists secretary_memories_created_idx on secretary_memories (created_at desc);
create index if not exists secretary_memories_subject_idx on secretary_memories (subject);

create table if not exists secretary_todos (
  id         bigserial primary key,
  text       text not null,
  due        timestamptz,
  done       boolean not null default false,
  source     text,
  created_at timestamptz not null default now()
);

create index if not exists secretary_todos_open_idx on secretary_todos (done, created_at desc);

create table if not exists secretary_audit_log (
  id         bigserial primary key,
  kind       text not null,        -- 'tool_call' | 'agent_turn' | 'cron'
  name       text,                 -- tool name, cron path, etc.
  input      jsonb,
  output     jsonb,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists secretary_audit_log_created_idx on secretary_audit_log (created_at desc);
