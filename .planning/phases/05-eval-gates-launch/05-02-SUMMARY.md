---
phase: 05-eval-gates-launch
plan: 05-02
subsystem: testing
tags: [eval-scaffolding, supabase-migration, github-actions, judge-model-pin, env-schema]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-01)
    provides: GO verdict — Phase 5 eval work unblocked
  - phase: 04-admin-observability
    provides: Phase 4 text-PK + nanoid + RLS migration pattern (0002_phase4.sql)
  - phase: 01-foundation-content
    provides: Phase 1 text-PK pattern (0001_initial.sql)
provides:
  - supabase/migrations/0003_phase5.sql (4 tables: eval_runs, eval_cases, eval_calibrations, eval_ab_sessions; RLS enabled; check constraints; indexes)
  - .github/workflows/eval.yml (no-op scaffold on master with locked workflow_name=eval / job_name=eval — RESEARCH Pitfall 3 + §3 naming-lock)
  - src/lib/eval-models.ts exporting JUDGE_PROVIDER, JUDGE_MODEL_SNAPSHOT, JUDGE_MODEL, EVAL_COST_WARN_USD
  - src/lib/env.ts extended with 4 optional Phase 5 env vars (GOOGLE_GENERATIVE_AI_API_KEY, EVAL_JUDGE_MODEL, EVAL_TARGET_URL, GH_DISPATCH_TOKEN)
  - @ai-sdk/google@^3.0.71 installed
affects: [05-03 (writes to eval_runs/eval_cases via storage.ts), 05-04..05-09 (all cat runners reference JUDGE_MODEL + check constraint values), 05-10 (branch protection binds against locked workflow/job names), 05-13 (weekly cron uses workflow_dispatch)]

# Tech tracking
tech-stack:
  added:
    - "@ai-sdk/google@^3.0.71 (Gemini provider for judge wrapper in Plan 05-03)"
  patterns:
    - "Snapshot-pin (not alias) for the judge model — `gemini-2.5-flash-preview-09-2025` per RESEARCH Pitfall 4; bumping the pin requires a deliberate PR (auditable in git history)"
    - "Workflow + job name LOCK ('eval' / 'eval:') — GitHub branch protection in Plan 05-10 binds against this pair; renaming silently breaks the required-check binding"
    - "Workflow MUST exist on default branch BEFORE any repository_dispatch event fires (RESEARCH Pitfall 3) — hence the no-op scaffold lands ahead of the real eval CLI invocation"
    - "JUDGE_MODEL uses `||` not `??` for env override — empty-string env values fall back to JUDGE_MODEL_SNAPSHOT instead of being treated as a valid override"

key-files:
  created:
    - "supabase/migrations/0003_phase5.sql (104 lines — 4 CREATE TABLE + 5 indexes + 4 ALTER TABLE ENABLE RLS)"
    - ".github/workflows/eval.yml (27 lines — no-op scaffold with locked names + workflow_dispatch + repository_dispatch types vercel.deployment.ready + scheduled-eval)"
    - "src/lib/eval-models.ts (22 lines — 4 exported constants)"
    - "tests/lib/eval-models.test.ts (62 lines — 8 tests)"
  modified:
    - "src/lib/env.ts (+8 lines — 4 optional Phase 5 zod fields)"
    - "package.json + package-lock.json (@ai-sdk/google@^3.0.71 dep bump; +46 lock lines)"

