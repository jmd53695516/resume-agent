-- supabase/migrations/0003_phase5.sql
-- Phase 5 Plan 05-02 — Eval gates schema (EVAL-14 storage + EVAL-05 A/B mapping).
--
-- Conventions (matches 0001/0002):
--   * Text PKs (nanoid generated in Node) — no pgcrypto extension dependency.
--   * RLS enabled on all tables; service-role writes bypass it. Admin reads via
--     service-role from server components (Phase 4 D-A-03 layered perimeter).
--   * timestamptz with default now() for created/started timestamps.
--   * Check constraints on enum-like columns to keep status/category values tight.
--
-- Tables:
--   eval_runs         — one row per `npm run eval` invocation
--   eval_cases        — per-case detail; one row per (run_id, case_id)
--   eval_calibrations — monthly human-vs-judge agreement (EVAL-12)
--   eval_ab_sessions  — blind A/B mapping (EVAL-05; RESEARCH §10)
--                       cookie-keyed, 1h TTL via expires_at, daily cleanup cron
--                       deletes expired+unsubmitted rows (Plan 05-08).

-- ============================================================================
-- eval_runs — one row per `npm run eval` invocation (CI, local, or weekly cron)
-- ============================================================================
CREATE TABLE public.eval_runs (
  id text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  target_url text NOT NULL,
  judge_model text NOT NULL,
  git_sha text,
  total_cases int NOT NULL DEFAULT 0,
  passed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  total_cost_cents int NOT NULL DEFAULT 0,
  scheduled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'passed', 'failed', 'error'))
);
CREATE INDEX eval_runs_started_at_idx ON public.eval_runs (started_at DESC);
CREATE INDEX eval_runs_scheduled_idx ON public.eval_runs (scheduled, started_at DESC);
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;
-- (no policies — service-role writes only; admin reads via service-role)

-- ============================================================================
-- eval_cases — per-case detail; one row per (run_id, case_id)
-- ============================================================================
CREATE TABLE public.eval_cases (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES public.eval_runs(id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (category IN ('cat1', 'cat2', 'cat3', 'cat4-judge', 'cat4-blind-ab', 'cat5', 'cat6')),
  case_id text NOT NULL,
  prompt text NOT NULL,
  response text,
  judge_score numeric,
  judge_verdict text CHECK (judge_verdict IN ('pass', 'fail') OR judge_verdict IS NULL),
  judge_rationale text,
  passed boolean NOT NULL,
  cost_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eval_cases_run_id_idx ON public.eval_cases (run_id);
CREATE INDEX eval_cases_category_idx ON public.eval_cases (category, created_at DESC);
ALTER TABLE public.eval_cases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- eval_calibrations — monthly human-vs-judge agreement (EVAL-12)
-- ============================================================================
CREATE TABLE public.eval_calibrations (
  id text PRIMARY KEY,
  calibrated_at timestamptz NOT NULL DEFAULT now(),
  eval_case_id text NOT NULL REFERENCES public.eval_cases(id) ON DELETE CASCADE,
  judge_score numeric NOT NULL,
  human_score numeric NOT NULL,
  delta numeric NOT NULL,
  notes text
);
CREATE INDEX eval_calibrations_calibrated_at_idx ON public.eval_calibrations (calibrated_at DESC);
ALTER TABLE public.eval_calibrations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- eval_ab_sessions — blind A/B mapping (EVAL-05). RESEARCH §10.
-- Cookie-keyed; 1h TTL via expires_at; daily cleanup cron deletes
-- expired+unsubmitted rows (Plan 05-08).
-- ============================================================================
CREATE TABLE public.eval_ab_sessions (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  shuffled_snippets jsonb NOT NULL,
  tester_role text CHECK (tester_role IN ('pm', 'non-pm', 'other') OR tester_role IS NULL),
  identifications jsonb,
  submitted_at timestamptz,
  eval_run_id text REFERENCES public.eval_runs(id) ON DELETE SET NULL
);
CREATE INDEX eval_ab_sessions_expires_idx ON public.eval_ab_sessions (expires_at);
ALTER TABLE public.eval_ab_sessions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.eval_runs IS
  'One row per `npm run eval` invocation (CI, local, or weekly drift cron). Service-role INSERT only.';
COMMENT ON TABLE public.eval_cases IS
  'Per-case detail; one row per (run_id, category, case_id). Service-role INSERT only.';
COMMENT ON TABLE public.eval_calibrations IS
  'Monthly human-vs-judge agreement records (EVAL-12). Service-role INSERT only.';
COMMENT ON TABLE public.eval_ab_sessions IS
  'Blind A/B mapping for cat4-blind-ab (EVAL-05). Cookie-keyed; rows TTL via expires_at + daily cleanup cron.';
