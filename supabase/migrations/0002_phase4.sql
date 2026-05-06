-- supabase/migrations/0002_phase4.sql
-- Phase 4 admin & observability — D-G-01.
-- Adds:
--   1. sessions.first_email_sent_at — idempotency guard for per-session email
--      notification (D-C-05). Atomic UPDATE-with-IS-NULL pattern in
--      /api/chat onFinish ensures exactly-once email send across concurrent
--      requests for the same session.
--   2. alarms_fired — history table for /admin/health "last 5 alarms" widget
--      (D-B-09). Written by /api/cron/check-alarms when an alarm condition
--      trips and is not currently suppressed by its Redis 1h TTL key (D-C-07).
--      Service-role-only; RLS enabled with NO policies (admin reads via service role).

alter table public.sessions
  add column if not exists first_email_sent_at timestamptz;

create table if not exists public.alarms_fired (
  id              text primary key,
  condition       text not null,
  fired_at        timestamptz not null default now(),
  resend_send_id  text,
  body_summary    text
);

create index if not exists alarms_fired_fired_at_idx
  on public.alarms_fired (fired_at desc);

alter table public.alarms_fired enable row level security;
-- No SELECT/INSERT policies in Phase 4 — service-role bypasses RLS.
-- Phase 5 may add an admin-only SELECT policy if /admin SELECTs ever
-- migrate off the service-role client.

comment on column public.sessions.first_email_sent_at is
  'Per-session notification email idempotency guard (D-C-05). NULL = not yet sent. Atomic UPDATE ... WHERE first_email_sent_at IS NULL ensures exactly-once.';
comment on table public.alarms_fired is
  'Alarm-fire audit trail for /admin/health (D-B-09). Service-role INSERT only. id is a nanoid generated in cron route.';