key-decisions:
  - "JUDGE_MODEL_SNAPSHOT pinned to literal 'gemini-2.5-flash-preview-09-2025' (snapshot ID, not alias 'gemini-2.5-flash') — bumping requires a deliberate PR per RESEARCH Pitfall 4 calibration concern"
  - "EVAL_COST_WARN_USD = 1.5 — orchestrator-locked override of CONTEXT D-A-07's $1.00 because RESEARCH §6 cold-cache cost model showed ~$1.30/run real cost; $1.00 would false-warn on every cold run"
  - "JUDGE_MODEL falls back to snapshot via `||` (not `??`) so an empty-string EVAL_JUDGE_MODEL env value is treated as 'unset', not as a legitimate model id"
  - "Workflow name = literal 'eval' + job key = literal 'eval' — locked. Plan 05-10 branch protection matches workflow_name/job_name pair; renaming either silently breaks the required-check binding"
  - "No-op step (`exit 0`) on master FIRST per RESEARCH Pitfall 3 — repository_dispatch events only fire workflows on the default branch, so the file MUST exist there before any vercel.deployment.ready event"
  - "All 4 new env vars are `.optional()` — chat path must still load env without them; eval CLI is the only consumer in v1"
  - "Test file moved from src/lib/__tests__/ to tests/lib/eval-models.test.ts to match repo's vitest config (`include: tests/**/*.test.{ts,tsx}`) — established convention going forward for all Phase 5 tests"
  - "Text PKs (nanoid in Node) on all 4 new tables — matches Phase 1/4 convention; no pgcrypto extension dependency"
  - "RLS enabled on all 4 tables; service-role writes bypass it; admin reads via service-role from server components (Phase 4 D-A-03 layered perimeter)"
  - "eval_cases.category check constraint values authoritatively define the 7 valid categories (cat1, cat2, cat3, cat4-judge, cat4-blind-ab, cat5, cat6) — Plan 05-03's CategorySchema must match this list exactly"

patterns-established:
  - "Eval test path convention: tests/lib/eval/ (NOT src/lib/__tests__/eval/) — vitest discovers tests/**/*.test.{ts,tsx} only; carried forward to Plans 05-03..05-07 where every plan's frontmatter listed src/lib/__tests__/ and was auto-fixed to tests/lib/eval/"
  - "Snapshot-pinning a model id behind an env-overridable constant: const SNAPSHOT = literal-id; const VAR = process.env.OVERRIDE || SNAPSHOT — reusable for any future model pin (Anthropic, OpenAI)"
  - "PowerShell .env.local edits must use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)` — `Set-Content -Encoding utf8` writes a UTF-8 BOM that supabase db push rejects with 'unexpected character »'"

requirements-completed: [EVAL-13, EVAL-14]

# Metrics
duration: same-session as Plan 05-01 close-out (commit 90e55b9 dated 2026-05-09)
completed: 2026-05-09
---

# Phase 5 Plan 05-02: Eval-Gates Scaffolding Summary

**One-commit landing of the Phase 5 foundation: 0003_phase5.sql migration pushed to live Supabase (4 tables with RLS + check constraints), .github/workflows/eval.yml no-op scaffold on master with locked workflow/job names, judge-model + cost-warn constants pinned in src/lib/eval-models.ts, 4 optional eval env vars added to src/lib/env.ts, @ai-sdk/google installed; 352/352 tests pass (+8 from eval-models.test.ts).**

## Performance

- **Duration:** single working session (commit 90e55b9 on 2026-05-09)
- **Tasks:** 4 (migration + db push, env + dep, eval-models constants + tests, workflow scaffold)
- **Files modified:** 7 (4 created, 3 modified including package-lock)
- **Net additions:** +270 lines

## Accomplishments

