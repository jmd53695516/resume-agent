---
phase: 07-add-test-yml-github-actions-workflow-for-determinism
plan: 1A
subsystem: testing
tags: [lint, react-hooks, hydration, useSyncExternalStore, pre-flight, deferred-task-3, eslint-plugin-react-hooks-v6]

# Dependency graph
requires:
  - phase: 07-add-test-yml-github-actions-workflow-for-determinism
    provides: "Plan 07-01: package.json `lint` script narrowed to `eslint src/` + CI-gated vitest exclude for chat-six-gate-order flake"
provides:
  - "Clean-env pre-flight gate green: npm test + npx tsc --noEmit + npm run lint + npm run build all exit 0 from a zero-secrets shell"
  - "Sentinel env-var contract for Plan 07-02 test.yml env: block (the 12-var YAML in Handoff section)"
  - "Shared useIsClient() hook backed by useSyncExternalStore (src/hooks/use-is-client.ts) — reusable React 18+ idiomatic hydration-detection primitive"
  - "useSyncExternalStore refactor pattern for time-format components (LocalTime, RelativeTime) — replaces useState+useEffect post-mount-format pattern"
  - "onFinish-driven assistant-timestamp capture in ChatUI — event-driven replacement of status==='streaming' useEffect"
  - "Server-Component eslint-disable-next-line + rationale precedent for Date.now()-in-render purity violations"
