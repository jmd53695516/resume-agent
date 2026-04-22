-- supabase/migrations/0001_initial.sql
-- Phase 1 target: sessions table. Phase 2 forward-compat: messages table.
-- Source: GATE-03 + RESEARCH.md Code Example "Supabase migration" + Plan 01-03.
--
-- Both tables are created in a single migration so Phase 2 does not need a
-- migration-on-migration. All writes happen server-side via the service-role
-- client (supabaseAdmin), which bypasses RLS. RLS is enabled on both tables
-- with ZERO policies in Phase 1. Phase 4 (admin dashboard) will add SELECT
-- policies for authenticated admin users.

create table if not exists public.sessions (
  id                      text primary key,
  email                   text not null,
  email_domain            text not null,
  ip_hash                 text not null,
  user_agent              text not null default '',
  created_at              timestamptz not null default now(),
  ended_at                timestamptz,
  turn_count              int not null default 0,
  flagged                 boolean not null default false,
  total_input_tokens      int not null default 0,
  total_output_tokens     int not null default 0,
  total_cache_read_tokens int not null default 0,
  total_cost_cents        int not null default 0
);

create index if not exists sessions_email_domain_idx on public.sessions (email_domain);
create index if not exists sessions_created_at_idx   on public.sessions (created_at desc);

-- messages table — empty in Phase 1, populated in Phase 2 by /api/chat onFinish.
create table if not exists public.messages (
  id                    text primary key,
  sdk_message_id        text,
  session_id            text not null references public.sessions(id) on delete cascade,
  role                  text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content               text not null,
  tool_name             text,
  tool_args             jsonb,
  tool_result           jsonb,
  classifier_verdict    text,
  classifier_confidence numeric,
  input_tokens          int not null default 0,
  output_tokens         int not null default 0,
  cache_read_tokens     int not null default 0,
  cache_creation_tokens int not null default 0,
  cost_cents            int not null default 0,
  latency_ms            int,
  stop_reason           text,
  created_at            timestamptz not null default now()
);

create index if not exists messages_session_id_idx on public.messages (session_id, created_at);
create index if not exists messages_classifier_idx on public.messages (classifier_verdict) where classifier_verdict <> 'normal';

-- RLS: enable on both tables, but deliberately DO NOT create policies in Phase 1.
-- All writes happen server-side via the service-role client (bypasses RLS).
-- Phase 4 (admin dashboard) will add SELECT policies for authenticated admin users.
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

comment on table public.sessions is 'One row per email-gated recruiter session. Service-role INSERT only.';
comment on table public.messages is 'Appended by /api/chat onFinish (Phase 2). Service-role INSERT only. No client-side writes.';
