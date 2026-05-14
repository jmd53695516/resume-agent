---
phase: 07-add-test-yml-github-actions-workflow-for-determinism
plan: 01
subsystem: infra
tags: [ci, lint, vitest, eslint, pre-flight, deferred]

# Dependency graph
requires:
  - phase: 05.2-implement-chat-stream-design-from-anthropic-design-system
    provides: chat-six-gate-order flake (deferred-items.md) — quarantined here in CI
  - phase: 06-deploy-to-production-and-cron-jobs
    provides: working test/build pipeline that Phase 7 instruments under CI
provides:
  - lint script narrowed to production code (`eslint src/`) per Option B+E
  - CI-gated vitest exclude for chat-six-gate-order parallel-execution flake (D-C-02/03)
  - empirical list of 9 pre-existing React-hooks lint violations blocking Plan 07-02
affects: [07-02 (test.yml workflow — blocked until lint green), 07-1A or equivalent follow-up plan]

# Tech tracking
tech-stack:
  added: []  # config-only changes; no new deps
  patterns:
    - "CI-gated test exclusion: `process.env.CI ? [...defaults, flake] : [...defaults]` (re-list defaults because user-supplied exclude replaces, not merges)"
    - "Lint scope = production code only; tests/scripts/evals tracked separately under backlog 999.8"

key-files:
  created: []
  modified:
    - package.json  # line 18: "lint": "eslint src/"
    - vitest.config.ts  # lines 18-24: CI-gated exclude block

key-decisions:
  - "Option F (defer + split): Tasks 1+2 complete; Task 3 pre-flight verification deferred to a follow-up plan that resolves 9 pre-existing React-hooks lint violations (Joe selected over Options A-E at the Rule 4 architectural checkpoint)."
  - "Do NOT auto-fix the 9 violations under Plan 07-01. They're outside this plan's stated scope (build/test config changes) and the fixes touch shipped UI code from Phases 02-05.2 (hydration patterns, effect ordering) — proper hygiene is plan→verify→commit on its own, not bundled into pre-flight prep."

patterns-established:
  - "Pre-flight gate verification is a downstream concern of lint surface — plan ordering matters. If lint debt exists in the scoped surface, the gate cannot run."
  - "Rule 4 architectural checkpoint correctly fires when a scope-line is crossed (`eslint-plugin-react-hooks@6` ships new rules that re-classify previously-clean code) — auto-fixing would have silently expanded the plan."

requirements-completed: []  # plan declared no requirements

# Metrics
duration: ~25min (Tasks 1+2 only)
completed: 2026-05-13
status: PARTIAL — Tasks 1+2 done, Task 3 deferred to follow-up plan
---

# Phase 07 Plan 01: Pre-CI Prep Summary

**Tasks 1+2 (lint script narrowed to `eslint src/`, CI-gated vitest exclude for chat-six-gate-order flake) shipped cleanly; Task 3 pre-flight gate verification deferred to a follow-up plan after 9 pre-existing React-hooks violations were exposed by `eslint-plugin-react-hooks@6` shipped in `eslint-config-next@16.2.4`.**

## Performance

- **Duration:** ~25 min (Tasks 1+2 only; Task 3 paused at Rule 4 checkpoint)
- **Started:** 2026-05-13T20:25:00Z (approx)
- **Paused at checkpoint:** 2026-05-13T20:50:00Z (approx)
- **Tasks:** 2/3 complete (1 deferred)
- **Files modified:** 2 (`package.json`, `vitest.config.ts`)

## Accomplishments

- `package.json` lint script changed from `"next lint"` to `"eslint src/"` (Option B+E decision; `next lint` is deprecated in Next 16+).
- `vitest.config.ts` now has a `process.env.CI`-gated `exclude` quarantining `tests/api/chat-six-gate-order.test.ts` from CI runs while keeping it locally runnable (D-C-02 + D-C-03).
- Empirically catalogued the 9 React-hooks violations now blocking Plan 07-02 — handoff package complete for the follow-up plan.

## Task Commits

1. **Task 1: Narrow lint script to `src/` in package.json (Option B+E)** — `d767db3` (chore)
2. **Task 2: Add CI-gated chat-six-gate-order exclude to vitest.config.ts** — `ae534c0` (chore)
3. **Task 3: Verify all 4 pre-flight commands exit 0 from clean-env shell** — **DEFERRED** (Rule 4 architectural checkpoint; see Deviations)

**Plan metadata:** _this commit_ (docs: 07-01 wrap)

## Files Created/Modified