affects: [07-02, future-react-hooks-v6-migrations, future-server-component-Date.now-usage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore three-arg form for SSR-safe hydration-boundary detection (no setState-in-effect)"
    - "useSyncExternalStore three-arg form for prop-derived client-formatted display (server snapshot = raw value, client snapshot = formatted value)"
    - "useChat onFinish callback for post-stream React state mutation (replaces status-watching useEffect)"
    - "Targeted eslint-disable-next-line + immediately-following rationale comment for Server-Component Date.now() purity warnings"
    - "Inline-line eslint-disable form when const-statement spans multiple physical lines (diagnostic attaches to Date.now() token, not const-statement start)"

key-files:
  created:
    - "src/hooks/use-is-client.ts"
    - ".planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-SUMMARY.md"
  modified:
    - "src/app/error.tsx"
    - "src/lib/eval/cats/cat2.ts"
    - "src/app/chat/page.tsx"
    - "src/components/ChatStatusBanner.tsx"
    - "src/app/admin/components/LocalTime.tsx"
    - "src/app/admin/components/RelativeTime.tsx"
    - "src/components/ChatUI.tsx"
    - "src/app/admin/(authed)/abuse/page.tsx"
    - "src/app/admin/(authed)/evals/calibrate/page.tsx"
    - ".planning/ROADMAP.md"

key-decisions:
  - "D-A-01: Server-Component Date.now() purity violations resolved via targeted `eslint-disable-next-line react-hooks/purity` + rationale comment — NOT structural refactor (Server Components run once per request; the rule is shape-blind to context)"
  - "D-A-02: Shared useIsClient() hook backed by useSyncExternalStore replaces 2 instances of useState(false)+useEffect(setHydrated(true)) hydration-detection pattern"
  - "D-A-03: LocalTime + RelativeTime refactored to useSyncExternalStore three-arg form — server snapshot = raw ISO, client snapshot = locale-formatted string; suppressHydrationWarning preserved"
  - "D-A-04: ChatUI assistant-timestamp capture hoisted from status==='streaming' useEffect to useChat onFinish callback — AI SDK v6 does NOT surface onChunk, so onFinish (stream-end) is the closest event-driven hook to D-A-02-AMENDED design intent"
  - "D-A-05: Trivials (_reset unused arg + let totalCost prefer-const) resolved by structural cleanup (remove binding / change keyword), NOT eslint-disable"
  - "D-B-03: Task 9 manual smoke is the live-verification gate (Joe-driven) — replaces a CI integration test that would otherwise duplicate the existing Playwright cat6 suite"
  - "D-C-03: Plan 07-01 Task 3 (clean-env pre-flight) absorbed into Plan 07-1A Task 8 — runs after lint debt resolution so the gate can exit 0"
  - "D-D-02: ROADMAP.md plan insertion (07-1A between 07-01 and 07-02) does NOT renumber 07-02 — preserves Phase 6 / Phase 05.2 decimal-phase precedent of NOT cascading renames"
  - "Deviation D1: ChatUI onFinish callback null-guards `message?.role === 'assistant'` (added beyond plan) to preserve existing `tests/ChatUI-fallback-redirect.test.tsx` BL-18 isolation test (partial payloads where message may be undefined)"
  - "Deviation D2: Task 7 calibrate page used inline-line eslint-disable form (preceding-line form silenced wrong span — eslint diagnostic on `Date.now()` token, not const-statement start)"
  - "Deviation D3 (NEW FINDING): 2 additional react-hooks@6 violations beyond the cataloged 9 — `setSessionId(id)` in chat/page.tsx and `setDismissed(...)` in ChatStatusBanner.tsx — both canonical sessionStorage-read-on-mount patterns; resolved via same eslint-disable-next-line + rationale strategy as D-A-01. Contradicts 07-01-CONTEXT empirical 'wrapped setStates don't trip' claim"

patterns-established:
  - "useIsClient() hook (src/hooks/use-is-client.ts): canonical SSR-safe client-detection — use this instead of useState(false)+useEffect(setHydrated(true)) anywhere a Client Component needs to defer render until after hydration"
  - "useSyncExternalStore three-arg form for prop-derived display: subscribe = `() => () => {}`, client snapshot = formatted value, server snapshot = raw value; pairs with suppressHydrationWarning on the rendered span"
  - "useChat onFinish for post-stream state mutation: AI SDK v6 does not expose onChunk; onFinish is the closest event-driven hook with idempotency guarded by checking the message-id key in state before writing"
  - "eslint-disable-next-line scoping rule: when the violating expression spans multiple physical lines, attach the disable comment on the SAME line as the actual diagnostic token (typically the function call), not on the wrapping const-statement"
  - "Server-Component Date.now() rationale comment: `// Server Component — Date.now() in render is correct (runs once per request).` — paired with eslint-disable-next-line so future diff reviewers see intent"

requirements-completed: []  # Plan 07-1A is a CI-instrumentation phase; requirements array in PLAN.md frontmatter is `requirements: []`

# Metrics
duration: ~45 min
completed: 2026-05-14
---

# Phase 7 Plan 07-1A: React-hooks Lint Debt Resolution Summary

**Resolved 11 react-hooks@6 violations (9 cataloged + 2 newly-found) in `src/` via shared useIsClient hook, useSyncExternalStore time-component refactors, useChat onFinish timestamp hoist, and targeted Server-Component disable comments — clean-env 4-command pre-flight gate now exits 0 from a zero-secrets shell, unblocking Plan 07-02 test.yml authoring.**

## Performance

- **Duration:** ~45 min (Tasks 1-7 sequential + Task 8 verification + Task 9 manual smoke + Task 10 ROADMAP)
- **Started:** 2026-05-14 (Phase 07 execution start)
- **Completed:** 2026-05-14
- **Tasks:** 10/10 (Task 9 checkpoint approved by Joe: "All tested and look fine")
- **Files modified:** 10 production + 1 ROADMAP = 11 modified, 1 hook created

## Accomplishments

- Resolved all 9 cataloged eslint-plugin-react-hooks@6 violations from 07-01-SUMMARY.md across 9 production files
- Discovered + resolved 2 additional react-hooks@6 violations not predicted by 07-01-CONTEXT.md empirical claim (Deviation D3 — flag for future planners)
- Created `src/hooks/use-is-client.ts` shared hook backed by `useSyncExternalStore` — establishes reusable SSR-safe hydration-detection primitive for the codebase
- Closed 07-01 deferred Task 3: clean-env pre-flight gate (`npm test && npx tsc --noEmit && npm run lint && npm run build`) exits 0 from a zero-secrets shell; vitest 654 passed; tsc clean; lint clean; build clean both with and without `.env.local`
- Captured empirical sentinel env-var list (12 vars) for Plan 07-02's `test.yml` `env:` block authoring (see Handoff section)
- Existing Playwright cat6 suite passes (8/8)
- Joe-driven manual smoke green across all 6 walk items: chat send + timestamp divider + matrix-mode toggle + body-class cleanup + admin abuse page + admin evals/calibrate

## Task Commits

Each task was committed atomically per repo convention. Tasks 8 and 9 are verification-only (no code commits).

1. **Task 1: Trivials warmup (D-A-05)** — `30dbec6` (fix)
2. **Task 2: useIsClient hook (D-A-02)** — `24663bd` (feat)
3. **Task 3: Migrate hydration sites to useIsClient (D-A-02)** — `1f0971e` (refactor)
4. **Task 4: LocalTime to useSyncExternalStore (D-A-03)** — `4ac838c` (refactor)
5. **Task 5: RelativeTime to useSyncExternalStore (D-A-03)** — `b61b1a1` (refactor)
6. **Task 6: ChatUI onFinish hoist (D-A-04)** — `5ce1ff0` (refactor)
7. **Task 7: Server-Component purity disables + 2 newly-found sessionStorage disables (D-A-01 + D3)** — `f009fcc` (fix)
8. **Task 8: Clean-env pre-flight verification** — verification-only (no commit); results captured in Handoff section
9. **Task 9: Joe-driven manual smoke** — checkpoint approved 2026-05-14 ("All tested and look fine"); no commit
10. **Task 10: Insert 07-1A into ROADMAP.md plans block (D-D-02)** — `b3badcc` (docs)

**Plan metadata commit:** _to be added by final SUMMARY commit_

## Files Created/Modified

**Created:**
- `src/hooks/use-is-client.ts` — Shared `useIsClient()` hook backed by `useSyncExternalStore` (D-A-02 idiom). 'use client' directive + named export. Subscribe is a no-op; client snapshot always `true`; server snapshot always `false`. JSDoc rationale references 07-1A-CONTEXT.md D-A-02.
- `.planning/phases/07-add-test-yml-github-actions-workflow-for-determinism/07-1A-SUMMARY.md` — this file.

**Modified (production):**
- `src/app/error.tsx` — Removed unused `reset: _reset` destructure binding; type signature preserved (D-A-05).
- `src/lib/eval/cats/cat2.ts` — Changed `let totalCost = 0` → `const totalCost = 0` (D-A-05; verified zero reassignments downstream).
- `src/app/chat/page.tsx` — Replaced `useState(false) + useEffect(setHydrated(true))` hydration pattern with `const isClient = useIsClient()` from new hook; updated render guard to `if (!isClient || !sessionId)`. Body-class useEffect preserved verbatim. (D-A-02). Also: `setSessionId(id)` inside sessionStorage-read effect received `eslint-disable-next-line` + rationale (D3 newly-found violation).
- `src/components/ChatStatusBanner.tsx` — Same migration as chat/page.tsx (D-A-02). Also: `setDismissed(...)` inside sessionStorage-read effect received `eslint-disable-next-line` + rationale (D3 newly-found violation). WR-04 sessionStorage SecurityError comment preserved.
- `src/app/admin/components/LocalTime.tsx` — Full rewrite to `useSyncExternalStore` three-arg form; `formatIso` helper extracted file-private; `suppressHydrationWarning` preserved; props signature unchanged (D-A-03).
- `src/app/admin/components/RelativeTime.tsx` — Full rewrite to `useSyncExternalStore` three-arg form; `relative` helper preserved verbatim with all 6 time-bucket branches; `suppressHydrationWarning` preserved; props signature unchanged; no re-tick mechanism added (D-A-03).
- `src/components/ChatUI.tsx` — Removed status==='streaming' useEffect that stamped `assistantTimestamps`; extended existing `onFinish` callback to destructure `message` and stamp `if (message?.role === 'assistant')` with idempotency guard; BL-18 error-counter reset logic preserved; auto-scroll useEffect preserved; header comment updated to reflect new firing edge (D-A-04 + Deviation D1 null-guard).
- `src/app/admin/(authed)/abuse/page.tsx` — Added `// eslint-disable-next-line react-hooks/purity` + rationale comment immediately preceding `const SINCE = new Date(Date.now() - ...)` line (D-A-01).
- `src/app/admin/(authed)/evals/calibrate/page.tsx` — Added inline-line `// eslint-disable-next-line react-hooks/purity` form (Deviation D2) because the const-statement spans multiple physical lines and the eslint diagnostic attaches to the `Date.now()` token, not the const-statement start. Rationale comment paired (D-A-01).

**Modified (planning):**
- `.planning/ROADMAP.md` — Phase 7 plans block: count `2 plans` → `3 plans`; 07-01 entry checkbox `[ ]` → `[x]` with PARTIAL text; new 07-1A entry inserted between 07-01 and 07-02 (no renumbering cascade per D-D-02); 07-02 entry unchanged.

## Decisions Made

See `key-decisions` in frontmatter for the canonical list. Highlights:
- All 9 cataloged violations followed CONTEXT.md D-A-01..05 strategies verbatim (no per-violation re-debate).
- Deviation D2 (calibrate page disable-comment form) was anticipated by the plan's Task 7 action block (fallback single-line form) — executor applied it as documented contingency, not as a new decision.
- Deviation D3 (2 newly-found violations) was NOT anticipated by 07-01-CONTEXT empirical claim; resolved consistently with D-A-01 rather than a different strategy (rule 1 deviation: structural fix would have required `useSyncExternalStore` synthetic subscribe for sessionStorage, disproportionate to the 2-line setState).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] ChatUI onFinish null-guard on `message?.role`**
- **Found during:** Task 6 (ChatUI onFinish hoist)
- **Issue:** The plan's stamp expression was `if (message.role === 'assistant')`. Existing test `tests/ChatUI-fallback-redirect.test.tsx` (BL-18 isolation) provides partial payloads in onFinish where `message` may be undefined. Without the `?.` null-guard, the test crashes with "Cannot read properties of undefined (reading 'role')".
- **Fix:** Used `message?.role === 'assistant'` instead. Idempotency guard (`prev[message.id] ? prev : ...`) preserved.
- **Files modified:** `src/components/ChatUI.tsx`
- **Verification:** Existing test suite preserved; 654 vitest passed.
- **Committed in:** `5ce1ff0` (Task 6 commit)

