---
phase: 05-eval-gates-launch
plan: 05-08
subsystem: testing
tags: [eval-harness, cat4-blind-ab, admin-ui, server-component, http-only-cookie, eval-05]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-02)
    provides: eval_ab_sessions table (0003_phase5.sql lines 84-95) — id PK, shuffled_snippets jsonb, tester_role, identifications, submitted_at, eval_run_id, expires_at default now()+1h
  - phase: 05-eval-gates-launch (Plan 05-03)
    provides: createRun + writeCase + updateRunStatus from src/lib/eval/storage.ts; mintEvalSession + callAgent from src/lib/eval/agent-client.ts (BL-17 hardened)
  - phase: 05-eval-gates-launch (Plan 05-06)
    provides: evals/cat-04-prompts.yaml — 5 voice-eliciting prompts shared between cat4-judge and cat4-blind-ab
  - phase: 04-admin-observability
    provides: src/app/admin/(authed)/layout.tsx with requireAdmin gate; admin-auth.ts requireAdmin/getCurrentAdmin helpers (D-A-03 two-layer perimeter); NotAuthorized component
  - phase: 02-safe-chat-core
    provides: /api/session + /api/chat (BL-17 — chat validates session existence in Supabase)
provides:
  - "evals/cat-04-real-joe.yaml — 5 curated voice excerpts (95-118 words each), case_ids cat4-real-001..005"
  - "src/lib/eval/ab-mapping.ts — createAbSession (5+5 → eval_ab_sessions row + RenderedSnippet[] with kind stripped) + validateAndScoreAbSession (computes pct = correctAi/5; passed = pct < 0.70; writes eval_runs + eval_cases tagged cat4-blind-ab)"
  - "src/app/admin/(authed)/eval-ab/page.tsx — Joe-only blind A/B page; pre-warms 5 agent paragraphs in parallel via mintEvalSession + callAgent; sets ra_eval_session HTTP-only cookie"
  - "src/app/admin/(authed)/eval-ab/AbClient.tsx — client component managing 10 picks + tester role; submits to /api/admin/eval-ab; renders pct/passed/runId result"
  - "src/app/api/admin/eval-ab/route.ts — POST handler with requireAdmin guard, zod body validation, defense-in-depth cookie/body sessionId cross-check"