- `package.json` (line 18) — `"lint": "eslint src/"` replaces `"next lint"`. Targets production code only; pre-existing 78 errors + 41 warnings in `tests/**`, `scripts/**`, `evals/**` deferred to backlog 999.8 per Option B+E.
- `vitest.config.ts` (lines 18-24) — Added `exclude` key gated by `process.env.CI`. CI excludes the parallel-execution flake; local runs still pick it up so the underlying race can be reproduced/debugged. Default vitest excludes (`node_modules/**`, `dist/**`, `.next/**`) re-listed in both branches because a user-supplied `exclude` replaces defaults rather than merging them.

## Decisions Made

**Option F (Defer + split)** — Joe selected at the Rule 4 architectural checkpoint over Options A-E:

- **Why F over auto-fix (Option C / similar):** The 9 violations are not bugs in this plan's changes — they're pre-existing patterns in shipped UI code (Phases 02-05.2) that `eslint-plugin-react-hooks@6` (newly shipped in `eslint-config-next@16.2.4`) now flags. Auto-fixing under Plan 07-01 would silently expand a config-only plan into a hydration/effect-pattern refactor of 7 components — exactly the scope creep Rule 4 exists to prevent.
- **Why F over widening lint scope (reverting to broader target):** Option B+E was Joe-locked in the discuss-phase decision; reverting would re-introduce the 78+41 tests/scripts/evals debt this plan was designed to cleanly exclude.
- **Why F over local-only exclusion (Option D / similar):** That just pushes the problem to Plan 07-02 (CI would still see the violations). The pre-flight gate's purpose is to mirror CI; making them divergent destroys the gate's value.

## Deviations from Plan

### Deferred Task

**1. [Rule 4 — Architectural] Task 3 pre-flight gate verification deferred to a follow-up plan**

- **Found during:** Task 3 (running `npm run lint` from a clean-env shell after Tasks 1+2 completed)
- **Issue:** `npm run lint` exits non-zero with 8 errors + 1 warning in `src/` — surfaced by `eslint-plugin-react-hooks@6` rules (`react-hooks/set-state-in-effect`, `react-hooks/purity`) shipped with `eslint-config-next@16.2.4`. These are NOT regressions caused by this plan's changes; they're shipped code from Phases 02-05.2 that previously passed `next lint` because the new rules didn't exist yet.
- **Why deferred (not auto-fixed):** Fixes require touching React hydration/effect patterns across 7 production components (`useEffect(() => setHydrated(true), [])` is the canonical Next App Router hydration pattern; the new rule wants `useSyncExternalStore` or a different shape entirely). That's architectural refactor work — Rule 4 scope, not Rule 1-3 auto-fix.
- **Decision:** Joe selected Option F (defer + split). Create a dedicated follow-up plan to resolve these 9 violations, then return to Plan 07-02 for the workflow file.
- **Action taken:** None on `src/` files. Plan 07-01 wraps at Tasks 1+2 done, Task 3 deferred.

### Full Violations Table (Handoff for Follow-Up Plan)

Total: **9 problems (8 errors, 1 warning)**

| # | File | Line:Col | Severity | Rule | Pattern |
|---|------|----------|----------|------|---------|
| 1 | `src/app/admin/(authed)/abuse/page.tsx` | 25:26 | error | `react-hooks/purity` | `Date.now()` called during render: `const SINCE = new Date(Date.now() - 90 * 24 * 3600_000).toISOString();` |
| 2 | `src/app/admin/(authed)/evals/calibrate/page.tsx` | 55:5 | error | `react-hooks/purity` | `Date.now()` called during render: `Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000` inside `new Date(...)` |
| 3 | `src/app/admin/components/LocalTime.tsx` | 20:7 | error | `react-hooks/set-state-in-effect` | `setText(iso)` inside `useEffect` (NaN-guard branch) |
| 4 | `src/app/admin/components/RelativeTime.tsx` | 25:5 | error | `react-hooks/set-state-in-effect` | `setText(relative(iso))` inside `useEffect` (sole body) |
| 5 | `src/app/chat/page.tsx` | 45:5 | error | `react-hooks/set-state-in-effect` | `setHydrated(true)` — canonical Next App Router hydration pattern |
| 6 | `src/app/error.tsx` | 16:10 | warning | `@typescript-eslint/no-unused-vars` | `_reset` param unused (trivial: rename or remove) |
| 7 | `src/components/ChatStatusBanner.tsx` | 17:5 | error | `react-hooks/set-state-in-effect` | `setHydrated(true)` — canonical hydration pattern |
| 8 | `src/components/ChatUI.tsx` | 85:5 | error | `react-hooks/set-state-in-effect` | `setAssistantTimestamps((prev) => ({ ...prev, [latest.id]: Date.now() }))` — stamps assistant message arrival time |
| 9 | `src/lib/eval/cats/cat2.ts` | 176:7 | error | `prefer-const` | `totalCost` never reassigned (trivial: `let` → `const`) |