- `supabase/migrations/0003_phase5.sql` authored (104 lines) creating 4 tables: `eval_runs`, `eval_cases`, `eval_calibrations`, `eval_ab_sessions`. All have RLS enabled; check constraints on enum-like columns (`status`, `category`, `judge_verdict`, `tester_role`); indexes on common query paths (started_at DESC, scheduled, run_id, category, expires_at).
- `supabase db push` ran successfully against live Supabase project `dpbqafdnsceulkpwxzzz` — all 4 tables present in the live DB; downstream plans can write without runtime 42P01 errors.
- `.github/workflows/eval.yml` (27 lines) — no-op scaffold on master with locked `name: eval` + `jobs.eval:` + `on.repository_dispatch.types: ['vercel.deployment.ready', 'scheduled-eval']` + `workflow_dispatch: {}`. Step body just echoes the event name + payload URL and `exit 0`. Plan 05-10 will replace the body with the real `npm run eval` invocation.
- `src/lib/eval-models.ts` (22 lines) exports `JUDGE_PROVIDER = 'google' as const`, `JUDGE_MODEL_SNAPSHOT = 'gemini-2.5-flash-preview-09-2025'`, `JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || JUDGE_MODEL_SNAPSHOT`, `EVAL_COST_WARN_USD = 1.5` (with `process.env.EVAL_COST_WARN_USD` parseFloat override path).
- `tests/lib/eval-models.test.ts` (62 lines) — 8 tests covering snapshot pin literal, env-override path, cost-warn default + override, JUDGE_PROVIDER literal.
- `src/lib/env.ts` extended with 4 optional Phase 5 zod fields: `GOOGLE_GENERATIVE_AI_API_KEY` (string min 20, optional), `EVAL_JUDGE_MODEL` (string optional), `EVAL_TARGET_URL` (z.url optional), `GH_DISPATCH_TOKEN` (string min 10 optional).
- `@ai-sdk/google@^3.0.71` installed (Gemini provider for Plan 05-03 judge wrapper).
- 352/352 tests pass (43 files; +8 new from eval-models.test.ts).

## Task Commits

All four tasks shipped in a single combined commit:

1. **Phase 5 eval scaffolding** — `90e55b9` (feat) — migration + db push + workflow + eval-models + env vars + dep bump

## Files Created/Modified

- `supabase/migrations/0003_phase5.sql` (created) — 4 tables. `eval_runs` has status check ('running','passed','failed','error') + scheduled boolean + total_cost_cents int + indexes on started_at DESC and (scheduled, started_at DESC). `eval_cases` has category check covering all 7 cat values + judge_verdict check ('pass','fail',NULL) + foreign key to eval_runs ON DELETE CASCADE. `eval_calibrations` for monthly human-vs-judge agreement (EVAL-12). `eval_ab_sessions` for blind A/B mapping (EVAL-05) with 1h TTL via expires_at + tester_role check + jsonb shuffled_snippets + jsonb identifications.
- `.github/workflows/eval.yml` (created) — no-op CI scaffold. `name: eval`. `jobs.eval` runs on `ubuntu-latest` with `timeout-minutes: 10`. Single step echoes event metadata and `exit 0`. Plan 05-10 replaces the step body with real eval CLI invocation.
- `src/lib/eval-models.ts` (created) — `JUDGE_PROVIDER = 'google' as const`; `JUDGE_MODEL_SNAPSHOT = 'gemini-2.5-flash-preview-09-2025'`; `JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || JUDGE_MODEL_SNAPSHOT`; `EVAL_COST_WARN_USD` IIFE handles env-override-or-default-to-1.5.
- `tests/lib/eval-models.test.ts` (created) — 8 tests using `vi.stubEnv()` + `vi.resetModules()` to test env-override paths.
- `src/lib/env.ts` (modified, +8 lines) — appended `// Phase 5 optional (Plan 05-02 — eval harness)` block with 4 optional fields.
- `package.json` (modified, +1 line) — `@ai-sdk/google` added to dependencies.
- `package-lock.json` (modified, +46 lines) — lockfile sync.

## Decisions Made

