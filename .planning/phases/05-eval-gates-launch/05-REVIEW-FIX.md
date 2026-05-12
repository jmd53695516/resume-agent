---
phase: 05-eval-gates-launch
fixed_at: 2026-05-12T01:05:00Z
review_path: .planning/phases/05-eval-gates-launch/05-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
prior_iteration_report: see "Prior Iteration (1) Summary" section below
---

# Phase 05: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-05-12
**Source review:** .planning/phases/05-eval-gates-launch/05-REVIEW.md (fix-verification re-review)
**Iteration:** 2

**Summary:**
- Findings in scope: 1 (1 Warning; 3 Info skipped per scope filter)
- Fixed: 1
- Skipped: 0

The iteration-2 re-review (scope: fix-verification, 12 files) confirmed all 8 original findings (CR-01, CR-02, WR-01..06) are correctly addressed by iteration-1 commits. One new Warning (WR-RE-01) surfaced during re-review: the cat2 spend-cap reset loop's per-iteration log-and-continue catch was test-invisible. This iteration addresses that.

## Fixed Issues

### WR-RE-01: Cat2 spend-cap reset loop silently swallows individual-key restore failures with no per-test mock surface to verify recovery

**Files modified:** `tests/lib/eval/cats/cat2.test.ts`
**Commit:** 4cbb497
**Applied fix:**
- Added a module-scope `vi.mock('@/lib/logger')` block exposing `loggerInfoMock` / `loggerWarnMock` / `loggerErrorMock`, mirroring the established pattern in `tests/lib/eval/storage.test.ts:32-35` and `tests/lib/eval/ab-mapping.test.ts:88`.
- Wired the three logger mocks into `beforeEach`'s `mockReset()` list so each test starts with a clean call history.
- Added a new test `spend-cap reset continues across remaining buckets when one redis.del throws (log-and-continue)` that:
  1. Configures `redisMgetMock` to return 24 null originals (all buckets empty pre-test).
  2. Configures `redisDelMock` to throw `redis transient: ECONNRESET` on its 2nd call (index 1 — first non-current-hour bucket) and succeed on all others.
  3. Verifies `redisDelMock` was invoked 24 times despite the mid-loop throw (proves the per-iteration try/catch in `cat2.ts:249-267` correctly suppresses the failure and continues).
  4. Verifies the failure surfaced via `loggerErrorMock` with `cat2_spendcap_reset_failed` tag and the expected `err: 'redis transient: ECONNRESET'` payload (proves the catch's log line is wired through `childLogger().error`).
  5. Verifies the case-level assertion still passes (`result.cases[0].passed === true`) — a partial reset glitch doesn't fail the eval run.
- This closes the gap noted in WR-RE-01: a future regression where `redis.set`/`redis.del` throws during restore would now be caught by the test harness via the logger.error mock-call count instead of being absorbed silently. The original CR-01 concern ("tests pass while the production contract is violated") no longer applies on the failure path.
- Production code in `src/lib/eval/cats/cat2.ts` is unchanged — the log-and-continue catch is the documented T-05-05-01 disposition and is already correct. The fix is test-only (added test surface, not changed behavior).

**Verification:**
- `npx tsc --noEmit`: clean.
- `npx vitest run tests/lib/eval/cats/cat2.test.ts`: 14/14 pass (was 13 — new test added).
- `npx vitest run tests/lib/eval/`: 176/176 pass — no cross-test contamination from the new module-scope `@/lib/logger` mock.

## Skipped Issues

None in scope. The re-review's 3 Info findings (IN-RE-01 beforeEach order, IN-RE-02 email.ts comment already present, IN-RE-03 admin UI orphan-link fallback) are out of scope for `fix_scope=critical_warning`. IN-RE-02 is already addressed in the existing code per the reviewer's own note ("comment is already accurate; no action needed"). IN-RE-01 and IN-RE-03 remain as follow-up candidates for a future iteration if Joe wants to file them.

---

## Prior Iteration (1) Summary

Iteration 1 fixed all 8 original findings from `05-REVIEW.md` (status: `clean` after fix-verification):

| Finding | Commit | Files | Summary |
|---|---|---|---|
| CR-01 (cat2 spend-cap key mismatch) | `1a71206` | `cat2.ts`, `cat2.test.ts` | Switched runner from single `YYYY-MM-DD` key to 24 hourly buckets matching `getSpendToday()`'s `hourBucketKey()` read pattern. |
| CR-02 (synthetic session emails) | `d75a13d` | `email.ts`, `email.test.ts` | Pre-check SELECT short-circuits `@joedollinger.dev` synthetic-eval sessions before the atomic UPDATE claim. |
| WR-01 (Exa heartbeat-trust gap) | `eaa360c` | `alarms.ts`, `alarms.test.ts` | Option (b): added separate `research-company-error-rate` alarm querying `messages` table for tool-result errors. |
| WR-02 (heartbeat anthropic stale read) | `7cf1a1d` | `cron/heartbeat/route.ts` | `anthropicWriteOk` gating mirrors exa/classifier write-then-trust pattern in prewarm-disabled branch. |
| WR-03 (classifier verdict shape) | `7cf1a1d` | `tests/cron/heartbeat.test.ts` | Mock returns real `ClassifierVerdict` `{label, confidence}` shape; new explicit fail-closed-sentinel test. |
| WR-04 (overly permissive regex) | `1a71206` | `cat2.ts` (bundled with CR-01) | Tightened to `taking a breather for the day` (unique to spendcap). |
| WR-05 (PGRST discrimination) | `a44eb1f` | `health.ts`, `health.test.ts` | PGRST-prefix codes → `ok`; non-PGRST → `degraded`; mirrors BL-17 fix. |
| WR-06 (orphan eval_run risk) | `c0f5c86` | `ab-mapping.ts`, `ab-mapping.test.ts` | Atomic claim BEFORE `createRun()`; backfill `eval_run_id` after. |

Iteration-1 totals: 8/8 fixed, 0 skipped. Full iteration-1 report is preserved in git history at `1b742e3 docs(05): add code review fix report`.

---

_Fixed: 2026-05-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