**Rule categories:**

- **7 React-hooks violations** (rules `react-hooks/set-state-in-effect`, `react-hooks/purity`) — new in `eslint-plugin-react-hooks@6`, shipped via `eslint-config-next@16.2.4`. Require architectural reasoning per component (hydration boundary, render purity, effect→state coupling). **Not safe to bulk-fix.**
- **2 trivial fixes** — `_reset` unused param (rename or `// eslint-disable-next-line` with comment) and `prefer-const` on `totalCost` (one-character change).

**Fix-strategy hint for the follow-up plan (informational, not prescriptive):**

- **Hydration patterns (#5, #7):** Consider `useSyncExternalStore` with a `() => false` server snapshot, or accept the rule and switch to a hydration-detection pattern that doesn't `setState` in effect.
- **Time-stamping (#8):** Move `Date.now()` capture to the event source (when the assistant message starts streaming) rather than re-deriving in effect.
- **Time-formatting (#3, #4):** These components exist specifically to defer locale formatting to client (suppressHydrationWarning is already in use). Pattern needs rework — possibly `useSyncExternalStore` or a memo'd ref.
- **Server-component purity (#1, #2):** These are Server Components (no `'use client'`), so `Date.now()` in render is fine at runtime but the rule fires regardless. Likely needs `// eslint-disable-next-line react-hooks/purity` with a clear rationale comment, OR hoist the timestamp to a request-bound helper.

### Explicit Handoff

**Plan 07-02 cannot proceed until lint is green.**

**Next steps (orchestrator-owned):**

1. Plan + execute a new follow-up plan (working name **07-1A** or similar — orchestrator's call) to resolve these 9 violations.
2. The follow-up plan should run `npm run lint` to green from a clean-env shell, then verify `npm test && npx tsc --noEmit && npm run lint && npm run build` exits 0 end-to-end (Task 3's original verification, executed under the now-clean lint surface).
3. Return to Plan 07-02 for the `.github/workflows/test.yml` workflow file and branch-protection wiring.

**Sentinel env-vars handoff (carried forward):** Task 3 did not reach the `npm run build` step, so the empirical list of sentinels needed for clean-env build is also deferred to the follow-up plan's Task 3-equivalent. Plan 07-02's `env:` block design depends on this.

---

**Total deviations:** 1 deferred (Rule 4 architectural — Option F: defer + split)
**Impact on plan:** Plan 07-01 ships its config-only deliverables (Tasks 1+2) cleanly. Task 3's verification work moves to a dedicated plan. Phase 7's overall objective (test.yml workflow + branch protection) remains on track but adds one plan to the sequence.

## Issues Encountered

- `eslint-plugin-react-hooks@6` (transitive dep of `eslint-config-next@16.2.4`) introduces stricter rules than the previously-loaded `next lint` config surfaced. The switch from `next lint` → `eslint src/` is what unmasked these — same rules, just now running. This is not a regression of Plan 07-01; it's the first time these specific rules ran against `src/`. Documented for the follow-up plan so it doesn't re-investigate.

## User Setup Required

None — config-only changes.

## Next Phase Readiness

- **Blocked:** Plan 07-02 (test.yml workflow) cannot land until follow-up plan clears the 9 violations and verifies clean-env pre-flight.
- **Ready:** Tasks 1+2 are in `main` (commits `d767db3`, `ae534c0`) and the follow-up plan can build on them safely.

## Self-Check: PARTIAL

- **Tasks 1+2: PASSED**
  - Commit `d767db3` exists: `git log --oneline -10` confirms.
  - Commit `ae534c0` exists: `git log --oneline -10` confirms.
  - `package.json` line 18 reads `"lint": "eslint src/"` (verified by Task 1's automated check at execution time).
  - `vitest.config.ts` contains `process.env.CI`, `chat-six-gate-order.test.ts`, and `deferred-items.md` references (verified by Task 2's automated check at execution time).
- **Task 3: DEFERRED (not failed)**
  - Blocked by 9 pre-existing React-hooks violations exposed by `eslint-plugin-react-hooks@6` in `eslint-config-next@16.2.4`.
  - Handoff package (violations table + fix-strategy hints) complete in this SUMMARY.
  - Rule 4 architectural checkpoint was the correct response; auto-fix would have silently expanded scope across 7 production components.

This SUMMARY itself: file exists at `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-01-SUMMARY.md` (this file).

---
*Phase: 07-add-test-yml-github-actions-workflow-for-determinism*
*Plan: 01*
*Status: PARTIAL — clean handoff, not a finish*
*Completed: 2026-05-13*
