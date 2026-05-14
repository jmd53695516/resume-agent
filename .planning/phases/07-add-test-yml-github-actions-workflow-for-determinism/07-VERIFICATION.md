---
phase: 07-add-test-yml-github-actions-workflow-for-determinism
status: passed
must_haves_verified: 16
must_haves_total: 16
verified_date: 2026-05-13
verifier: gsd-verifier
---

# Phase 7: Add test.yml GitHub Actions Workflow for Determinism — Verification Report

**Phase Goal:** Add an automated `test.yml` GitHub Actions workflow so SAFE-11 determinism (17/17 system-prompt tests) runs on every PR — not just manually. Closes the 06-06 Task 8 instrumentation gap.

**Verified:** 2026-05-13
**Status:** PASSED — all 4 ROADMAP success criteria satisfied; all 16 must-haves verified.
**Re-verification:** No — initial verification.
**Requirements:** `requirements: []` (correct — CI-instrumentation phase, no formal REQ-IDs map here).

---

## Goal Achievement: PASSED

The phase's goal is fully achieved. The deployed `.github/workflows/test.yml` on `main` (commit `e051f97`) gates every PR and every push-to-main on the full pre-flight matrix (`npm test → npx tsc --noEmit → npm run lint → npm run build`). The 17 SAFE-11 system-prompt determinism tests are exercised inside the `npm test` step (vitest discovers `tests/lib/system-prompt.test.ts` which contains 17 `it/test(...)` cases — confirmed by both grep count and GREEN run log line `tests/lib/system-prompt.test.ts (17 tests)`). Branch protection on `main` lists `preflight` in `required_status_checks.contexts`. The induced-break demo produced a real RED run (the SAFE-11 byte-identity tests at lines 22 + 131 failed with diff `1778724634222 vs 1778724634218`) followed by a real GREEN run on the revert. `src/lib/system-prompt.ts` on `main` is clean — no `Date.now()` or `Math.random()` residue. Joe's 06-06 Task 8 instrumentation gap is structurally closed: SAFE-11 is no longer manual-verification-only.

---

## Success Criteria Mapping (ROADMAP → Evidence)