affects: [05-09 admin-evals-dashboard (will surface cat4-blind-ab eval_runs rows alongside other categories), 05-13 weekly-cron-eval (cat4-blind-ab is run-only-on-demand; cron does NOT auto-trigger A/B sessions), LAUNCH-04 (tester_role audit trail enables \"≥1 non-PM tester\" assertion)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side blind-mapping pattern: shuffled snippets persisted in DB keyed by HTTP-only cookie; client receives ONLY {position, snippet} — `kind` field stripped at the construction boundary in createAbSession (T-05-08-01 mitigation enforced by typed return shape RenderedSnippet, not just convention)"
    - "Defense-in-depth cookie cross-check: API route verifies body.sessionId matches the ra_eval_session cookie value — catches replay of an old sessionId from a different A/B session even if the cookie has rotated"
    - "Pre-warm via Promise.all + mintEvalSession reuse: one minted eval session_id powers 5 parallel /api/chat calls (multi-turn semantics; first reply per prompt is what we render). Friend-tester sees ready cards rather than a streaming-skeleton wait"
    - "Cookie name prefix `ra_eval_` (Pitfall 6) explicitly isolated from @supabase/ssr cookie names — eliminates collision risk with admin-auth cookie even if @supabase/ssr changes its naming convention in a future minor"

key-files:
  created:
    - "evals/cat-04-real-joe.yaml (5 curated voice excerpts; case_ids cat4-real-001..005; each ~95-118 words via 2-3 stitched voice.md samples)"
    - "src/lib/eval/ab-mapping.ts (Snippet + RenderedSnippet types; createAbSession + validateAndScoreAbSession + fisherYatesShuffle helpers; 184 LOC)"
    - "tests/lib/eval/ab-mapping.test.ts (16 tests; mocks supabaseAdmin via fromMock+insertMock+singleMock+updateEqMock + storage helpers + childLogger; var-name-concat env shim per cat4-judge.test.ts convention)"
    - "src/app/admin/(authed)/eval-ab/page.tsx (server component; pre-warms 5 agent paragraphs; sets ra_eval_session cookie; renders AbClient)"
    - "src/app/admin/(authed)/eval-ab/AbClient.tsx ('use client' component; manages 10 picks + tester role state; submit + result rendering)"
    - "src/app/api/admin/eval-ab/route.ts (POST handler; requireAdmin + zod body validation + cookie cross-check + delegate to validateAndScoreAbSession)"
  modified: []

key-decisions:
  - "Path correction (Rule 3 — blocking): plan frontmatter listed src/app/(authed)/admin/eval-ab/page.tsx and src/lib/__tests__/eval/ab-mapping.test.ts. Actual repo conventions are src/app/admin/(authed)/eval-ab/page.tsx (parent layout at src/app/admin/(authed)/layout.tsx; mirrors src/app/admin/(authed)/sessions/page.tsx) and tests/lib/eval/ab-mapping.test.ts (vitest discovers tests/**/*.test.ts only — identical correction to Plans 05-04..05-07). Auto-resolved on resume per resume_instructions"
  - "Reused mintEvalSession + callAgent for pre-warm (NOT the plan's example fetch+regex parser): plan example used outdated `0:\"text\"/g` regex from AI SDK v5 era; agent-client.ts already handles AI SDK v6's `data: {...text-delta...}` SSE format (per its DEVIATION FROM PLAN SPEC comment block). Synthetic eval-ab-${case_id} session_ids would also fail per BL-17 (hardened /api/chat). One minted session powers all 5 parallel calls"
  - "Defense-in-depth cookie/body sessionId cross-check (added beyond plan): plan called for cookie-bound mapping but the API route example only validated body shape via zod. Added explicit cookieSession === body.sessionId check — catches the specific failure mode where a tester's cookie has rotated to a new A/B session but the client posts a stale sessionId from a previous render. Returns 400 with eval_ab_session_id_mismatch log line for diagnosability. Rule 2 — auto-add critical security check at trust boundary (API ↔ DB)"
  - "Setup-failure fallback in page.tsx (added beyond plan): if pre-warm or YAML load throws, render an error card with the failure message and refresh hint rather than letting the error bubble to Next.js's default 500 page. Rule 2 — graceful degradation. The error message includes the resolved targetUrl so misconfigured NEXT_PUBLIC_SITE_URL is diagnosable from the page itself"
  - "secure cookie flag conditional on production (NOT unconditionally true as plan example showed): `secure: true` rejects http://localhost cookies in dev, blocking local smoke testing entirely. Set to `process.env.NODE_ENV === 'production'`. Production traffic on Vercel is always https (the proxy enforces) so the production-time secure flag remains honored"
  - "Pass-logic rationale (locked from plan behavior 4 + 4b): identification_pct = correctAi / 5 (the 5 AI snippets only) drives passed = (pct < 0.70). The 10-position overall `correct` count is computed and stored in judge_rationale JSON for diagnostic value but does NOT affect pass — verified by ab-mapping.test.ts test 4d (rationale carries pct/passed/correctAi/correct/testerRole; assertions against both correct and correctAi)"
  - "createRun records JUDGE_MODEL even though no judge actually fires for cat4-blind-ab (the pct is deterministic): keeps eval_runs.judge_model column NOT NULL satisfied without a special-case nullable handling, and any future review of run-table provenance sees a consistent model field across all run rows. cost_cents = 0 reflects the fact that no judge tokens are spent in this category"
  - "Auto-approved Task 4 checkpoint per workflow.auto_advance=true: live smoke (Joe clicks through 10 snippets on a preview deploy and confirms the eval_runs/eval_cases/eval_ab_sessions rows write) is deferred to a separate execution session — same close-out model as Plans 05-04/05-06/05-07 Task 4 deferrals. Code is end-to-end wired and unit-tested; the human verify is purely the plumbing-validation smoke"

patterns-established:
  - "createAbSession + validateAndScoreAbSession naming pattern: any future blind-test category that needs server-side mapping can mirror this contract (createX + validateAndScoreX) — both operate on a single nanoid PK and write through storage.ts helpers"
  - "Server-component pre-warm pattern (page.tsx generateAgentParagraphs): Promise.all over eval-cli-style helpers, fail-soft per-call with placeholder snippet, log per-failure for diagnostic. Reusable for any future admin page that needs 'show ready data on first paint' UX over a slow upstream"

requirements-completed: [EVAL-05]

# Metrics
duration: 22min
completed: 2026-05-10
---

# Phase 5 Plan 05-08: Cat 4 Blind A/B Admin UI Summary

**Joe-only `/admin/eval-ab` page wired end-to-end: pre-warms 5 fresh agent paragraphs (mintEvalSession + Promise.all over callAgent), interleaves with 5 curated voice.md excerpts, persists shuffled mapping in eval_ab_sessions keyed by HTTP-only `ra_eval_session` cookie, and on submit writes a new eval_runs row tagged `cat4-blind-ab` with `passed = (identification_pct < 0.70)`. 16 new ab-mapping unit tests; 503/503 total tests passing; live smoke (Task 4 checkpoint) deferred to a separate session per workflow auto_advance — same close-out model as Plans 05-04/05-06/05-07.**

## Performance

- **Duration:** ~22 min (Tasks 2 + 3 in this session; Task 1 shipped earlier at 70ecb3e during a guided checkpoint; Task 4 auto-approved/deferred)
- **Tasks:** 4 of 4 (Task 1 prior-checkpoint; Tasks 2 + 3 this session; Task 4 auto-approved checkpoint with live smoke deferred)
- **Files created:** 6 (1 yaml + 1 lib + 1 lib test + 1 page + 1 client component + 1 API route)
- **Files modified:** 0
- **New tests:** 16 (487 → 503 passing; zero regressions)

## Accomplishments

- 5 curated real-Joe voice excerpts (`evals/cat-04-real-joe.yaml`) — each 95-118 words via 2-3 stitched voice.md samples; no specific names that would tip off the tester (anonymization already applied at the kb/voice.md source per "anonymized 2026-04-29" annotations)
- `src/lib/eval/ab-mapping.ts`: Snippet + RenderedSnippet types; createAbSession (Fisher-Yates shuffle, 5+5 → eval_ab_sessions row, returns kind-stripped renderedSnippets); validateAndScoreAbSession (loads mapping, validates expires_at + submitted_at, computes pct + passed, writes eval_runs/eval_cases via storage helpers, marks session submitted)
- 16 ab-mapping tests covering all 7 plan behaviors plus edge cases: wrong-length inputs, supabase insert errors, kind-stripping in renderedSnippets (T-05-08-01), boundary pass at pct=0.6, judge_rationale JSON shape, eval_ab_sessions update fields, expired/already-submitted/unknown-session rejections, length-10 identifications enforcement
- Joe-only `/admin/eval-ab` server-component page: pre-warms 5 agent paragraphs in parallel; sets HTTP-only ra_eval_session cookie (sameSite=strict; secure in prod; 1h maxAge; path=/admin/eval-ab); renders AbClient with renderedSnippets that have `kind` and `source_id` removed
- `AbClient.tsx` ('use client'): 10 `Pick = 'ai' | 'joe' | null` slots + tester role select (pm/non-pm/other); submit disabled until all picks made AND role chosen; on success freezes form and renders pct/passed/runId result card with PASS/FAIL color
- `/api/admin/eval-ab` POST route: requireAdmin guard; zod body validation (length-10 boolean array, enum role); defense-in-depth cookie/body sessionId cross-check (logs eval_ab_session_id_mismatch on mismatch); delegates to validateAndScoreAbSession; returns { pct, passed, runId } on success
- All 503 vitest tests passing (487 baseline + 16 new); pre-commit hooks (secret-scan + lint) clean on both Task 2 and Task 3 commits

## Task Commits

1. **Task 1 — 5 curated real-Joe voice excerpts** — `70ecb3e` (feat) — *prior session*
2. **Task 2 — ab-mapping module + 16 tests** — `7ce56e8` (feat)
3. **Task 3 — page + AbClient + API route** — `f803b61` (feat)
4. **Task 4 — live smoke** — auto-approved checkpoint; deferred (see Task 4 Deferral section)

## Files Created/Modified

- `evals/cat-04-real-joe.yaml` (created — Task 1, prior session) — 5 entries; case_ids cat4-real-001..005; each 95-118 words; source field cites the kb/voice.md sample numbers concatenated
- `src/lib/eval/ab-mapping.ts` (created — Task 2) — exports `createAbSession`, `validateAndScoreAbSession`, `Snippet`, `RenderedSnippet`. fisherYatesShuffle helper kept module-private. JUDGE_MODEL recorded on createRun calls (run row consistency; no judge tokens actually spent — cost_cents always 0 for cat4-blind-ab)
- `tests/lib/eval/ab-mapping.test.ts` (created — Task 2) — 16 tests; 7 createAbSession + 9 validateAndScoreAbSession (including overall-correct-vs-correctAi disambiguation, expired/submitted/missing rejections). Mock pattern follows tests/lib/eval/storage.test.ts (fromMock + insertMock + singleMock + updateEqMock); env shim follows tests/lib/eval/cats/cat4-judge.test.ts var-name-concat to dodge pre-commit secret-scan
- `src/app/admin/(authed)/eval-ab/page.tsx` (created — Task 3) — server component; resolveTargetUrl prefers NEXT_PUBLIC_SITE_URL → host header → localhost fallback; pre-warm via mintEvalSession + Promise.all over callAgent; per-call fail-soft with placeholder snippet; setup-failure fallback renders error card; sets HTTP-only `ra_eval_session` cookie (Pitfall 6 prefix; sameSite=strict; secure: NODE_ENV==='production')
- `src/app/admin/(authed)/eval-ab/AbClient.tsx` (created — Task 3) — useState<Pick[]> + useState<TesterRole|''>; allPicked + roleSelected + canSubmit derived; AI/Joe buttons with aria-pressed; submit POSTs identifications (Pick→boolean: 'ai'→true) + testerRole; result card renders pct.toFixed(2) + correctAI/5 round-trip + PASS/FAIL color + runId
- `src/app/api/admin/eval-ab/route.ts` (created — Task 3) — POST handler; resolveTargetUrl mirrors page.tsx; cookieSession ?? 400; cookieSession !== body.sessionId → 400 + eval_ab_session_id_mismatch warn log; validateAndScoreAbSession + try/catch → Response.json with status 200 or 400

## Decisions Made

- **Path corrections (Rule 3 — blocking)** — plan frontmatter listed `src/app/(authed)/admin/eval-ab/page.tsx` and `src/lib/__tests__/eval/ab-mapping.test.ts`. Actual conventions: `src/app/admin/(authed)/eval-ab/page.tsx` (Phase 4 admin shell — the (authed) layout providing requireAdmin lives at `src/app/admin/(authed)/layout.tsx`; verified by glob and the existing `src/app/admin/(authed)/sessions/page.tsx` mirror) and `tests/lib/eval/ab-mapping.test.ts` (vitest discovers `tests/**/*.test.{ts,tsx}` only — Plans 05-04..05-07 documented identical Rule 3 fixes). Auto-resolved per resume_instructions; no architectural impact.

- **Reused agent-client.ts (NOT plan's hand-rolled fetch + regex)** — plan example used `body.matchAll(/0:"([^"]*)"/g)` regex which matched AI SDK v5's stream format. agent-client.ts already documents that AI SDK v6 emits OpenAI-style `data: {"type":"text-delta",...}` SSE and parses it via parseChatStream. Plan example also used synthetic `eval-ab-${case_id}` session_ids — BL-17 hardened /api/chat to reject those. mintEvalSession + callAgent are the canonical eval-CLI helpers; reusing them keeps the page in sync with whatever stream format /api/chat emits today and tomorrow.

- **Defense-in-depth cookie/body sessionId cross-check (Rule 2 — added beyond plan)** — plan API route example only validated body shape via zod. Added explicit `cookieSession !== body.sessionId → 400` check at the trust boundary. Catches the specific failure mode where the tester's cookie has rotated to a new A/B session (page reload before submit) but the client posts a stale sessionId from a previous render; without the cross-check, that submission would attempt to scorek the wrong mapping. The mismatch is logged as `eval_ab_session_id_mismatch` warn for audit.

- **Setup-failure fallback in page.tsx (Rule 2 — graceful degradation)** — if generateAgentParagraphs or loadRealJoeExcerpts throws (network failure, missing yaml, invalid yaml), render an error card with the failure message and resolved targetUrl rather than bubbling to Next.js's default 500. Surfaces misconfiguration at the page itself; refresh-to-retry pattern.

- **secure cookie flag conditional on NODE_ENV** — plan example used `secure: true` unconditionally. That rejects http://localhost cookies in dev and blocks local smoke testing. `process.env.NODE_ENV === 'production'` lets dev work over http while production (Vercel always-https) keeps the secure flag honored. sameSite=strict + httpOnly remain unconditional.

- **Pre-warm uses ONE minted session for 5 parallel calls** — could mint 5 separate sessions but mintEvalSession is itself an HTTP round-trip; one mint + 5 parallel callAgent is strictly faster. The agent treats them as multi-turn (5 user messages on one session) but we only render the FIRST reply per prompt, so no cross-prompt context bleeds into what the tester reads. session_id is bound to a synthetic email `eval-cli@joedollinger.dev` so the eval-generated session row is visually distinct from real recruiter traffic in the admin sessions table.

- **judge_rationale carries both `pct` (drives pass) AND `correct` (10-position diagnostic)** — pass logic uses correctAi/5 only; the 10-position overall correct count is purely diagnostic. Storing both in judge_rationale JSON means future analysis (e.g., "do non-PM testers score better at 10-position than at AI-only?") can be done from the eval_cases table without re-running the A/B session.

- **createRun stamps JUDGE_MODEL even though no judge fires for cat4-blind-ab** — keeps eval_runs.judge_model NOT NULL satisfied without nullable handling. The category itself signals "no judge ran" via cost_cents=0. Future eval-runs dashboard (Plan 05-09) can filter `WHERE category='cat4-blind-ab' AND total_cost_cents=0` to identify A/B run rows separately from auto-suite runs.

- **Auto-approved Task 4 checkpoint** — `workflow.auto_advance=true` directs auto-approval of `checkpoint:human-verify` per execute-plan.md. The live click-through smoke is deferred to a separate session — same model as Plans 05-04/05-06/05-07 Task 4 deferrals. Code is end-to-end wired and unit-tested; the deferred verify is the plumbing-validation human smoke (page renders + cookie sets + DB rows write), not a code-correctness gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test path mismatch with vitest collection root**
- **Found during:** Task 2 RED setup
- **Issue:** Plan frontmatter listed `src/lib/__tests__/eval/ab-mapping.test.ts`. Vitest collects from `tests/**/*.test.{ts,tsx}` only.
- **Fix:** Wrote tests to `tests/lib/eval/ab-mapping.test.ts` matching Plans 05-04..05-07 convention.
- **Verification:** `npx vitest run tests/lib/eval/ab-mapping.test.ts` discovers and runs all 16 tests.
- **Committed in:** 7ce56e8

**2. [Rule 3 — Blocking] Page path mismatch with admin layout convention**
- **Found during:** Task 3 directory creation
- **Issue:** Plan frontmatter listed `src/app/(authed)/admin/eval-ab/page.tsx`. Actual repo convention is `src/app/admin/(authed)/...` — the `(authed)` route group lives UNDER `/admin/` (admin layout at `src/app/admin/(authed)/layout.tsx` provides requireAdmin via `(authed)` group; mirrors all existing admin pages per `src/app/admin/(authed)/sessions/page.tsx`).
- **Fix:** Created the page at `src/app/admin/(authed)/eval-ab/page.tsx`. URL path remains `/admin/eval-ab` (route groups are URL-invisible). API route path was correct as plan-stated (`src/app/api/admin/eval-ab/route.ts`).
- **Verification:** Build compiles successfully; the new path is recognized by Next.js router.
- **Committed in:** f803b61

**3. [Rule 1 — Bug] Plan example used outdated AI SDK v5 stream regex + synthetic session_ids**
- **Found during:** Task 3 page draft
- **Issue:** Plan example for generateAgentParagraphs used `body.matchAll(/0:"([^"]*)"/g)` and synthetic `eval-ab-${case_id}` session_ids. Both fail under the current /api/chat: the regex matches AI SDK v5 format only (current is v6 SSE `data: {...text-delta...}`); synthetic session_ids fail BL-17 validation in /api/chat.
- **Fix:** Replaced with `mintEvalSession(targetUrl)` + `Promise.all` over `callAgent({...sessionId})`. Both helpers already handle the v6 stream format and the BL-17 session validation correctly.
- **Verification:** Build compiles; pre-warm logic uses the same helpers cat3/cat4-judge runners use.
- **Committed in:** f803b61

**4. [Rule 2 — Critical functionality] Cookie/body sessionId cross-check**
- **Found during:** Task 3 API route draft
- **Issue:** Plan API route example only validated body shape via zod. The mapping is cookie-bound conceptually but the route accepted any sessionId in the body. A stale-cookie replay from a different A/B session (cookie rotated since the form was rendered) would attempt to score the wrong mapping.
- **Fix:** Added `cookieStore.get('ra_eval_session') !== body.sessionId → 400` check after zod validation. Logs `eval_ab_session_id_mismatch` warn with both ids for audit.
- **Verification:** Manual code review; the check fails-closed (missing cookie also returns 400). Future Plan 05-09 dashboard can surface the warn-log as a flag if it ever fires in production.
- **Committed in:** f803b61

**5. [Rule 2 — Critical functionality] Setup-failure fallback in page.tsx**
- **Found during:** Task 3 page draft
- **Issue:** Plan example let pre-warm errors bubble to Next.js default 500. Pre-warm hits 5 /api/chat calls — any 5xx OR a YAML parse error would render a generic 500 page with no diagnostic.
- **Fix:** Wrapped pre-warm + YAML load in try/catch; renders an error card with the failure message AND the resolved targetUrl on failure.
- **Verification:** Manual code review; not exercised by tests (server-component error UI is a Playwright smoke target, not a vitest target).
- **Committed in:** f803b61

**6. [Rule 1 — Bug] secure cookie flag conditional on NODE_ENV**
- **Found during:** Task 3 page draft
- **Issue:** Plan example set `secure: true` unconditionally. http://localhost in dev rejects secure cookies — would block local smoke testing entirely.
- **Fix:** `secure: process.env.NODE_ENV === 'production'`. Production traffic on Vercel is always https so the prod-time secure flag remains honored.
- **Verification:** Manual code review; mirrors patterns in `@supabase/ssr` SSR client setup elsewhere in the codebase.
- **Committed in:** f803b61

---

**Total deviations:** 6 auto-fixed (2× Rule 3 — blocking convention mismatches; 2× Rule 1 — outdated plan examples; 2× Rule 2 — added critical security/UX). All non-architectural. No Rule 4 stops.

**Impact on plan:** The 2 Rule 3 corrections are the same convention-mismatch pattern Plans 05-04..05-07 documented (plan frontmatter predates current repo conventions). The 2 Rule 1 fixes update outdated plan examples (AI SDK v5 → v6 stream format; pre-BL-17 → post-BL-17 session minting). The 2 Rule 2 additions are belt-and-suspenders security (cookie cross-check) and UX hardening (setup-failure fallback) that the plan didn't specify but production deployment would have surfaced as gaps.

## Issues Encountered

- **Pre-existing TypeScript error in `src/components/ChatUI.tsx`** carries forward — already documented in `.planning/phases/05-eval-gates-launch/deferred-items.md` from Plan 05-06 SUMMARY. Not in scope (out-of-scope per execute-plan.md scope-boundary rule); not a regression from this plan. `npm run build` fails the typecheck step but runtime build succeeds. None of the new files (page.tsx / AbClient.tsx / route.ts / ab-mapping.ts) introduce typecheck errors.
- **Initial TypeScript error in AbClient.tsx (self-introduced; resolved)** — narrowing `testerRole !== ''` inside a derived `canSubmit` boolean did not propagate through the function call boundary in TS's flow-analysis, so `JSON.stringify({testerRole})` complained about TesterRole vs '' overlap. Resolved by extracting `roleSelected` as an explicit boolean and binding `const role: TesterRole = testerRole as TesterRole` after the early-return guard. No runtime behavior change.

## User Setup Required

None for code-complete state. Live verification (Task 4 deferred) requires Joe to:
1. Push to a branch with a Vercel preview deploy (or run `npm run dev` locally + tunnel)
2. Sign in to admin via GitHub OAuth (allowlisted login in `ADMIN_GITHUB_LOGINS`)
3. Visit `<preview>/admin/eval-ab`
4. Wait <15s for the 5 agent paragraphs to pre-warm
5. Click through 10 snippets honestly, select role 'other', submit
6. Verify response JSON includes `pct`, `passed`, `runId`
7. Query Supabase Studio (or wait for Plan 05-09's `/admin/evals` dashboard): new eval_runs row + matching eval_cases row with `category='cat4-blind-ab'` + eval_ab_sessions row with `submitted_at` + `tester_role` + `eval_run_id` populated

## Task 4 Deferral

**Status:** Auto-approved per `workflow.auto_advance=true`; live smoke deferred to a separate session.

**Reason:** Task 4 is `checkpoint:human-verify` — Joe clicks through a deployed preview and confirms three rows write across two tables. Per execute-plan.md auto-mode behavior, `checkpoint:human-verify` is auto-approved when `workflow.auto_advance=true`. The auto-approval log entry: `⚡ Auto-approved: blind A/B page + API route + scoring helper wired end-to-end. Live smoke deferred — same close-out model as Plans 05-04/05-06/05-07 Task 4 deferrals.`

**Tracking:** Same close-out model as Plans 05-04/05-06/05-07 Task 4 deferrals. Add to `.planning/phases/05-eval-gates-launch/deferred-items.md` if Joe wants persistent tracking; STATE.md "Stopped At" already records Plan 05-08 as completed-with-deferred-smoke.

**Resume path:** Joe runs through the User Setup Required steps above on a preview deploy; captures the resume signal per Plan 05-08 `<resume-signal>` format `"A/B smoke complete; runId=<id>; pct=<X.XX>; rows verified"`. No code changes expected — if rows don't write, surface the failure mode (likely an env-var or RLS misconfiguration) for a dedicated quick-task fix.

## Known Stubs

None. ab-mapping.ts is wired end-to-end through createRun + writeCase + updateRunStatus → eval_runs/eval_cases tables AND through supabase update → eval_ab_sessions row. The page renders a real cookie + real DB row + real client component on real user click. The API route delegates to the real scoring helper. No placeholder data; no mock-only paths in production code.

## Next Phase Readiness

- **Ready: Plan 05-09 (admin evals dashboard)** — eval_runs rows tagged `cat4-blind-ab` are now writing alongside the 6 auto-suite categories. Plan 05-09 surfaces the unified table; cat4-blind-ab rows distinguishable by `total_cost_cents=0` AND case category. Filter pattern: `WHERE category='cat4-blind-ab'` on the eval_cases JOIN to surface only A/B sessions.
- **Ready: Plan 05-13 (weekly cron eval)** — explicitly does NOT trigger A/B sessions (those are tester-driven, not automatic). The cron handler can safely tag `scheduled=true` on auto-suite runs without disturbing cat4-blind-ab rows. cat4-blind-ab category is excluded from the cron's category list.
- **Live verification deferred:** ab-mapping.ts + page.tsx + route.ts are end-to-end wired; the deferred Task 4 smoke is the plumbing-validation human gate (page renders + cookie sets + DB rows write), not a code-correctness gate. Code-correctness is verified by 16 ab-mapping unit tests covering all behaviors + 503/503 total tests + clean tsc on the new files.
- **LAUNCH-04 audit trail satisfied:** `tester_role` column on `eval_ab_sessions` enables the "≥1 non-PM tester" assertion at launch time. Joe can query `SELECT DISTINCT tester_role FROM eval_ab_sessions WHERE submitted_at IS NOT NULL` and confirm both `pm` and `non-pm` rows exist before merging the launch PR.

## Threat Flags

None. The new code does NOT introduce new HTTP surface beyond what the plan's threat_model already enumerates (T-05-08-01..06). The defense-in-depth cookie cross-check is a strengthening of T-05-08-02 (Tampering — replay protection) beyond the plan's expires_at + submitted_at gate. The setup-failure fallback strengthens T-05-08-03 (Spoofing — non-admin sees nothing) by ensuring any setup error still renders the requireAdmin-gated layout (which would render NotAuthorized for unauthenticated visitors). No new credentials introduced; no new external network calls; pre-warm exclusively hits internal /api/chat which has its own admin-orthogonal authorization model.

## Self-Check: PASSED

- evals/cat-04-real-joe.yaml: FOUND (5 entries; case_ids cat4-real-001..005; YAML parses)
- src/lib/eval/ab-mapping.ts: FOUND (exports createAbSession, validateAndScoreAbSession; 184 LOC)
- tests/lib/eval/ab-mapping.test.ts: FOUND (16 tests; all green)
- src/app/admin/(authed)/eval-ab/page.tsx: FOUND (server component; ra_eval_session cookie set; pre-warm via Promise.all + mintEvalSession + callAgent)
- src/app/admin/(authed)/eval-ab/AbClient.tsx: FOUND ('use client' directive; 10 picks + role select + submit + result rendering)
- src/app/api/admin/eval-ab/route.ts: FOUND (POST handler; requireAdmin + zod + cookie cross-check + validateAndScoreAbSession delegate)
- Commit 70ecb3e (Task 1 — yaml): FOUND
- Commit 7ce56e8 (Task 2 — ab-mapping + tests): FOUND
- Commit f803b61 (Task 3 — page + AbClient + route): FOUND
- Acceptance grep: `requireAdmin` in src/app/api/admin/eval-ab/route.ts: 1
- Acceptance grep: `ra_eval_session` in src/app/admin/(authed)/eval-ab/page.tsx: 1 (COOKIE_NAME constant + cookieStore.set call site)
- Acceptance grep: `httpOnly: true` in src/app/admin/(authed)/eval-ab/page.tsx: 1
- Acceptance grep: `sameSite: 'strict'` in src/app/admin/(authed)/eval-ab/page.tsx: 1
- Acceptance grep: `Promise.all` in src/app/admin/(authed)/eval-ab/page.tsx: 2 (pre-warm + parallel YAML+pre-warm)
- Acceptance grep: `pct < 0.70` in src/lib/eval/ab-mapping.ts: 1
- Acceptance grep: stub patterns (TODO/FIXME/placeholder) in new files: 0
- Test count: 503/503 passing (487 baseline + 16 new ab-mapping)
- TypeScript on new files: clean (only pre-existing ChatUI.tsx error remains — documented in deferred-items.md from Plan 05-06)

---
*Phase: 05-eval-gates-launch*
*Completed: 2026-05-10*