**2. [Rule 3 - Blocking] Task 7 calibrate page: inline-line eslint-disable form**
- **Found during:** Task 7 (Server-Component purity disables)
- **Issue:** The plan's preferred form (disable comment on the line IMMEDIATELY preceding the const-statement) did NOT silence the eslint diagnostic on the calibrate page because the diagnostic attaches to the `Date.now()` token (inside the const expression), not to the const-statement start. This produced "Unused eslint-disable directive" warnings.
- **Fix:** Switched to the plan's documented fallback: inline-line form where the eslint-disable-next-line precedes the actual `Date.now()` call (or, equivalently, the disable comment sits on the const line itself when Date.now() is the only statement-level expression). Pattern documented in patterns-established.
- **Files modified:** `src/app/admin/(authed)/evals/calibrate/page.tsx`
- **Verification:** `npm run lint` exits 0; no "Unused eslint-disable" warnings.
- **Committed in:** `f009fcc` (Task 7 commit)

**3. [Rule 1 - Bug / NEW FINDING] 2 additional react-hooks@6 violations beyond the cataloged 9**
- **Found during:** Task 8 (clean-env pre-flight verification — final `npm run lint` revealed 2 violations that Tasks 1-7 had not addressed)
- **Issue:** `setSessionId(id)` in `src/app/chat/page.tsx:51` and `setDismissed(...)` in `src/components/ChatStatusBanner.tsx:26` are both flagged by `react-hooks@6` as `set-state-in-effect`. Both are canonical sessionStorage-read-on-mount patterns wrapped in `if (typeof window !== 'undefined')` / `try { ... } catch {}` blocks. **This contradicts 07-01-CONTEXT.md's empirical claim that "wrapped setStates don't trip the rule"** — `react-hooks@6` is more aggressive than the 07-01 codification suggested.
- **Fix:** Resolved via `eslint-disable-next-line react-hooks/set-state-in-effect` + rationale comment ("sessionStorage-read-on-mount; structural refactor to useSyncExternalStore would require synthetic subscribe — disproportionate"). Strategy consistent with D-A-01 (targeted disable + rationale) rather than the structural refactor pattern of D-A-02..04. Disproportionate-refactor judgment: sessionStorage does NOT fire same-tab `storage` events, so a `useSyncExternalStore` refactor would need a synthetic subscribe (no-op or window 'pageshow' polling) for negligible runtime gain.
- **Files modified:** `src/app/chat/page.tsx`, `src/components/ChatStatusBanner.tsx` (the same 2 files Task 3 had already migrated for the hydration pattern; Task 7 commit added the 2nd round of changes)
- **Verification:** `npm run lint` exits 0 from clean-env shell.
- **Committed in:** `f009fcc` (Task 7 commit — bundled with Task 7's server-purity disables because both are eslint-disable additions)
- **Flag for future planners:** `react-hooks@6` rule severity is more aggressive than the 07-01-CONTEXT codification. When migrating future codebases, expect that `if/try/catch`-wrapped setStates inside effects WILL trip `set-state-in-effect` — they are not exempt by virtue of being conditional.

---

**Total deviations:** 3 auto-fixed (1 missing critical = null-guard for existing test contract; 1 blocking = inline-line disable form; 1 newly-found = 2 additional violations not in 07-01 catalog)
**Impact on plan:** All deviations necessary for correctness / lint-clean state. Deviation D3 has informational impact on future planners (recorded in patterns-established). No scope creep — all fixes within plan's `files_modified` boundary.

## Issues Encountered

None beyond the 3 auto-fixed deviations above. Plan executed in the documented sequence; no checkpoint blocks beyond Task 9's expected human-verify gate.

## User Setup Required

None — Plan 07-1A modifies application code only; no new environment variables, no new external services. Plan 07-02 will introduce GitHub Actions `test.yml` which requires GitHub side configuration (branch protection rule) — out of scope for this plan.

## Handoff

This section is THE consumer input for Plan 07-02's `test.yml` authoring. Read this BEFORE drafting the workflow file.

### Sentinel env-var contract (captured during Task 8 from a clean-env shell)

The following 12 environment variables required sentinel placeholder values for `npm run build` to complete cleanly in a zero-secrets shell. These are LITERAL placeholder strings; Plan 07-02 must use them as **literal env values**, NOT as `secrets.*` references (per Phase 7 D-B-01 — `test.yml` must have zero `secrets.*` injections):

```yaml
env:
  CI: 'true'  # explicit (vitest exclude branch from Plan 07-01 D-C-02/03)
  NEXT_PUBLIC_SUPABASE_URL: 'https://sentinel.local'
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sentinel-anon-key'
  SUPABASE_SERVICE_ROLE_KEY: 'sentinel-service-role-key'
  ANTHROPIC_API_KEY: 'sentinel-do-not-use'
  EXA_API_KEY: 'sentinel-do-not-use'
  GOOGLE_GENERATIVE_AI_API_KEY: 'sentinel-do-not-use'
  UPSTASH_REDIS_REST_URL: 'https://sentinel.local'
  UPSTASH_REDIS_REST_TOKEN: 'sentinel-do-not-use'
  RESEND_API_KEY: 'sentinel-do-not-use'
  CRON_SECRET: 'sentinel-do-not-use'
  ADMIN_GITHUB_LOGINS: 'sentinel-login'
```

Plus optional `NEXT_PUBLIC_TURNSTILE_*` vars: not required for build to succeed (feature-flag default OFF from Plan 02-04 ships with absent vars treated as "Turnstile disabled"). Plan 07-02 can omit these from `test.yml` `env:` unless adding Turnstile-on coverage.

### Lint command shape that worked

```
npm run lint    # which is literally `eslint src/` per package.json from Plan 07-01
```

No `--max-warnings 0` flag needed — `eslint src/` exits 0 cleanly after Plan 07-1A. Plan 07-02's `test.yml` should invoke `npm run lint` (not re-invent the command).

### Tested build commands

```
npm run build    # exits 0 with the sentinel-only env block AND with .env.local present
```

The prebuild hook (`tsx scripts/generate-fallback.ts`) ran successfully in both scenarios. Plan 07-02 does NOT need to add a separate generate-fallback step — `npm run build` auto-chains it.

### Wall-clock metrics from Task 8 (informational for Plan 07-02 timeout calibration)

| Command | Local wall-clock | Notes |
|---------|------------------|-------|
| `npm test` (vitest) | ~30-45 sec | 654 passed, 12 skipped |
| `npx tsc --noEmit` | ~10-15 sec | clean |
| `npm run lint` | ~5-10 sec | clean |
| `npm run build` | ~60-90 sec | next build with prebuild hook |

Plan 07-02's `timeout-minutes: 10` is comfortable. Expect 1.5-3x slower on GH Actions Ubuntu runner; if local total approaches 5 min, bump timeout to 15.

### Playwright cat6 results (from Task 9 Step 9.1)

```
npx playwright test tests/e2e/chat-happy-path.spec.ts tests/e2e/cat-06-view-toggle.spec.ts
8 passed (8/8)
```

Plan 07-02 may include Playwright in `test.yml` later, but Plan 07-02's stated scope is the 17 SAFE-11 system-prompt determinism tests; Playwright is a separate concern.

### Joe-driven manual smoke confirmation

Joe approved Task 9 with: "All tested and look fine" on 2026-05-14. All 6 smoke-walk items confirmed: chat send + timestamp divider + matrix toggle + body-class cleanup + admin abuse page + admin evals/calibrate. No regressions.

### Plan 05.2-03 timestamp-divider invariant

D-A-04 invariant preserved: Plan 05.2-03's `shouldShowTimestampBefore` 5-min rule renders timestamps for every assistant message; the firing edge shifted from "status==='streaming' transition (first chunk)" to "useChat onFinish (stream end)" with sub-second delta — Joe-confirmed in smoke step 2 (no visible regression).

## Threat Flags

None. Plan 07-1A modifies Client/Server-Component refactor surface only — no new endpoints, no new auth boundaries, no new external API calls, no new persisted state, no new secrets, no new dependencies, no schema changes at trust boundaries.

## Self-Check

**1. All 10 tasks have commits or documented checkpoint approval:**
- Task 1: `30dbec6` FOUND
- Task 2: `24663bd` FOUND
- Task 3: `1f0971e` FOUND
- Task 4: `4ac838c` FOUND
- Task 5: `b61b1a1` FOUND
- Task 6: `5ce1ff0` FOUND
- Task 7: `f009fcc` FOUND
- Task 8: verification-only (no commit); Handoff section documents results
- Task 9: human-verify checkpoint approved by Joe 2026-05-14 ("All tested and look fine")
- Task 10: `b3badcc` FOUND

**2. SUMMARY frontmatter `status:` field:** N/A — template uses `completed:` date; populated as 2026-05-14. Frontmatter complete per template.

**3. Goal achieved:**
- `npm run lint` exits 0 from clean-env shell: YES (verified Task 8)
- Pre-flight gate green: YES (4 commands all exit 0)
- Sentinel env-var list handed off: YES (12-var YAML block above)

**4. No work outside plan boundary:**
- No `.github/workflows/` files modified (07-02's scope): CONFIRMED
- No `tests/scripts/evals` cleanup beyond the cataloged 9 + 2 newly-found in src/: CONFIRMED
- No pre-emptive regression tests (D-B-02 posture): CONFIRMED — existing tests preserved, no new tests added

**5. Plan 05.2-03 timestamp-divider invariant preserved:** YES (Joe-confirmed in smoke step 2)

**6. Files created/modified all exist:**
- `src/hooks/use-is-client.ts`: FOUND
- All 9 production files modified: FOUND (verified via `git log --name-only -- <file>` per file)
- `.planning/ROADMAP.md`: FOUND (Phase 7 plans block updated)

**Self-Check: PASSED**

## Next Plan Readiness

Plan 07-02 is unblocked. The clean-env 4-command pre-flight gate that test.yml will exercise is now green; sentinel env-var contract is captured above; lint command shape is confirmed; Playwright cat6 suite is green. Plan 07-02 author can proceed to draft `.github/workflows/test.yml` with the Handoff section as direct input.

Phase 7 is NOT complete — Plan 07-02 still pending (test.yml authoring + branch-protection lock + induced-break demo). v1.0 milestone close is NOT gated by Phase 7 (parallel CI-hardening per STATE.md; v1.0 only blocked by Plan 05-12 friend-test sign-off).

---
*Phase: 07-add-test-yml-github-actions-workflow-for-determinism*
*Plan: 1A (lint debt resolution + 07-01 Task 3 absorption)*
*Completed: 2026-05-14*
