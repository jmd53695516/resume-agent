# Phase 7: Add test.yml GitHub Actions workflow for determinism - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `.github/workflows/test.yml` GitHub Actions workflow that runs a comprehensive pre-flight gate (vitest + tsc + lint + next build) on every PR and push-to-main, with branch protection enforcement equivalent to the existing eval.yml workflow. Closes the 06-06 Task 8 instrumentation gap: SAFE-11 system-prompt determinism (17 tests in `tests/lib/system-prompt.test.ts`) is currently verified manually only; every system-prompt or KB change is unguarded in CI.

This phase is NOT:
- Re-running or restructuring the existing eval.yml workflow (separate concern — eval makes Anthropic calls; test.yml is zero-API).
- Resolving the chat-six-gate-order parallel-execution flake (Phase 05.2 deferred — quarantine, don't fix here).
- Adding new tests (the 17 SAFE-11 tests already exist; test.yml just runs them, plus the rest of vitest, tsc, lint, build).

</domain>

<decisions>
## Implementation Decisions

### Test Scope (D-A)
- **D-A-01:** test.yml runs the full pre-flight matrix: `npm test` (vitest, all `tests/**`) + `npx tsc --noEmit` + `npm run lint` + `npm run build` (next build).
- **D-A-02:** Step ordering anchored by Joe's local-vs-Vercel rule (memory `feedback_local_vs_vercel_build`): local vitest alone misses Next.js build-time type/import errors. CI must catch what local doesn't. tsc + build are non-optional.
- **D-A-03:** Steps may be 4 sequential within one job OR a small job matrix — planner's discretion. Optimization is fine but ALL 4 must succeed for the check to pass green.

### Triggers + Secrets Posture (D-B)
- **D-B-01:** Triggers = `pull_request` (any branch into main) + `push` to main only. No scheduled cron (code-side tests have no inter-commit drift; Plan 05-11 already covers LLM-side weekly drift).
- **D-B-02:** Zero real secrets in the workflow env. No `ANTHROPIC_API_KEY`, no `EXA_API_KEY`, no Supabase service-role keys. CI supplies dummy/sentinel placeholders only where code reads `process.env.*` at module-init time.
- **D-B-03:** Any test that genuinely requires real API keys must be mocked or skipped — pre-existing tests must work under zero-secrets, or be fixed as part of this phase's "make CI green from scratch" prep.
- **D-B-04:** Reason for D-B-02: structural separation from eval.yml (which DOES spend) — and structural prevention of the 2026-05-12 spend-cap incident pattern where a CI run could burn budget on every PR.

### Branch Protection Enforcement (D-C)
- **D-C-01:** test.yml is a REQUIRED status check on `main` (must pass to merge), parity with eval.yml's posture.
- **D-C-02:** The chat-six-gate-order parallel-execution flake (filed in Phase 05.2 deferred-items.md) is QUARANTINED in `vitest.config.ts` — excluded from the CI run — with a tracked TODO to fix as a separate effort. Phase 7 is NOT gated on resolving that flake.
- **D-C-03:** Quarantine mechanism preference: explicit `exclude` in `vitest.config.ts` (not `it.skip` annotations). Keeps the source spec runnable locally for debugging; excludes only in CI runs. If `vitest.config.ts` exclude affects local too, switch to an env-gated exclude (`process.env.CI`).
- **D-C-04:** Required-check name on branch protection MUST be locked only AFTER the new workflow has a first green run on main. Otherwise `main` becomes unmergeable. Sequence: workflow lands → first green run on main → branch protection updated.

### Claude's Discretion
- **Job naming, runner OS, Node version** — follow eval.yml conventions: `ubuntu-latest`, Node 22, `actions/checkout@v6`, `actions/setup-node@v5` with `cache: 'npm'`.
- **Timeout** — set a reasonable `timeout-minutes` (~10).
- **Permissions block** — least-privilege, matching eval.yml style.
- **Demo PR (ROADMAP S/C #4)** — Joe declined to formally discuss this area. Treat S/C #4 as satisfied if Phase 7 verification demonstrates an induced-break run going RED (synthetic edit that adds a timestamp to the cached system-prompt prefix → vitest fails → revert → green). No ceremonial separate PR required. Capture proof in the phase SUMMARY.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing CI workflow (reference for patterns)
- `.github/workflows/eval.yml` — Existing Anthropic-calling eval workflow. Use its checkout/setup-node/cache patterns. Phase 7 must NOT inherit its `ANTHROPIC_API_KEY` env exposure.

### Tests being gated
- `tests/lib/system-prompt.test.ts` — The 17 SAFE-11 system-prompt determinism tests. Primary gate purpose; ROADMAP S/C #2 explicitly names these.
- `tests/**/*.test.{ts,tsx}` — Full vitest scope (~100+ tests).
- `vitest.config.ts` — Will need an `exclude` entry for the chat-six-gate flake (D-C-02/03).
- `tests/setup.ts` — Existing vitest setup; check whether it provides env-var defaults that allow zero-secrets runs (D-B-03).

### Phase artifacts driving this work
- `.planning/phases/06-kb-enrichment-about-me-hardening/06-06-SUMMARY.md` §"Phase 06 deferred items" item #2 — The "no test.yml" gap that motivated this phase.
- `.planning/phases/06-kb-enrichment-about-me-hardening/06-06-VERIFICATION-LOG.md` — D-F-06 manual-verification reference.
- `.planning/phases/05.2-implement-chat-stream-design-from-anthropic-design-system/deferred-items.md` — chat-six-gate-order flake context for the D-C-02 quarantine decision.

### Branch protection
- GitHub repo settings — branch protection rules on `main`. Need an explicit step (manual or via gh CLI) to mark the new check as required, matching eval.yml's required posture.

### Memory-rooted constraints
- Memory `feedback_local_vs_vercel_build` — "Run `npx tsc --noEmit` + `npm run build` before declaring TS/build work done." Codified into D-A-01/02.
- Memory `project_spend_cap_incident_2026-05-12` — Why D-B mandates zero-real-secrets in test.yml.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/eval.yml` — Provides the exact checkout/setup-node/cache pattern (Node 22, ubuntu-latest, `actions/checkout@v6`, `actions/setup-node@v5`, `cache: 'npm'`, `npm ci`).
- `npm test` (= `vitest run`) — Already wired in `package.json` scripts.
- `npm run build`, `npm run lint` — Already exist in `package.json`.

### Established Patterns
- `actions/checkout@v6` + `actions/setup-node@v5` with `node-version: '22'` and `cache: 'npm'`.
- Job-level `timeout-minutes` set explicitly.
- `permissions:` block declared per workflow (least-privilege).
- 17 SAFE-11 tests live in `tests/lib/system-prompt.test.ts` (confirmed via test-block count = 17).

### Integration Points
- Branch protection on `main` — D-C-04 requires the new check be marked required only after first green run.
- `vitest.config.ts` — needs `exclude` entry for chat-six-gate flake quarantine.
- `tests/setup.ts` — review for env-var defaults that allow zero-secrets execution.

</code_context>

<specifics>
## Specific Ideas

- Workflow file path: `.github/workflows/test.yml` (literal name from ROADMAP S/C #1).
- Phase verification must include a demonstrable RED→GREEN cycle from a synthetic determinism break, capturing logs in the SUMMARY. This is how S/C #4 is satisfied without a ceremonial PR.
- Required-check name in branch protection should match the workflow's `name:` field (lock it before turning on the requirement).

</specifics>

<deferred>
## Deferred Ideas

- **Fix chat-six-gate-order parallel-execution flake.** Filed in Phase 05.2 deferred-items.md with 2 fix options. Phase 7 quarantines (excludes from CI), does not fix.
- **Scheduled / nightly test.yml run.** Considered and rejected — code-side tests have no drift between commits.
- **Workflow matrix across Node versions or OSes.** Single Node 22 + ubuntu-latest is sufficient; Vercel runs Node 22 in production.
- **Separate real-secrets job** (e.g., `test-integration.yml` for tests that need real Anthropic). Out of scope. Phase 7 explicitly excludes any test path that requires real API keys.
- **Ceremonial demo PR with induced-break revert.** ROADMAP S/C #4 satisfied via Phase 7's normal verification cycle (synthetic break shown red, then reverted) — no separate PR ceremony.

</deferred>

---

*Phase: 07-add-test-yml-github-actions-workflow-for-determinism*
*Context gathered: 2026-05-13*