- **Snapshot pin (not alias) for judge model**: RESEARCH Pitfall 4 calls out that alias-tracking ('gemini-2.5-flash') silently rolls users to the latest underlying model, which can cause judge-calibration drift mid-run. Snapshot-id pin ('gemini-2.5-flash-preview-09-2025') is auditable; bumping is a deliberate PR. Calibration check (EVAL-12) re-runs on bump.
- **Cost-warn raised from $1.00 to $1.50**: CONTEXT D-A-07 specified $1.00. RESEARCH §6 cold-cache cost model showed ~$1.30/run is realistic. $1.00 would false-warn on every fresh cache. Joe locked $1.50 at planning time.
- **`||` not `??` for JUDGE_MODEL fallback**: Empty-string env values (e.g., `EVAL_JUDGE_MODEL=` in some CI setups) should fall back to the snapshot, not be treated as a valid override. `??` only falls back on `null`/`undefined`; `||` falls back on empty string too.
- **Workflow + job name lock**: `name: eval` + `jobs.eval:`. RESEARCH §3 — branch protection (Plan 05-10) matches workflow_name/job_name pair; renaming either side silently breaks the required-check binding. Locked + commented in the YAML.
- **No-op scaffold on master FIRST**: RESEARCH Pitfall 3 — `repository_dispatch` events only fire workflows on the default branch. The file MUST exist on master BEFORE Vercel sends `vercel.deployment.ready`. This commit lands the no-op so Plan 05-10 can replace just the step body.
- **All 4 env vars optional**: Chat path must still load `.env.local` without them. Eval CLI is the only consumer in v1.
- **Test path convention shift**: Plan frontmatter listed `src/lib/__tests__/eval-models.test.ts`; vitest config only includes `tests/**/*.test.{ts,tsx}`. Test moved to `tests/lib/eval-models.test.ts`. This established the convention that all subsequent eval tests follow (Plans 05-03..05-07 each had to auto-fix the same path issue).

## Issues Encountered

- **PowerShell BOM tripping `supabase db push`**: `Set-Content -Encoding utf8` had previously written `.env.local` with a UTF-8 BOM (EF BB BF). `supabase db push` rejected this with `unexpected character '»' in variable name`. Stripped the BOM before push. Pattern recorded for future PowerShell .env edits: use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)`.

## User Setup Required

- For live use of the eval CLI (Plans 05-03+): Joe must add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local` (Plans 05-03..05-07 are unit-test-green without it; live judge runs require it).
- For Plan 05-10 branch protection: workflow file MUST be on master before any feature branch tries to rely on it as a required check (already satisfied by this commit).

## Known Stubs

- `.github/workflows/eval.yml` step body is a single `echo + exit 0` (no-op). Plan 05-10 replaces it with the real `npm run eval` invocation including secret injection (GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.).

## Next Phase Readiness

- **Ready: Plan 05-03 (eval CLI core)** — can `INSERT INTO eval_runs/eval_cases` against live tables; can import `JUDGE_MODEL` from `@/lib/eval-models`; can use `@ai-sdk/google` for the judge wrapper.
- **Ready: Plans 05-04..05-09** — CategorySchema in Plan 05-03's types.ts must match the 7 values in eval_cases.category check constraint exactly.
- **Ready: Plan 05-10 (branch protection)** — workflow file on master with locked names; just bind 'eval / eval' as required check on `main`.
- **Deferred to runtime**: live judge calls require GOOGLE_GENERATIVE_AI_API_KEY (env var optional in zod, but Gemini will reject calls without it).

## Self-Check: PASSED

- supabase/migrations/0003_phase5.sql: FOUND (104 lines, 4 CREATE TABLE statements, 4 ENABLE RLS)
- .github/workflows/eval.yml: FOUND (`name: eval`, `jobs.eval:` present)
- src/lib/eval-models.ts: FOUND (exports JUDGE_PROVIDER, JUDGE_MODEL_SNAPSHOT, JUDGE_MODEL, EVAL_COST_WARN_USD)
- tests/lib/eval-models.test.ts: FOUND
- src/lib/env.ts: 4 new fields present (GOOGLE_GENERATIVE_AI_API_KEY, EVAL_JUDGE_MODEL, EVAL_TARGET_URL, GH_DISPATCH_TOKEN)
- @ai-sdk/google in package.json: FOUND (^3.0.71)
- Commit 90e55b9: FOUND
- Test count: 352/352 passing (43 files)

---
*Phase: 05-eval-gates-launch*
*Completed: 2026-05-09*
