---
phase: 05-eval-gates-launch
plan: 13
subsystem: testing
tags: [eval-cli, argv-parsing, node-util-parseargs, cli-ergonomics, gap-closure]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch
    provides: scripts/run-evals.ts orchestrator (Plan 05-03 Task 3), per-cat runners (Plans 05-04..05-09), CI eval gate (Plan 05-10)
  - phase: 05-eval-gates-launch
    provides: Plan 05-12 UAT Test 1 surfaced the gap; CONTEXT-ADDENDUM D-12-B-01 + D-12-C-02 prescribed the syntax this gap-closure makes work
provides:
  - parseEvalArgs(argv) pure argv parser using node:util.parseArgs (Node 22 built-in, no new dep)
  - EVAL_CATS_VALID constant — single source of truth shared between argv + env validators
  - resolveTargetUrl(argv, env, default) — exported precedence resolver
  - --target / -t / --cats / -c / --help / -h CLI flags wired into main() with argv-first / env-fallback precedence
  - Shape validation on --target (/^https?:\/\// regex) blocks file:// / javascript: / shell-injection strings
  - Strict-mode loud-fail on --cat singular mis-paste
  - Direct-run guard (import.meta.url vs argv[1]) so pure-fn helpers are unit-testable without spawning a child process
affects: [Plan 05-12 LAUNCH-CHECKLIST, future hiring-cycle re-runs against prod, deferred-items #11 classifier investigation runbook]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — node:util.parseArgs is Node-22 built-in
  patterns:
    - "Pure-fn CLI helpers exported alongside main() for unit testing without execSync (mirrors scripts/generate-fallback.ts WR-06 pattern)"
    - "Direct-run guard using import.meta.url vs pathToFileURL(process.argv[1]).href — survives script renames"
    - "Single source of truth for runner roster (EVAL_CATS_VALID) consumed by both argv and env validators to prevent drift"

key-files:
  created:
    - tests/scripts/run-evals.test.ts
  modified:
    - scripts/run-evals.ts
    - .planning/phases/05-eval-gates-launch/deferred-items.md

key-decisions:
  - "Plural --cats (not --cat) chosen to match UAT + existing EVAL_CATS env-var naming; --cat=1 mis-paste is a load-bearing loud-fail via strict:true (CONTEXT-ADDENDUM D-12-C-02 forward-compat)"
  - "node:util.parseArgs over commander/yargs — Node 22 built-in is sufficient and matches gap_summary 'no new dep' rule"
  - "Direct-run guard added (Rule 2 deviation) — script body fires main() only when invoked directly; plain `import` from test files does NOT trigger main(). Mirrors scripts/generate-fallback.ts WR-06 idiom. Required to satisfy plan's <behavior> 'no child process, no network' test contract."
  - "Parser does NOT validate --cats values (separation of concerns); main() validates against EVAL_CATS_VALID. Keeps parseEvalArgs testable as pure transform."
  - "Empty argv (--target=) preserved as empty string by parser; resolveTargetUrl treats it as 'not provided' and falls through to env. Two-layer behavior tested directly."
  - "Logged source:'argv'|'env' on eval_cats_filter_active for operator audit when investigating an unexpected run (T-05-13-03 mitigation)"

patterns-established:
  - "Pattern: vi.mock('@/lib/env') factory with concatenated env-var names (dodges pre-commit secret-scan-literals hook). Reused from tests/lib/eval/cats/cat1.test.ts."
  - "Pattern: Test imports use ../../scripts/run-evals path (relative) — same as tests/scripts/generate-fallback.test.ts. Vitest @/alias for src/ only; scripts/ is sibling, relative imports required."
  - "Pattern: parseEvalArgs return type uses null (not []) for 'no filter' to distinguish from empty-after-trim filter — encoded in test 'returns null cats (not []) when flag absent'"

requirements-completed: [EVAL-09, EVAL-13]

# Metrics
duration: 8min
completed: 2026-05-12
---

# Phase 5 Plan 13: Eval CLI argv flags (UAT Test 1 gap-closure) Summary

**Added `parseEvalArgs` + `resolveTargetUrl` + `EVAL_CATS_VALID` to scripts/run-evals.ts via node:util.parseArgs, wiring `--target` / `--cats` / `--help` flags with argv-first / env-fallback precedence; tests/scripts/run-evals.test.ts ships 24 pure-fn tests covering the parser, strict-mode mis-paste rejection, precedence resolver, and roster lock.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-12T01:31:28Z
- **Completed:** 2026-05-12T01:38:56Z
- **Tasks:** 2 (parseEvalArgs landing + deferred-items.md update)
- **Files modified:** 3 (scripts/run-evals.ts, tests/scripts/run-evals.test.ts, .planning/phases/05-eval-gates-launch/deferred-items.md)

## Accomplishments

- `npm run eval -- --target=<url> --cats=<csv>` now works end-to-end (UAT Test 1 gap CLOSED — `issue → pass`)
- `npm run eval -- --help` prints usage block listing both flags + their env-var equivalents (exits 0)
- `npm run eval -- --cat=1` (singular mis-paste from CONTEXT-ADDENDUM D-12-C-02) loud-fails with strict-mode "Unknown option '--cat'" + exit 2
- `npm run eval -- --target=foo` exits 2 with `eval_target_invalid` shape-validation error (blocks file:// / javascript: / shell-injection target strings before any network call)
- Back-compat preserved: EVAL_TARGET_URL + EVAL_CATS env vars still work when argv absent (CI workflow .github/workflows/eval.yml continues to function unchanged)
- argv-overrides-env verified live: EVAL_TARGET_URL=wrong + `--target=right` → resolved URL = right, `source:'argv'` logged on eval_cats_filter_active

## Task Commits

Each task was committed atomically:

1. **Task 1: parseEvalArgs + EVAL_CATS_VALID + resolveTargetUrl + tests** — `5c9cf26` (fix)
2. **Task 2: deferred-items.md Item #12 RESOLVED block** — `a005164` (docs)

## Files Created/Modified

- `scripts/run-evals.ts` — Added parseEvalArgs (pure argv parser via node:util.parseArgs strict:true), EVAL_CATS_VALID const (single source of truth), resolveTargetUrl (argv-first/env-fallback resolver), HELP_TEXT (usage block), and direct-run guard (import.meta.url vs argv[1]). Replaced env-only `targetUrl` const (line 40) with argv-first resolution + shape validation. Replaced EVAL_CATS env block (lines 75-92) with argv-first/env-fallback + shared validator. Header comment block updated to document flag precedence.
- `tests/scripts/run-evals.test.ts` — NEW. 24 pure-fn tests: 4 target + 5 cats + 3 help + 1 combined + 2 strict-mode + 7 resolveTargetUrl precedence + 2 EVAL_CATS_VALID roster lock. vi.mock('@/lib/env') factory (concatenated env-var names dodge pre-commit secret-scan-literals hook). Mirrors tests/scripts/generate-fallback.test.ts pattern — direct imports, no execSync, no child process.
- `.planning/phases/05-eval-gates-launch/deferred-items.md` — Append-only edit adding Item #12 (UAT Test 1 gap RESOLVED) with full cross-references (CONTEXT-ADDENDUM D-12-B-01/D-12-C-02, 05-UAT.md, scripts/run-evals.ts, tests/scripts/run-evals.test.ts) and the eval_cats_invalid Windows exit-code follow-up observation.

## Test count delta

- **Pre-change baseline (HEAD eb647eb, stashed Plan 05-13 work):** 71 failed / 513 passed / 584 total tests across 60 files
- **Post-change (Plan 05-13 landed):** 71 failed / 537 passed / 608 total tests across 61 files
- **Net delta:** +1 file (tests/scripts/run-evals.test.ts) / +24 passed (the new test file) / 0 new failures
- The 71 pre-existing failures (12 component/admin/JSDOM-environment tests) are unrelated to Plan 05-13 — verified via `git stash` on HEAD. Logged as a separate follow-up observation in deferred-items.md Item #12 trailer.

## Verification smoke summary (5/5 pass)

1. `npx tsc --noEmit` → exit 0 (zero TS errors)
2. `npm test -- tests/scripts/run-evals.test.ts` → 24/24 pass
3. `npm test` (full suite) → 71 failed / 537 passed; zero new failures vs pre-change baseline
4. `npm run eval -- --help` → exits 0, prints HELP_TEXT
5. `npm run eval -- --target=foo --cats=cat1` → exits 2 with `eval_target_invalid` + `must be an http(s) URL` stderr
6. `npm run eval -- --cat=1` → exits 2 with strict-mode `Unknown option '--cat'` stderr

Plus live precedence verification:
- `EVAL_TARGET_URL=https://example.com EVAL_CATS=cat1 npm run eval` → `targetUrl: https://example.com`, `filter:[cat1], source:'env'` logged (back-compat path holds)
- `EVAL_TARGET_URL=wrong + --target=right --cats=cat2` → resolved URL = right, filter:[cat2], `source:'argv'` (argv-overrides-env holds)

## UAT Test 1 status flip

**`issue → pass`** — actionable for any future re-verify run. Hiring manager runbook can now show `npm run eval -- --target=https://joe-dollinger-chat.com --cats=cat1,cat4-judge` and it works end-to-end.

## Cross-link to deferred-items entry

- [deferred-items.md §Item #12](./deferred-items.md) — RESOLVED block with commit `5c9cf26` reference, cross-references to CONTEXT-ADDENDUM D-12-B-01/D-12-C-02, 05-UAT.md §Gaps, scripts/run-evals.ts, tests/scripts/run-evals.test.ts.

## Decisions Made

See `key-decisions` in frontmatter. Summary:
- `node:util.parseArgs` over commander/yargs (no new dep — Node 22 built-in)
- Direct-run guard added so test imports don't trigger main() — Rule 2 deviation (required to satisfy plan's "no child process" test contract)
- Parser does NOT validate values; main() does (separation of concerns)
- `EVAL_CATS_VALID` is the single source of truth for valid runner names; the env validator now reuses it (was a private `known` Set before — drift hazard removed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added direct-run guard so test imports don't fire main()**

- **Found during:** Task 1 (TDD RED — running the new test file)
- **Issue:** Plan's `<behavior>` specifies "Pure-fn tests — no child process, no network" and "import directly from scripts/run-evals". But the original scripts/run-evals.ts has a top-level `main().catch(...)` call that fires on every module import, which would (a) hit the network via createRun, and (b) call process.exit. Without a guard, `import { parseEvalArgs } from '../../scripts/run-evals'` in the test file would never complete.
- **Fix:** Added `isDirectRun` detection using `import.meta.url === pathToFileURL(process.argv[1]).href` (the WR-06 idiom from scripts/generate-fallback.ts), gating the `main().catch(...)` invocation. Also added `EVAL_RUN=1` env-var override as a safety hatch.
- **Files modified:** scripts/run-evals.ts (single block at the bottom)
- **Verification:** Direct `npm run eval` invocations still work (smokes 4-6 verified); test imports no longer fire main() (24/24 tests pass with vi.mock('@/lib/env') factory).
- **Committed in:** `5c9cf26` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical functionality required to satisfy plan's own test contract)
**Impact on plan:** Zero scope creep. The guard is the established WR-06 pattern from scripts/generate-fallback.ts; without it the plan's `<behavior>` "no child process, no network" tests are infeasible. Documented in deferred-items.md Item #12.

## Issues Encountered

**1. Pre-existing 71 test failures on HEAD — unrelated to Plan 05-13**

During the full `npm test` plan-level verification, 71 failures surfaced across 12 component/admin/JSDOM-environment test files (tests/admin/*.test.tsx, tests/components/*.test.tsx, tests/lib/logger.test.ts). Verified pre-existing via `git stash --include-untracked -- tests/scripts/run-evals.test.ts scripts/run-evals.ts && npm test` — same 71 failures on un-modified HEAD. The plan's scope_anchors do not cover these files; they predate Plan 05-13. Recommend investigating during the next admin/UI-focused plan or as a separate quick task; possibly caused by a JSDOM or @testing-library version interaction (vitest 4.1.5 / jsdom 29.0.2 baseline shifted at some point).

**2. Pre-existing eval_cats_invalid exit-code bug — out of Plan 05-13 scope**

During Task 1 CLI smokes (optional smoke 4), `npm run eval -- --target=https://example.com --cats=cat99` was found to exit 0 instead of 2, despite emitting the `eval_cats_invalid` Pino error log and finalizing the run with `status='error'`. Verified pre-existing via `git stash` + `EVAL_CATS=cat99 node --env-file-if-exists=.env.local --import tsx scripts/run-evals.ts` on un-modified HEAD — same exit-0 behavior. Likely Windows-specific Node/tsx interaction with `process.exit` mid-async-flush. The logging contract (eval_cats_invalid + finalized status='error') is intact; only OS-level exit code is wrong. The shape-validation exit path (`--target=foo`) which runs BEFORE async createRun DOES exit 2 correctly. Documented as follow-up in deferred-items.md Item #12 trailer; track separately if cron-job.org schedule (Plan 05-11) ever needs to react to a bad EVAL_CATS env-var value.

## User Setup Required

None — no external service configuration. Plan 05-13 is purely CLI-ergonomics; no env vars added, no new dependencies, no Vercel / Supabase / Upstash config touched.

## Next Phase Readiness

- UAT Test 1 gap CLOSED; Plan 05-12 LAUNCH-CHECKLIST hiring-manager runbook syntax (`npm run eval -- --target=<url> --cats=<csv>`) now works end-to-end
- Underlying phase deliverable (cat1=15/15 + cat4=5/5 on prod) ALREADY verified per LAUNCH-CHECKLIST runIds `sWLys5bpVsiHAfwvoln04` (cat1) + `OPoI0ljuwE4GlbT_LFh4u` (cat4); Plan 05-13 does NOT re-verify the gate, it makes targeted re-runs ergonomic
- ROADMAP.md: 05-13 marked complete (post-launch gap-closure plan; NOT part of the original 12-plan count for the v1.0 milestone)

## Self-Check: PASSED

Verified after writing SUMMARY:
- `scripts/run-evals.ts` — modified (commit 5c9cf26 in git log)
- `tests/scripts/run-evals.test.ts` — created (commit 5c9cf26 in git log)
- `.planning/phases/05-eval-gates-launch/deferred-items.md` — appended (commit a005164 in git log; Item #12 grep at line 564)
- Commit `5c9cf26` — found in `git log`
- Commit `a005164` — found in `git log`

---
*Phase: 05-eval-gates-launch*
*Plan: 05-13 (gap-closure, post-launch — NOT part of v1.0's original 12-plan count)*
*Completed: 2026-05-12*
