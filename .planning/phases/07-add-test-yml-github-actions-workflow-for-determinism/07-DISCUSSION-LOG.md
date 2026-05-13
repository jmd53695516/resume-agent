# Phase 7: Add test.yml GitHub Actions workflow for determinism - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 07-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 07-add-test-yml-github-actions-workflow-for-determinism
**Areas discussed:** Test scope, Triggers + env hygiene, Branch protection enforcement
**Areas skipped:** Success criterion #4 (induced-break demo PR) — Joe deferred to Claude's discretion; captured as a verification expectation in CONTEXT specifics rather than a separate ceremonial PR.

---

## Test scope (CI gate breadth)

| Option | Description | Selected |
|--------|-------------|----------|
| Full pre-flight: vitest + tsc + lint + next build (Recommended) | Matches local-vs-Vercel rule (memory: `next build` catches things vitest misses). 4 jobs/steps. Slowest (~5-7 min) but catches the most. Real production gate. | ✓ |
| Full vitest suite only (npm test) | Runs ~100+ tests across `tests/**` including the 17 SAFE-11. Fast (~30-60s). Skips tsc/lint/build — type errors slip through unless caught locally. | |
| Narrow: only `tests/lib/system-prompt.test.ts` (17 SAFE-11 tests) | Hews to ROADMAP S/C #2 literally. Cheapest (~10s). Misses broader regressions — closes only the SAFE-11 gap. | |

**User's choice:** Full pre-flight (vitest + tsc + lint + next build).
**Notes:** Anchored in memory `feedback_local_vs_vercel_build` — local-vs-Vercel-build divergence has bitten Joe before. tsc + build are non-optional.

---

## Triggers + secrets posture

| Option | Description | Selected |
|--------|-------------|----------|
| PR + push-to-main, zero real secrets (Recommended) | Standard CI trigger pair. Workflow uses ONLY dummy/sentinel env vars — separates this from eval.yml which DOES spend. Any test that genuinely needs API keys must be skipped/mocked. | ✓ |
| PR + push-to-main + weekly cron | Same as above plus scheduled. Plan 05-11 already has weekly eval cron; redundant for code tests since nothing changes without a commit. | |
| PR + push-to-main, real `ANTHROPIC_API_KEY` available | Some chat-* tests reference `ANTHROPIC_API_KEY`. Risk: any non-mocked call hits real Anthropic and burns spendcap (cf. 2026-05-12 incident). | |

**User's choice:** PR + push-to-main, zero real secrets.
**Notes:** Structural protection against the 2026-05-12 spend-cap incident pattern. test.yml budget-safety must be a property of the workflow definition, not an operator discipline.

---

## Branch protection + chat-six-gate flake handling

| Option | Description | Selected |
|--------|-------------|----------|
| Required check; quarantine chat-six-gate flake in vitest config (Recommended) | Make test.yml required-to-merge (parity with eval.yml). Quarantine the parallel-execution flake via vitest `exclude` with a tracked TODO. Don't gate Phase 7 on resolving Phase 05.2 deferred-item. | ✓ |
| Required check, fix the flake first as part of Phase 7 | Investigate + fix chat-six-gate-order flake before declaring Phase 7 done. Cleaner but adds scope; deferred-items.md captured 2 fix options. | |
| Advisory only (not required to merge) | Workflow runs but PRs can merge red. Safety net without enforcement. Weaker gate — doesn't prevent unguarded system-prompt changes from landing. | |

**User's choice:** Required check + vitest-config quarantine.
**Notes:** Sequencing matters — D-C-04 captures the "lock required-check name only after first green run on main" rule to avoid `main` becoming unmergeable.

---

## Claude's Discretion

- Job naming, runner OS (ubuntu-latest), Node version (22) — follow eval.yml conventions.
- Caching strategy — npm cache via setup-node@v5.
- Timeout duration (~10 min).
- Permissions block — least-privilege.
- ROADMAP S/C #4 (induced-break demo PR) — treat as satisfied by Phase 7 verification cycle (synthetic break → red → revert → green). No separate ceremonial PR.

## Deferred Ideas

- Fix chat-six-gate-order parallel-execution flake (Phase 05.2 deferred-items.md).
- Scheduled / nightly test.yml run.
- Workflow matrix across Node versions or OSes.
- Separate real-secrets job (e.g., test-integration.yml) for tests that need real Anthropic.
- Ceremonial demo PR with induced-break revert.
