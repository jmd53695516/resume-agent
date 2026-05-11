---
phase: 05-eval-gates-launch
plan: 05-11
subsystem: cron-eval-weekly
tags: [eval-11, weekly-drift, repository-dispatch, alarms-5th-condition]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-10)
    provides: working .github/workflows/eval.yml that handles `repository_dispatch` of type `scheduled-eval` (Plan 05-10 wired the trigger types)
  - phase: 05-eval-gates-launch (Plan 05-02)
    provides: GH_DISPATCH_TOKEN already added as `.optional()` in src/lib/env.ts (Task 1 was a no-op confirmation)
  - phase: 04-admin-observability (Plan 04-06)
    provides: validateCronAuth + dispatchAlarm + per-condition NX suppression via Redis (resume-agent:alarms:fired:<condition>)
  - external: GitHub fine-grained PAT scoped to jmd53695516/resume-agent (Contents:read, Metadata:read, Actions:write); set in Vercel as GH_DISPATCH_TOKEN — Joe confirmed already present
provides:
  - "src/app/api/cron/run-eval/route.ts — POST endpoint dispatching GH Actions via api.github.com/repos/{owner}/{repo}/dispatches with event_type='scheduled-eval', client_payload.target_url=NEXT_PUBLIC_SITE_URL"
  - "src/lib/alarms.ts — 5th alarm condition `weekly-eval-failure` (queries eval_runs WHERE scheduled=true AND status='failed' AND finished_at >= now()-1h); 24h NX suppression via per-condition TTL override map (default 3600s; weekly-eval-failure=86400s)"
  - "runAllAlarms now runs 5 checks in parallel (was 4); spend-cap test still asserts ex:3600 unchanged"
affects: [05-12 launch (Steps C+D — cron-job.org schedule + smoke test — deferred into LAUNCH-01 domain rollout)]

# Tech tracking
tech-stack:
  added:
    - "(none — all reuse: validateCronAuth, dispatchAlarm, childLogger, supabaseAdmin)"
  patterns:
    - "Vercel function 60s timeout dodge: cron route does NOT spawn the eval CLI (3-5 min) — instead repository_dispatch hop into GH Actions which has the full runner. Same pattern available to any future long-running scheduled job"
    - "Per-condition NX suppression TTL via override map (SUPPRESSION_TTL_OVERRIDES + getSuppressionTtlSeconds helper) — minimally invasive vs adding a parameter to dispatchAlarm; spend-cap default 3600s preserved structurally"
    - "T-05-11-03 mitigation: target_url comes from process.env.NEXT_PUBLIC_SITE_URL, NEVER from request body — route ignores any client-supplied URL"

key-files:
  created:
    - "src/app/api/cron/run-eval/route.ts (95 lines) — POST handler with validateCronAuth + GH_DISPATCH_TOKEN runtime null-check + repository_dispatch fetch"
    - "tests/cron/run-eval.test.ts (186 lines) — 7 tests covering 401/503/502/200 paths plus event_type + client_payload assertions"
  modified:
    - "src/lib/alarms.ts — added AlarmCondition='weekly-eval-failure', SUPPRESSION_TTL_OVERRIDES map, getSuppressionTtlSeconds helper, checkWeeklyEvalFailure async fn, dynamic claimAlarmSuppression EX, 5th entry in runAllAlarms Promise.all"
    - "tests/lib/alarms.test.ts — added 8 tests (6 weekly-eval-failure + 2 TTL override); updated existing runAllAlarms count assertion 4→5; 29/29 passing"

# Verification
verification:
  build: "npx tsc --noEmit clean; npm run build clean (Next 16.2.4 Turbopack 7.0s)"
  tests: "tests/cron/run-eval.test.ts 7/7 ✓; tests/lib/alarms.test.ts 29/29 ✓; all 4 cron route test files 27/27 ✓ (no regressions)"
  acceptance:
    - "EVAL-11 code path live: POST /api/cron/run-eval validates Bearer → reads GH_DISPATCH_TOKEN → POSTs to api.github.com/dispatches → returns 200 dispatched_to:'github-actions' (or 503 if token unset, 502 on GH failure)"
    - "5th alarm condition wired with 24h NX suppression (RESEARCH §Open Question 2 + orchestrator-locked decision)"
    - "Threat register T-05-11-01..06 all addressed (PAT scope, validateCronAuth gating, target_url from env not body, runAllAlarms test pins count=5)"

# Status
status: partial
status_reason: |
  Tasks 1-3 (env confirmation, route, 5th alarm) — DONE.
  Task 4 split: Steps A+B (GH PAT created + GH_DISPATCH_TOKEN/GH_REPO_SLUG set in Vercel) — DONE per Joe's confirmation 2026-05-10. Steps C+D (cron-job.org weekly schedule + integration smoke producing scheduled=true eval_runs row) — DEFERRED into Plan 05-12 because cron-job.org schedule needs a stable prod URL and LAUNCH-01 sets the custom subdomain (chat.joedollinger.com) in 05-12. Pointing cron-job.org at the Vercel preview alias now would require re-pointing after the CNAME flip; cleaner to set it once against the final domain.

# Deferred items (handed to 05-12)
deferred:
  - id: 05-11-deferred-1
    description: "Configure cron-job.org weekly Mon 03:00 ET schedule POST→ /api/cron/run-eval with Authorization: Bearer <CRON_SECRET>; smoke-test produces scheduled=true eval_runs row + GH Actions repository_dispatch run"
    handoff: "Plan 05-12 (LAUNCH-01) — must be configured AFTER custom-subdomain CNAME is live and Vercel domain is verified"
    blocking: "EVAL-11 verification (the route is live; the schedule is the missing wire)"
    estimate: "10-15 minutes once domain is live"

# Commits
commits:
  - sha: 6406221
    title: "feat(05-11): add POST /api/cron/run-eval dispatching GH Actions"
  - sha: 69f63f7
    title: "feat(05-11): add weekly-eval-failure 5th alarm condition with 24h NX"

# Notes
notes:
  - "Plan said default GH_REPO_SLUG=joedollinger/agent-for-interviews; route uses jmd53695516/resume-agent (per project memory + 05-10-SUMMARY). GH_REPO_SLUG env var overrides for repo renames"
  - "Test file landed at tests/cron/run-eval.test.ts (matches existing tests/cron/* layout) rather than plan's src/lib/__tests__/api/cron/run-eval.test.ts"
  - "Response 204 caveat: tests assert status:200 because the platform Response constructor in this test env rejects 204 with body; runtime behavior is identical (res.ok true for both); GH actually returns 204 No Content"
  - "PAT rotation: 90-day expiry — set calendar reminder for ~2026-08-08 to rotate (Joe will receive GitHub email reminder ~7 days before)"
---