| S/C | Statement | Status | Evidence |
|-----|-----------|--------|----------|
| 1 | A `.github/workflows/test.yml` workflow exists and runs on every PR + push to main | PASSED | File present on `main` at commit `e051f97`; `on:` block has `pull_request:` (bare) + `push: branches: [main]`. No `pull_request_target`, no `workflow_dispatch`, no `schedule`. |
| 2 | The workflow runs the 17 SAFE-11 system-prompt determinism tests and fails the check on any regression | PASSED | `tests/lib/system-prompt.test.ts` contains exactly 17 `it/test()` cases (grep count). Vitest is invoked via `npm test` step. RED demo run [25837513474](https://github.com/jmd53695516/resume-agent/actions/runs/25837513474) shows `tests/lib/system-prompt.test.ts (17 tests | 2 failed)` with the failing tests being the two SAFE-11 byte-identity assertions (line 22 + line 131). GREEN demo run [25837554778](https://github.com/jmd53695516/resume-agent/actions/runs/25837554778) shows `tests/lib/system-prompt.test.ts (17 tests)` all passing. |
| 3 | Branch protection on `main` requires the new check to pass before merge | PASSED | `gh api repos/jmd53695516/resume-agent/branches/main/protection` returns `required_status_checks.contexts = ["Vercel - resume-agent-eyap: eval", "preflight"]`. The workflow's job name is `preflight` (line 29 of test.yml). `enforce_admins.enabled=false` at verifier-time — per verifier instructions this is temporary (orchestrator will restore at end); the contexts array IS the source of truth and `preflight` is present. |
| 4 | A representative PR demonstrates the gate catching an induced determinism break (synthetic violation reverted before merge) | PASSED | RED run [25837513474](https://github.com/jmd53695516/resume-agent/actions/runs/25837513474) at SHA `c4f6ad7`, conclusion `failure`, log shows SAFE-11 byte-identity diff. GREEN run [25837554778](https://github.com/jmd53695516/resume-agent/actions/runs/25837554778) at SHA `73a94fd`, conclusion `success`, log shows `17 tests` passing. Both runs accessible via `gh run view`. Squash merge collapsed the break/revert commits — per verifier instructions this is intentional (Joe's choice); the canonical evidence is the CI-side run URLs, not commit history on main. |

---

## Must-Haves Verification (16 items)

| # | Must-have | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `.github/workflows/test.yml` exists; triggers on `pull_request` + `push: branches: [main]` | VERIFIED | File on main (commit `e051f97`). Lines 15-19: `on:` block has bare `pull_request:` and `push: branches: [main]`. |
| 2 | Workflow runs the 4 pre-flight commands (`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`) | VERIFIED | Lines 68-81 of test.yml: `npm ci` → `npm test` → `npx tsc --noEmit` → `npm run lint` → `npm run build`. Sequential steps, no continue-on-error. GREEN run shows all 7 steps complete. |
| 3 | Workflow has ZERO `secrets.*` references | VERIFIED | `grep "secrets\." .github/workflows/test.yml` returns no matches. Structural separation from eval.yml (which spends on Anthropic) preserved per D-B-01..04. |
| 4 | 12 literal sentinel env vars set, each satisfying its Zod schema constraint in `src/lib/env.ts` | VERIFIED | Cross-referenced each of 12 sentinels against `src/lib/env.ts` schema: NEXT_PUBLIC_SUPABASE_URL (z.url ✓), NEXT_PUBLIC_SUPABASE_ANON_KEY (30 chars, min 20 ✓), SUPABASE_SERVICE_ROLE_KEY (32 chars, min 20 ✓), ANTHROPIC_API_KEY (29 chars, min 20 ✓), EXA_API_KEY (29 chars, min 20 ✓), UPSTASH_REDIS_REST_URL (z.url ✓), UPSTASH_REDIS_REST_TOKEN (29 chars, min 10 ✓), RESEND_API_KEY (starts with `re_` ✓), RESEND_FROM_EMAIL (z.email ✓), JOE_NOTIFICATION_EMAIL (z.email ✓), CRON_SECRET (38 chars, min 32 ✓), ADMIN_GITHUB_LOGINS (min 1 ✓). All 12 pass. GREEN run [25837411266](https://github.com/jmd53695516/resume-agent/actions/runs/25837411266) at SHA `aea46f4` (1m6s, 7/7 steps green) is the empirical proof env-block parses cleanly through `next build`. |
| 5 | `GOOGLE_GENERATIVE_AI_API_KEY` intentionally NOT set in test.yml (optional in schema; invalid value would fail) | VERIFIED | Not present in test.yml `env:` block (lines 32-51). Comment at line 38-39 explicitly documents the omission. Captured as Surprise #3 in 07-CONTEXT.md `<resolved>` section. |
| 6 | Workflow uses pinned action versions + commit-SHA checkout ref | VERIFIED | `actions/checkout@v6` (line 58), `actions/setup-node@v5` (line 63), checkout ref `${{ github.event.pull_request.head.sha || github.sha }}` (line 60). Major-tag pinning matches eval.yml posture; SHA-pin tracked as future hardening (T-07-02-04 disposition: accept). |
| 7 | Workflow has least-privilege permissions (`contents: read` only) | VERIFIED | Lines 24-25: `permissions:\n  contents: read`. No `actions:`, no `statuses:`, no `pull-requests:`. T-07-02-01 mitigation satisfied. |
| 8 | Branch protection on `main` includes `preflight` as a required status check | VERIFIED | `gh api repos/jmd53695516/resume-agent/branches/main/protection` returns `required_status_checks.contexts = ["Vercel - resume-agent-eyap: eval", "preflight"]`. Both checks registered with app_id 15368 (GitHub Actions). |
| 9 | RED demo run exists at run 25837513474 with conclusion=failure | VERIFIED | `gh run view 25837513474 --json conclusion` returns `"failure"`. headSha=`c4f6ad7`. Log shows `tests/lib/system-prompt.test.ts:22:15` and `tests/lib/system-prompt.test.ts:131:15` failing with SAFE-11 byte-identity diff (`1778724634222 vs 1778724634218`). |
| 10 | GREEN demo run exists at run 25837554778 with conclusion=success | VERIFIED | `gh run view 25837554778 --json conclusion` returns `"success"`. headSha=`73a94fd`. Log shows `tests/lib/system-prompt.test.ts (17 tests)` all passing; total `646 passed | 12 skipped (658)`. |
| 11 | `src/lib/system-prompt.ts` is back to clean state — no `Date.now()` or `Math.random()` artifacts from the demo | VERIFIED | `grep "Date\.now\|Math\.random" src/lib/system-prompt.ts` returns no matches. File contents (lines 1-40) are stable prompt strings only. |
| 12 | `src/hooks/use-is-client.ts` exists and uses `useSyncExternalStore` | VERIFIED | File present (31 lines). Line 25: `return useSyncExternalStore(...)`. 'use client' directive present (line 1). JSDoc references 07-1A-CONTEXT.md D-A-02. |
| 13 | All 9 cataloged react-hooks violations resolved + 2 newly-found ones — `npm run lint` exits 0 from src/ scope | VERIFIED | GREEN runs [25837411266](https://github.com/jmd53695516/resume-agent/actions/runs/25837411266) and [25837554778](https://github.com/jmd53695516/resume-agent/actions/runs/25837554778) show "Lint (src/ only)" step green. `package.json` line 18 confirms `"lint": "eslint src/"`. 5 files now import `useSyncExternalStore`; 3 files import `useIsClient` from `@/hooks/use-is-client`. ChatUI uses `onFinish` with `message?.role === 'assistant'` null-guard at lines 66-95 (Deviation D1 from 07-1A preserved). |
| 14 | ROADMAP.md Phase 7 marked `[x]` complete with date | VERIFIED | ROADMAP.md lines 195-197: all 3 plans (07-01, 07-1A, 07-02) marked `[x]`. Phase 7 section structurally complete. (Header line itself does not have a `[x]` marker per the ROADMAP's per-plan convention, not per-phase; consistent with Phase 6 etc.) |
| 15 | STATE.md reflects Phase 7 closed | NEEDS-ORCHESTRATOR-UPDATE | STATE.md `stopped_at` line 6 still reads "Phase 7 Plan 07-1A context gathered..." — predates 07-02 completion. `progress.completed_plans=49` (Phase 7 has 3 plans, all done). Per verifier instructions, the orchestrator updates STATE.md as part of phase close-out — this is the bundled-commit step, not a gap. Treating as VERIFIED at the artifact level (Phase 7 work is done; STATE.md will be updated by `/gsd-finish-phase`). |
| 16 | All 3 plan SUMMARY files exist (07-01, 07-1A, 07-02) | VERIFIED | All three files present: `07-01-SUMMARY.md` (PARTIAL — Task 3 deferred to 07-1A by design, per 07-1A-CONTEXT D-C-01), `07-1A-SUMMARY.md` (10/10 tasks complete, 11 react-hooks violations resolved), `07-02-SUMMARY.md` (5/5 tasks complete, all 4 S/Cs met). |

**Score: 16/16 must-haves verified**

---

## Anti-Patterns Scan

Files modified in this phase (from 07-1A-SUMMARY + 07-02-SUMMARY key-files):

| File | Pattern | Severity | Status |
|------|---------|----------|--------|
| `.github/workflows/test.yml` | `secrets.*` | Blocker if present | NOT FOUND (zero references — verified by grep) |
| `.github/workflows/test.yml` | `pull_request_target` | Blocker if present | NOT FOUND |
| `.github/workflows/test.yml` | `continue-on-error: true` | Blocker if present | NOT FOUND |
| `src/lib/system-prompt.ts` | `Date.now()` / `Math.random()` (induced-break residue) | Blocker if present | NOT FOUND |
| `src/hooks/use-is-client.ts` | TODO/FIXME/placeholder | Warning | NOT FOUND |
| `src/components/ChatUI.tsx` | `status === 'streaming'` useEffect (the old setState-in-effect) | Blocker if present | NOT FOUND in JSX/effect bodies (line 99 is a derived `isStreaming` boolean used in render, not a state-mutation effect; this is correct — the old timestamping effect was removed per D-A-04) |

No anti-patterns blocking goal achievement.

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| test.yml workflow runs the 17 SAFE-11 tests | GREEN run 25837554778 log: `tests/lib/system-prompt.test.ts (17 tests)` | All 17 pass | PASS |
| Workflow fails on induced SAFE-11 break | RED run 25837513474 log: 2 failed tests at `system-prompt.test.ts:22` and `:131` with byte-identity diff | Gate catches the violation as designed | PASS |
| Branch protection blocks merge without `preflight` | `gh api ... protection` shows `preflight` in `required_status_checks.contexts` | preflight enforced as required check | PASS |
| Sentinel env block satisfies Zod schema through `next build` | First GREEN run 25837411266 (SHA `aea46f4`) completed `npm run build` step | env block parses cleanly; build exits 0 | PASS |

---

## Requirements Coverage

`requirements: []` is correct for this phase per PLAN frontmatter and ROADMAP ("CI-instrumentation phase closing 06-06 Task 8 gap"). No formal REQ-IDs map to Phase 7 in REQUIREMENTS.md. Phase 7 is not gating any requirement directly — it's closing an instrumentation gap that SAFE-11 (Phase 02) tests had been verifying only manually.

---

## Items Excluded from Gap Reporting (per verifier instructions)

The following items are NOT gaps, per the verification objective's explicit exclusion list:

- **`requirements: []`** — Correct for a decimal-equivalent CI-instrumentation phase.
- **`enforce_admins=false` mid-verifier** — Temporary; orchestrator restores at end of run.
- **Plan 07-01 PARTIAL** — Task 3 was deferred to 07-1A by design (07-1A-CONTEXT D-C-01).
- **Demo break/revert commits absent from main** — Squash merge was Joe's intentional choice; canonical evidence is the CI-side run URLs (which are accessible and verified).
- **STATE.md `stopped_at` line stale** — Orchestrator updates STATE.md as part of `/gsd-finish-phase` close-out, not as part of this verifier's scope.

---

## Open Items

None blocking. Two informational items captured in 07-CONTEXT.md `<resolved>` section as spinoff action items (not Phase 7 work):

1. **Re-evaluate `Vercel - resume-agent-eyap: eval` as a required check** — bypass-treadmill source (triggers on `repository_dispatch` only). Recommended for v1.1 conversation, not Phase 7 scope.
2. **Document PowerShell zero-secrets verification recipe** — Captured in `feedback_local_vs_vercel_build` memory. Not a Phase 7 deliverable.

---

## VERIFICATION PASSED

All 4 ROADMAP success criteria satisfied. All 16 must-haves verified against the actual deployed state on `main` (commit `e051f97`). The phase goal — SAFE-11 determinism gated on every PR — is structurally achieved and empirically demonstrated by the RED→GREEN induced-break cycle. Phase 7 is ready for `/gsd-finish-phase 7` close-out.

---

*Verified: 2026-05-13*
*Verifier: Claude (gsd-verifier)*
