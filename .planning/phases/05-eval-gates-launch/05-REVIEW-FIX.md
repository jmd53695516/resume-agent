---
phase: 05-eval-gates-launch
fixed_at: 2026-05-12T00:50:00Z
review_path: .planning/phases/05-eval-gates-launch/05-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-05-12
**Source review:** .planning/phases/05-eval-gates-launch/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (2 Critical + 6 Warning; Info skipped per scope filter)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Cat 2 synthetic spend-cap test sets a key the production gate never reads

**Files modified:** `src/lib/eval/cats/cat2.ts`, `tests/lib/eval/cats/cat2.test.ts`
**Commit:** 1a71206
**Applied fix:**
- Replaced single `resume-agent:spend:YYYY-MM-DD` key with 24 hourly buckets matching `getSpendToday()`'s `hourBucketKey` read pattern (slice 0,13 = `YYYY-MM-DDTHH`).
- Capture all 24 originals via `redis.mget` before mutating; restore via per-key SET/DEL in `finally`.
- Set only the current-hour bucket to 350 (one bucket > 300 trips `isOverCap` because `getSpendToday` sums all 24).
- Also tightened `assertSpendCapDeflection` regex to pin on the spendcap-unique phrase `"taking a breather for the day"` (resolves WR-04 as a side effect).
- Updated unit tests to assert the hourly-bucket key format and the per-bucket restore semantics.

### CR-02: Eval CLI triggers session-notification emails when run against prod

**Files modified:** `src/lib/email.ts`, `tests/lib/email.test.ts`
**Commit:** d75a13d
**Applied fix:**
- Added `EVAL_SYNTHETIC_EMAIL_SUFFIX = '@joedollinger.dev'` constant.
- Inserted pre-check SELECT inside `claimAndSendSessionEmail` that reads `email` + `first_email_sent_at` BEFORE the atomic UPDATE claim.
- Synthetic-email sessions short-circuit with `event: session_email_skipped_eval` log; no UPDATE, no send, no consumed `first_email_sent_at` slot.
- Pre-check also opportunistically skips already-claimed sessions to avoid an unnecessary UPDATE round-trip.
- PGRST116 ("no rows") from the pre-check returns silently (expected race condition); other pre-check errors log `error`.
- Added 3 new tests covering: synthetic-email short-circuit, already-claimed short-circuit, PGRST116 silent return.

### WR-01: `pingExa` heartbeat-trust pattern makes Exa outages invisible to dep-down alarm

**Files modified:** `src/lib/alarms.ts`, `tests/lib/alarms.test.ts`
**Commit:** eaa360c
**Applied fix:**
- Chose Option (b) from the review: added a separate `research-company-error-rate` alarm condition instead of paying for a real Exa probe per cron fire.
- New function `checkResearchCompanyErrorRate(windowHours=1, minSample=3, threshold=0.5)`: queries `messages` table for `role='tool' AND tool_name='research_company' AND created_at >= since`, detects errors by inspecting `tool_result.error` (the structured return from `research-company.ts:74`).
- Wired into `runAllAlarms` as the 6th condition (Promise.all expanded from 5 to 6).
- Extended `AlarmCondition` union with `'research-company-error-rate'`.
- Added 6 new tests covering: sub-sample skip, >50% trip, exact 50% no-trip, null-tool_result treated as success, query-failure fail-safe, exposure in runAllAlarms.

### WR-02: Heartbeat route reads `pingAnthropic` BEFORE writing `heartbeat:anthropic` when prewarm disabled (stale read)

**Files modified:** `src/app/api/cron/heartbeat/route.ts`
**Commit:** 7cf1a1d (combined with WR-03)
**Applied fix:**
- Introduced `anthropicWriteOk` boolean inside the prewarm-disabled branch; set `true` after successful `redis.set('heartbeat:anthropic', ...)`.
- Updated `anthropicStatus` ternary: when prewarm is disabled, report `'ok'` iff `anthropicWriteOk === true`, mirroring the exa/classifier heartbeat-trust post-write pattern.
- Comment annotated as WR-02 fix with reference to the BL-13 symmetric fix.

### WR-03: Classifier verdict shape mismatch in heartbeat test mock

**Files modified:** `tests/cron/heartbeat.test.ts`
**Commit:** 7cf1a1d (combined with WR-02)
**Applied fix:**
- Updated hoisted mock + `beforeEach` mock for `classifyUserMessage` to return real `ClassifierVerdict` shape: `{ label: 'normal', confidence: 0.9 }` (was `{ verdict: 'allow', ... }` — wrong field name AND a value not in the enum).
- Added new test `logs warning and skips heartbeat:classifier write when live call returns fail-closed sentinel (WR-03)`: explicitly exercises the fail-closed-sentinel branch by mocking `{ label: 'offtopic', confidence: 1.0 }` and asserting (a) no `heartbeat:classifier` write, (b) `heartbeat_classifier_failed` warn log with the specific sentinel message, (c) `statuses.classifier: 'degraded'` in the heartbeat log.

### WR-04: `assertSpendCapDeflection` regex overly permissive

**Files modified:** Already covered by CR-01 fix in `src/lib/eval/cats/cat2.ts`
**Commit:** 1a71206 (bundled with CR-01)
**Applied fix:**
- Regex tightened from broad `taking a breather|back tomorrow|email Joe directly|come back|few hours|spend cap|capacity|rate limit` to the spendcap-unique phrase `taking a breather for the day`.
- Rationale changed to expose `isSpendcapText` instead of generic `isDeflection`.
- The ratelimit deflection no longer matches; nor does generic Sonnet "capacity" prose.

### WR-05: `pingSupabase` treats any PostgREST error as degraded

**Files modified:** `src/lib/health.ts`, `tests/lib/health.test.ts`
**Commit:** a44eb1f
**Applied fix:**
- Inside the `result.error` branch of `pingSupabase`, discriminate PGRST-prefixed error codes (PostgREST-validated request, server healthy) from real infrastructure errors. PGRST116 / PGRST301 etc. → return `'ok'`; non-PGRST codes → return `'degraded'`.
- Mirrors the BL-17 fix in `/api/chat` route.ts.
- Strengthened the inline comment on the `.then((r) => r)` thenable-to-Promise coercion to emphasize "DO NOT REMOVE" — addresses the secondary concern in WR-05.
- Added 3 new tests covering: PGRST116 returns ok, arbitrary PGRST-prefix codes return ok, non-PGRST codes (e.g. `08006`) return degraded.

### WR-06: `validateAndScoreAbSession` writes eval_run row BEFORE marking session submitted (orphan-run risk)

**Files modified:** `src/lib/eval/ab-mapping.ts`, `tests/lib/eval/ab-mapping.test.ts`
**Commit:** c0f5c86
**Applied fix:**
- Reordered: atomic claim (`update ... where submitted_at IS NULL`) NOW happens BEFORE `createRun()` is invoked. The claim writes `identifications + submitted_at + tester_role` (NOT `eval_run_id` since the run doesn't exist yet).
- If claim returns no rows (`PGRST116` — lost the race or already submitted), function throws `validateAndScoreAbSession: session already submitted` and createRun is never called — no orphan eval_runs row.
- A separate backfill UPDATE writes `eval_run_id` after `createRun()` returns. A crash between the run-write and the backfill leaves `eval_run_id=NULL`, which is a documented soft-fail (the run is still discoverable by `case_id='cat4-blind-ab-${sessionId}'`).
- Mirrors the `claimAndSendSessionEmail` atomic-claim pattern.
- Extended test mock chain to support `update().eq().is().select().single()` for the atomic claim AND retained the simpler `update().eq()` for the backfill.
- Added 2 new tests: (a) WR-06 ordering — claim fires BEFORE createRun via timestamps, (b) atomic claim returning no rows throws `/already submitted/` AND createRun/writeCase/updateRunStatus are NOT invoked.

---

## Verification

**TypeScript:** `npx tsc --noEmit` — clean, no errors.

**Tests (per-fix):**
- `cat2.test.ts`: 13/13 pass (CR-01 + WR-04)
- `email.test.ts`: 12/12 pass (3 new for CR-02)
- `alarms.test.ts`: 35/35 pass (6 new for WR-01)
- `heartbeat.test.ts`: 11/11 pass (1 new for WR-03; WR-02 production code change covered by existing tests)
- `health.test.ts`: 22/22 pass (3 new for WR-05)
- `ab-mapping.test.ts`: 18/18 pass (2 new for WR-06)
- `chat-bl17-session-error.test.ts` + `chat-tools.test.ts`: 9/9 pass (regression check on CR-02 — no chat-route fallout)

**Build:** `npm run build` — successful, all routes compile.

**Pre-existing failures (NOT caused by this iteration):**
The full vitest suite shows 12 failing test files in React component tests (`tests/admin/*.test.tsx`, `tests/components/MessageBubble.test.tsx`, `tests/components/ChatUI-fallback-redirect.test.tsx`, etc.) and `tests/lib/logger.test.ts`. These were verified pre-existing at commit `3586846` (the parent of the first fix in this iteration). None of the failing files were touched by any of these fixes.

---

_Fixed: 2026-05-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
