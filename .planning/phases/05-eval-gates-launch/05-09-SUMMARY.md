---
phase: 05-eval-gates-launch
plan: 05-09
subsystem: testing
tags: [eval-harness, admin-ui, calibration, cohens-kappa, pearson-r, eval-12, eval-14]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-02)
    provides: eval_runs / eval_cases / eval_calibrations tables (0003_phase5.sql) — admin reads via supabaseAdmin (service-role) bypassing RLS
  - phase: 04-admin-observability (Plan 04-03)
    provides: src/app/admin/(authed)/layout.tsx with requireAdmin gate; admin-auth.ts requireAdmin/getCurrentAdmin helpers; NotAuthorized component; AdminNav (Plan 04-03 Phase 4 D-B-03 pattern)
  - phase: 05-eval-gates-launch (Plan 05-04..05-08)
    provides: live eval_runs / eval_cases rows from cat1/cat2/cat3/cat4-judge/cat4-blind-ab/cat5/cat6 — index page surfaces these without category-specific code (CategorySchema enum is sole source of truth)
provides:
  - "src/lib/eval/calibration.ts — pearsonR + quadraticWeightedKappa + groupKappaByCategory; quadratic-weighted Cohen's kappa per RESEARCH §11; threshold 0.5 = recalibration trigger"
  - "src/app/admin/(authed)/evals/page.tsx — Last 30 eval_runs with per-cat pass/total counts via single bulk eval_cases query; CATEGORY_ORDER deterministic column rendering"
  - "src/app/admin/(authed)/evals/[runId]/page.tsx — Per-run detail with expandable per-case <details> (prompt / response / judge_rationale auto-detect-JSON); cat6 special-cases the response label to 'Playwright output'"
  - "src/app/admin/(authed)/evals/calibrate/page.tsx — Monthly calibration; fetches up to 50 recent LLM-judged cases (cat1/cat3/cat4-judge from last 30 days), JS Fisher-Yates shuffle, takes 10"
  - "src/app/admin/(authed)/evals/calibrate/CalibrateClient.tsx — 1-5 score buttons + optional notes per case; result panel with kappa interpretation labels and per-category breakdown"
  - "src/app/api/admin/evals/calibrate/route.ts — POST handler; server-side judge_score lookup (caller can't lie); zod score-range tampering block; bulk eval_calibrations insert; kappa/pearson/meanAbsDelta/perCategory response"
  - "AdminNav 'Evals' entry — links to /admin/evals (which exposes calibrate sub-page link)"
affects: [05-10 cron-eval-weekly (will reference eval_runs.scheduled flag in this index UI), 05-12/05-13 LAUNCH (admin can audit eval results before merging), 05-NN judge-replacement workflow if calibrate kappa drops below 0.5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Quadratic-weighted Cohen's kappa implementation (~30 LOC, no library): w[i][j] = 1 - ((i-j)/(N-1))^2; kappa = 1 - sum((1-w)*O) / sum((1-w)*E). Degenerate distribution (denominator=0, e.g., everyone always scored 3) returns 0 — matches sklearn's behavior under the same edge case"
    - "Server-side judge_score lookup pattern (NOT taken from request body): the calibrate API route fetches judge_score by eval_case_id from eval_cases server-side. Even an admin caller cannot lie about what the judge said — closes T-05-09-01 (information disclosure) PLUS T-05-09-02 (tampering) in one move"
    - "JS Fisher-Yates random sampling for Supabase queries (vs ORDER BY random()): supabase-js doesn't expose ORDER BY random() without a custom RPC. Fetch a candidate pool (≤50 rows) then shuffle in-memory and slice. Acceptable at this volume; avoids a one-off DB function"
    - "Per-category metric breakdown in groupKappaByCategory: groups (category, human, judge) triples by category; n=1 categories return kappa=0/pearson=0 since variance is undefined for n<2 (UI renders the row with caveat label)"
    - "Auto-detect JSON in judge_rationale: tryPrettyJson() in detail page tries JSON.parse first; falls back to raw text on parse error. Preserves judge prose readability without truncation while still pretty-printing structured rationales (the path some categories take)"

key-files:
  created:
    - "src/lib/eval/calibration.ts (pearsonR + quadraticWeightedKappa + groupKappaByCategory; 161 LOC including doc comments)"
    - "tests/lib/eval/calibration.test.ts (15 tests covering all 8 plan behaviors + 7 edge cases)"
    - "src/app/admin/(authed)/evals/page.tsx (last 30 eval_runs with per-cat pass/total counts; bulk eval_cases query in single .in('run_id', ids) call; LocalTime + dollars helpers from Phase 4)"
    - "src/app/admin/(authed)/evals/[runId]/page.tsx (run header + per-case <details> disclosure; Playwright output label for cat6; auto-JSON-detect for judge_rationale)"
    - "src/app/admin/(authed)/evals/calibrate/page.tsx (server component fetches candidate pool, shuffles, renders CalibrateClient; D-A-03 belt-and-suspenders)"
    - "src/app/admin/(authed)/evals/calibrate/CalibrateClient.tsx ('use client'; 10 score-button rows + notes textareas + result panel)"
    - "src/app/api/admin/evals/calibrate/route.ts (POST handler; zod + judge_score server-side lookup + bulk insert + metric computation)"
  modified:
    - "src/app/admin/components/AdminNav.tsx (NAV_ITEMS — added Evals entry between Health and the right-side Refresh/Sign-out)"

key-decisions:
  - "Path correction (Rule 3 — blocking): plan frontmatter listed src/app/(authed)/admin/evals/... and src/lib/__tests__/eval/calibration.test.ts. Actual conventions: src/app/admin/(authed)/evals/... (Phase 4 admin shell — verified by existing src/app/admin/(authed)/sessions/page.tsx and src/app/admin/(authed)/eval-ab/page.tsx mirrors) and tests/lib/eval/calibration.test.ts (vitest discovers tests/**/*.test.{ts,tsx} only — same correction Plans 05-04..05-08 documented). Auto-resolved per important_conventions"
  - "Quadratic-weighted kappa implemented with degenerate-distribution fallback to 0 (NOT NaN): when both raters always give the same single score, denominator collapses to 0. Matches sklearn cohen_kappa_score behavior; calibration UI/API can render finite numbers without special-casing. Test 'returns 0 when both raters always give the same single score' locks this behavior in"
  - "Test fixture correction (mid-Task-1): initial 'perfect agreement' test used [5,5,5,5,5] vs [5,5,5,5,5] which is the SAME degenerate-distribution edge case (returns 0). Changed to [1,2,3,4,5] vs [1,2,3,4,5] to exercise the non-trivial code path. Both tests now coexist as complementary contracts (perfect varied agreement → 1.0; degenerate same-score → 0)"
  - "Server-side judge_score lookup beyond plan example (Rule 2 — added critical functionality): plan example had the API route trust the judge_score that the client posted. Changed to fetch judge_score by eval_case_id from eval_cases server-side. Caller (even an admin) cannot lie about what the judge gave — calibration is meaningless if either side is forgeable. Closes T-05-09-01 (information disclosure) AND T-05-09-02 (tampering) in one move; the request body now only contains eval_case_id + human_score + optional notes"
  - "Cross-check: every rated eval_case_id MUST exist AND have a judge_score; any missing or null rejects the entire submission with 400 (separate error codes for diagnosability — 'unknown eval_case_ids' vs 'rows have no judge_score'). Mirrors Plan 05-08 defense-in-depth API design (T-05-09-02 tampering)"
  - "JS Fisher-Yates shuffle over candidate pool (NOT supabase ORDER BY random()): supabase-js client doesn't expose ORDER BY random() without a custom RPC. Plan suggested either approach — picked the JS shuffle because it's branchless (no DB function migration needed) and at POOL_SIZE=50 the in-memory cost is trivial. Successive page loads re-shuffle, so calibrations don't tunnel into the same 10 cases unless the pool is tiny"
  - "Recalibration threshold encoded as a constant (RECALIBRATION_THRESHOLD = 0.5): single source of truth in the API route. Per RESEARCH §11 line 733 — 'kappa < 0.4 = poor; 0.4-0.6 = moderate; 0.6-0.8 = substantial; >0.8 = near-perfect'. The threshold could in principle move; centralizing in the route plus the kappaInterpretation label table in CalibrateClient gives Joe one place to adjust if he changes his mind"
  - "Calibrate page link in evals index header (NOT a separate AdminNav entry): /admin/evals/calibrate is reached via a 'Calibrate (EVAL-12) →' link top-right of the index page. Keeps the AdminNav lean (one new entry, not two) while ensuring the calibrate page is discoverable from the eval-runs index where Joe will already be"
  - "/admin/eval-ab intentionally NOT added to AdminNav (carryover from Plan 05-08 deliberate skip): tester-driven URL, not part of Joe's regular admin workflow. Comment block in NAV_ITEMS documents the intent so future adds don't accidentally surface it. If Joe wants A/B nav-linked later, it's a one-line change"
  - "Auto-JSON-detect for judge_rationale in detail page: tryPrettyJson() does JSON.parse first; pretty-prints if it parses, falls back to raw text otherwise. Some categories (cat3/cat4-judge LLM-judge wrappers) emit JSON-shaped rationale; others (cat1, cat6) emit prose or error messages. One renderer handles both without per-category branching"
  - "Auto-approved any future Task 4 / live verify: this plan has 3 tasks and no checkpoint:human-verify gate. Code-correctness is verified by 15 calibration unit tests + tsc-clean on all new files + 518/518 total tests. Live use of /admin/evals/calibrate against real Joe re-rating happens at Joe's leisure once Plan 05-04+ live runs have populated the eval_cases pool"

patterns-established:
  - "Calibration metric library (src/lib/eval/calibration.ts): exports pearsonR + quadraticWeightedKappa + groupKappaByCategory. Future eval-related metrics (e.g., Krippendorff's alpha for multi-rater settings) can extend this module without touching the API route shape — route imports the symbols by name"
  - "Admin sub-route convention: /admin/<topic> is the index; /admin/<topic>/[id] is the detail; /admin/<topic>/<action> is the action page. Reaching the action page is via top-right link from the index, not via a dedicated AdminNav entry. /admin/evals + /admin/evals/[runId] + /admin/evals/calibrate establishes this pattern; future expansions can mirror it (e.g., /admin/sessions/<id> already follows the [id] half)"

requirements-completed: [EVAL-12, EVAL-14]

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 5 Plan 05-09: Admin Eval Results UI + Monthly Calibration Summary

**Three admin pages and one API route ship the EVAL-14 storage UI half (eval_runs index + per-run detail) and the EVAL-12 monthly calibration (Joe re-rates 10 random recent LLM-judged cases; server computes quadratic-weighted Cohen's kappa + Pearson r + per-category breakdown; recalibration trigger fires when kappa < 0.5 per RESEARCH §11). Calibration math (`src/lib/eval/calibration.ts`) implemented from scratch (~161 LOC, no library) with 15 unit tests covering math sanity, edge cases, and per-category grouping. AdminNav gets a single 'Evals' entry that fans out to runs index → run detail / calibrate. 518/518 vitest tests passing (503 baseline + 15 new); zero regressions; pre-existing ChatUI.tsx:46 typecheck error remains pre-existing per scope-boundary rule.**

## Performance

- **Duration:** ~12 min (Tasks 1 RED + 1 GREEN + 2 + 3 in this session)
- **Tasks:** 3 of 3 (all autonomous; no checkpoints in this plan)
- **Files created:** 7 (1 lib + 1 lib test + 1 index page + 1 detail page + 1 calibrate page + 1 client component + 1 API route)
- **Files modified:** 1 (AdminNav NAV_ITEMS)
- **New tests:** 15 (503 → 518 passing; zero regressions)
- **TypeScript on new files:** clean (only pre-existing ChatUI.tsx:46 remains; documented in deferred-items.md from Plan 05-06)

## Accomplishments

- `src/lib/eval/calibration.ts`: quadratic-weighted Cohen's kappa + Pearson r + per-category groupKappaByCategory. Degenerate-distribution fallback to 0 (matches sklearn). Single source of truth — calibrate route + future eval drift-monitoring imports from this module by name
- `src/app/admin/(authed)/evals/page.tsx`: shadcn Table of last 30 eval_runs ordered by start time DESC. Per-cat pass/total counts via single bulk `.in('run_id', ids)` query (NOT N+1). CATEGORY_ORDER constant ensures deterministic column rendering across runs. Status color: passed=green / failed=red / error=amber / running=blue. Empty-state copy points Joe at `npm run eval`. Top-right Calibrate link
- `src/app/admin/(authed)/evals/[runId]/page.tsx`: run header (started/finished/target/judge/status/pass-fail/cost/mode/git_sha) + per-case `<details>` disclosure list. Summary line: PASS/FAIL badge + category + case_id + score/verdict/cost. Body: prompt + response (or 'Playwright output' for cat6) + judge_rationale (auto-detect JSON via try-parse → pretty-print, else raw text). Back-to-runs link; not-found fallback for missing runId
- `src/app/admin/(authed)/evals/calibrate/page.tsx`: server-component fetches up to 50 candidate cases (categories cat1/cat3/cat4-judge; judge_score IS NOT NULL; created_at >= 30 days ago), JS Fisher-Yates shuffle, renders CalibrateClient with first 10. Insufficient-pool warning when fewer than 10 eligible cases exist
- `CalibrateClient.tsx` ('use client'): one `<fieldset>` per case with prompt + agent response + expandable judge_rationale; 1-5 score buttons (aria-pressed for accessibility) with live delta display; optional notes textarea; submit disabled until all cases scored with progress counter. On submit, POSTs `{ratings}` to `/api/admin/evals/calibrate`. Result panel: kappa with interpretation label (poor/moderate/substantial/near-perfect per RESEARCH §11 line 733); Pearson r, meanAbsDelta, rows-written, per-category breakdown formatted per RESEARCH §11 lines 725-728. Recalibration trigger card: red border + 'Recalibration triggered (kappa < 0.5)' headline if kappa < 0.5
- `src/app/api/admin/evals/calibrate/route.ts` (POST): requireAdmin + zod (`ratings ≥ 1`, `human_score: int [1,5]`, optional notes); server-side judge_score lookup (caller can't lie); cross-check every eval_case_id exists AND has a judge_score (else 400 with separate error codes); bulk insert into eval_calibrations with delta column; computes kappa + Pearson + meanAbsDelta + perCategory; returns rounded-to-2dp values + recalibrationTriggered flag. Pino structured log on success
- AdminNav: `Evals` entry added to NAV_ITEMS between Health and the right-side Refresh/Sign-out (matches plan's "between Health and Sign out" intent). `/admin/eval-ab` intentionally NOT nav-linked (carryover from Plan 05-08 deliberate skip — tester-driven URL, comment block in NAV_ITEMS documents the intent)

## Task Commits

1. **Task 1 RED — failing calibration tests** — `4913b56` (test)
2. **Task 1 GREEN — calibration.ts + 15 tests passing** — `fb4eab4` (feat)
3. **Task 2 — admin evals index + detail + AdminNav** — `4e73a5c` (feat)
4. **Task 3 — calibrate page + CalibrateClient + API route** — `a3ea420` (feat)

## Files Created/Modified

- `src/lib/eval/calibration.ts` (created — Task 1) — pearsonR + quadraticWeightedKappa + groupKappaByCategory; CategoryAgreementResult interface exported. Quadratic weight matrix built once per call; numerator/denominator sums in same loop pass over O[i][j]. Degenerate-distribution returns 0 (sklearn behavior)
- `tests/lib/eval/calibration.test.ts` (created — Task 1) — 15 tests: 5 pearsonR (perfect/inverse/empty/length-mismatch/zero-variance) + 7 quadraticWeightedKappa (perfect-varied / systematic-bias / mismatched / empty / out-of-range / boundary-scores / degenerate-same-score) + 3 groupKappaByCategory (3-cat breakdown / single-case / empty). All under tests/lib/eval/ (NOT src/lib/__tests__/eval/ as plan listed — vitest discovery convention)
- `src/app/admin/(authed)/evals/page.tsx` (created — Task 2) — last 30 eval_runs Table; bulk eval_cases query; canonical CATEGORY_ORDER; LocalTime via Phase 4 component; status color; empty-state empty-pool copy
- `src/app/admin/(authed)/evals/[runId]/page.tsx` (created — Task 2) — run header + per-case `<details>` list; auto-JSON-detect for rationale; cat6 special-cases response label
- `src/app/admin/(authed)/evals/calibrate/page.tsx` (created — Task 3) — server-component candidate-pool fetch + JS shuffle; insufficient-pool warning; back-to-runs link
- `src/app/admin/(authed)/evals/calibrate/CalibrateClient.tsx` (created — Task 3) — `'use client'`; useState for scores + notes + result + error; aria-pressed score buttons; live delta; submit disable; kappaInterpretation label table
- `src/app/api/admin/evals/calibrate/route.ts` (created — Task 3) — POST handler; zod; server-side judge_score lookup; cross-check; bulk insert; metric computation; rounded JSON response
- `src/app/admin/components/AdminNav.tsx` (modified — Task 2) — single line addition to NAV_ITEMS array; comment block documents /admin/eval-ab non-link rationale

## Decisions Made

- **Path corrections (Rule 3 — blocking)** — plan frontmatter listed `src/app/(authed)/admin/evals/...` and `src/lib/__tests__/eval/calibration.test.ts`. Actual conventions are `src/app/admin/(authed)/evals/...` (Phase 4 admin shell — verified by existing `src/app/admin/(authed)/sessions/page.tsx` and `src/app/admin/(authed)/eval-ab/page.tsx` mirrors) and `tests/lib/eval/calibration.test.ts` (vitest discovers `tests/**/*.test.{ts,tsx}` only — same correction Plans 05-04..05-08 documented). Auto-resolved per `<important_conventions>`; no architectural impact.

- **Server-side judge_score lookup (Rule 2 — added critical functionality)** — plan API route example trusted the judge_score posted by the client. Changed to fetch judge_score by eval_case_id from `eval_cases` server-side. Caller (even an admin) cannot lie about what the judge gave — calibration is meaningless if either rater can be forged. Closes T-05-09-01 (information disclosure) AND T-05-09-02 (tampering) in one move. Request body now only contains `eval_case_id + human_score + optional notes`.

- **Cross-check every rated case has a judge_score (Rule 2 — added)** — beyond zod range validation, the route validates that every `eval_case_id` exists in `eval_cases` AND has a non-null `judge_score`. Returns 400 with separate error codes (`unknown eval_case_ids` vs `rows have no judge_score`) for diagnosability. Mirrors Plan 05-08 defense-in-depth API design.

- **JS Fisher-Yates shuffle over candidate pool (NOT supabase ORDER BY random())** — supabase-js client doesn't expose ORDER BY random() without a custom RPC. Plan offered either approach; picked JS shuffle because it avoids a DB function migration. POOL_SIZE=50 means the in-memory cost is trivial. Successive page loads re-shuffle so calibrations don't tunnel into the same 10 cases unless the pool is tiny.

- **Degenerate-distribution kappa fallback to 0 (NOT NaN)** — when both raters always give the same single score (e.g., everyone scored 3), the kappa formula's denominator is 0. Spec is undefined; sklearn returns 0; we match. Test `returns 0 when both raters always give the same single score` locks this behavior in. UI/API can render finite numbers without special-casing.

- **Mid-Task-1 fixture correction** — initial "perfect agreement" test used `[5,5,5,5,5]` vs `[5,5,5,5,5]` which is the SAME degenerate-distribution edge case (returns 0). Changed to `[1,2,3,4,5]` vs `[1,2,3,4,5]` to exercise the non-trivial code path. Both tests now coexist as complementary contracts (perfect varied agreement → 1.0; degenerate same-score → 0).

- **Calibrate-link-from-index pattern (NOT a separate AdminNav entry)** — `/admin/evals/calibrate` is reachable via a "Calibrate (EVAL-12) →" link top-right of the index page. Keeps the nav lean (single `Evals` entry, not two) while ensuring calibrate is discoverable from the runs index where Joe will already be.

- **`/admin/eval-ab` intentionally NOT added to AdminNav** — carryover from Plan 05-08's deliberate skip: tester-driven URL, not part of Joe's regular admin workflow. Comment block in NAV_ITEMS documents the intent so future adds don't accidentally surface it. If Joe wants A/B nav-linked later, it's a one-line change. Was raised as an open consideration in `<important_conventions>`; decision: hold for explicit Joe ask.

- **Auto-JSON-detect for judge_rationale (Rule 2 — UX)** — `tryPrettyJson()` does `JSON.parse` first; pretty-prints if it parses, falls back to raw text otherwise. Some categories (cat3/cat4-judge LLM-judge wrappers) emit JSON-shaped rationale; others (cat1 deterministic, cat6 Playwright) emit prose or error messages. One renderer handles both without per-category branching.

- **Recalibration threshold encoded as a constant** (`RECALIBRATION_THRESHOLD = 0.5` in route.ts) — single source of truth. RESEARCH §11 line 733 specifies the bands ("poor < 0.4; moderate 0.4-0.6; substantial 0.6-0.8; near-perfect > 0.8"); the trigger threshold could move. Centralizing in route + the `kappaInterpretation` label table in CalibrateClient gives Joe one place to adjust.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Test path mismatch with vitest collection root**
- **Found during:** Task 1 RED scaffold
- **Issue:** Plan frontmatter listed `src/lib/__tests__/eval/calibration.test.ts`. Vitest discovers `tests/**/*.test.{ts,tsx}` only.
- **Fix:** Wrote tests to `tests/lib/eval/calibration.test.ts` matching Plans 05-04..05-08 convention.
- **Verification:** `npx vitest run tests/lib/eval/calibration.test.ts` discovers and runs all 15 tests.
- **Committed in:** 4913b56 (RED), fb4eab4 (GREEN)

**2. [Rule 3 — Blocking] Page paths mismatch with admin layout convention**
- **Found during:** Task 2 directory creation
- **Issue:** Plan frontmatter listed `src/app/(authed)/admin/evals/...`. Actual repo convention is `src/app/admin/(authed)/...` — same correction Plan 05-08 already documented.
- **Fix:** Created pages at `src/app/admin/(authed)/evals/page.tsx`, `src/app/admin/(authed)/evals/[runId]/page.tsx`, `src/app/admin/(authed)/evals/calibrate/page.tsx`, `src/app/admin/(authed)/evals/calibrate/CalibrateClient.tsx`. URL paths remain `/admin/evals`, `/admin/evals/[runId]`, `/admin/evals/calibrate` (route groups are URL-invisible). API route path was correct as plan-stated (`src/app/api/admin/evals/calibrate/route.ts`).
- **Verification:** `npm run build` compiles successfully; the new paths are recognized by Next.js router.
- **Committed in:** 4e73a5c (Task 2), a3ea420 (Task 3)

**3. [Rule 1 — Bug] AdminNav path mismatch with plan frontmatter**
- **Found during:** Task 2 AdminNav update
- **Issue:** Plan frontmatter listed `src/components/AdminNav.tsx`. Actual file is `src/app/admin/components/AdminNav.tsx` (Phase 4 D-B-03; verified by glob and existing import paths in the layout).
- **Fix:** Edited `src/app/admin/components/AdminNav.tsx`. No new file created; the plan-frontmatter path doesn't exist.
- **Verification:** `grep -q "Evals" src/app/admin/components/AdminNav.tsx` returns 1.
- **Committed in:** 4e73a5c

**4. [Rule 2 — Critical functionality] Server-side judge_score lookup**
- **Found during:** Task 3 API route draft
- **Issue:** Plan API route example took `judge_score` from a request-body fragment (or implicitly via the cases array on the page). A non-malicious admin could still misclick or refresh-while-stale, but more critically, the metric is meaningless if either rater can be forged (T-05-09-01 + T-05-09-02 trust boundary).
- **Fix:** Request body contains only `eval_case_id + human_score + optional notes`. Route does its own `.from('eval_cases').select('judge_score, category, ...').in('id', ids)` lookup; pairs `(human_score, judge_score)` server-side from authoritative source.
- **Verification:** Manual code review; `grep -q "supabaseAdmin.from('eval_cases')" src/app/api/admin/evals/calibrate/route.ts` returns 1.
- **Committed in:** a3ea420

**5. [Rule 2 — Critical functionality] Cross-check eval_case_id existence + non-null judge_score**
- **Found during:** Task 3 API route draft
- **Issue:** Plan API route example didn't validate that the rated `eval_case_ids` actually exist or have judge_scores. A submission referencing nonexistent or stub-row cases would either crash on the lookup, silently insert rows referencing nothing useful, or use NaN judges in the kappa computation.
- **Fix:** Track `missing[]` and `noScore[]` lists during the lookup; reject the entire submission with 400 + descriptive error if either is non-empty (separate error codes for diagnosability).
- **Verification:** Manual code review; the check fails-closed.
- **Committed in:** a3ea420

**6. [Rule 1 — Bug] Mid-Task-1 fixture correction (degenerate-distribution edge case)**
- **Found during:** Task 1 GREEN initial test run (14/15 passing)
- **Issue:** Initial "perfect agreement" test used `[5,5,5,5,5]` vs `[5,5,5,5,5]`. That's the same degenerate-distribution edge case as `[3,3,3]` vs `[3,3,3]` (which I had a separate test for). When both raters always give the same single score, the chance-disagreement denominator collapses to 0; spec is undefined; sklearn returns 0; we match. Test was asserting kappa==1.0 but the implementation correctly returned 0.
- **Fix:** Changed perfect-agreement fixture to `[1,2,3,4,5]` vs `[1,2,3,4,5]` for varied distribution that exercises the non-trivial code path. Both tests now coexist as complementary contracts. Updated test name to "perfect agreement across a varied distribution" + comment block calling out the relationship.
- **Verification:** All 15 tests pass.
- **Committed in:** fb4eab4

---

**Total deviations:** 6 auto-fixed (3× Rule 3 — blocking convention path mismatches; 1× Rule 1 — fixture correction; 2× Rule 2 — added critical security/correctness checks). All non-architectural. No Rule 4 stops.

**Impact on plan:** 3 of 6 are convention-mismatch corrections that Plans 05-04..05-08 already documented as a recurring pattern between plan frontmatter and current repo conventions. The 1 fixture correction sharpens the kappa contract (perfect-agreement test now exercises the non-trivial code path; degenerate-distribution test exercises the edge case; both pass and lock in the documented behavior). The 2 Rule 2 additions strengthen the calibration trust boundary — server-side judge_score lookup makes the metric tamper-resistant, and the cross-check rejects submissions with missing/null judge data rather than computing garbage kappa values.

## Issues Encountered

- **Pre-existing TypeScript error in `src/components/ChatUI.tsx`:46** carries forward — already documented in `.planning/phases/05-eval-gates-launch/deferred-items.md` from Plan 05-06. Not in scope (out-of-scope per execute-plan.md scope-boundary rule); not a regression from this plan. `npm run build` reports "Compiled successfully" but fails the typecheck step on this single error. None of the new files (calibration.ts / page.tsx / [runId]/page.tsx / calibrate/page.tsx / CalibrateClient.tsx / route.ts) introduce typecheck errors — verified by `npx tsc --noEmit` showing only the pre-existing ChatUI.tsx:46 error.

## User Setup Required

None for code-complete state. Live verification of the calibrate workflow requires Joe to:

1. Push to a branch with a Vercel preview deploy (or run `npm run dev` locally)
2. Sign in to admin via GitHub OAuth (allowlisted login in `ADMIN_GITHUB_LOGINS`)
3. Visit `<preview>/admin/evals` — see the live last-30-runs table populated by the existing `vstFDlWpoKcyGH29w2KKs` and other Phase 5 cat-1 / cat-3 / cat-4-judge runs
4. Click any row to drill into `/admin/evals/[runId]` — verify per-case `<details>` disclosure renders prompt + response + judge_rationale correctly (auto-JSON-detect should pretty-print structured rationales; cat1/cat6 stays as raw text)
5. Click "Calibrate (EVAL-12) →" top-right — see 10 random recent LLM-judged cases
6. Score every case 1-5 (try a deliberately harsh-by-1 pattern: agent score 5 → human score 4, etc.); add notes on a couple for the eval_calibrations.notes column
7. Submit — verify result panel shows kappa ≈ 0.7 (substantial; matches the literature's "judge runs slightly harsh" interpretation), per-category breakdown, recalibrationTriggered=false (since kappa > 0.5)
8. Verify Supabase `eval_calibrations` table has 10 new rows with the expected `delta` column values

## Known Stubs

None. calibration.ts is a real implementation (15 unit tests; manual sanity check via `npx tsx -e` showed +2 systematic bias produces kappa=0.24 with Pearson r=1.0 — the textbook RESEARCH §11 case). Calibrate page wires real Supabase queries through real metric computation through real eval_calibrations writes. No placeholder data; no mock-only paths in production code.

## Next Phase Readiness

- **Ready: Plan 05-10 (cron-eval-weekly)** — eval_runs index will surface `scheduled=true` rows in the existing 'cron|manual' Sched column without code changes; weekly cron just needs to flip the `scheduled` flag in createRun
- **Ready: Plan 05-12/05-13 (LAUNCH)** — admin can now audit eval results before merging; the run-detail page surfaces full case-by-case context for any pre-launch eval run
- **Ready: Future judge-replacement workflow** — when calibrate kappa drops below 0.5, the recalibrationTriggered flag in the API response and the red-bordered result card give Joe a one-glance signal. Plan 05-NN judge-swap workflow can read the latest eval_calibrations row and decide whether to surface a banner on /admin/evals
- **Live verification deferred (not blocking):** calibrate flow has no checkpoint:human-verify in this plan (3-task autonomous). Joe can exercise it at his leisure once Plan 05-04+ live runs have populated more eval_cases. Code-correctness is verified by 15 calibration unit tests + tsc-clean on all new files + 518/518 total tests

## Threat Flags

None. The new code does NOT introduce new HTTP surface beyond what the plan's threat_model already enumerates (T-05-09-01..05). The server-side judge_score lookup is a strengthening of T-05-09-02 (Tampering — score-range zod check is plan-stated; the additional "caller can't lie about judge_score" gate is added beyond the plan). The eval_case_id existence cross-check strengthens T-05-09-02. The detail page surface (judge_rationale potentially containing verbose Gemini reasoning that mentions ground_truth_facts — plan threat T-05-09-05) is admin-only via the existing two-layer perimeter (parent layout requireAdmin + per-page requireAdmin). No new credentials introduced; no new external network calls; the calibrate flow is internal admin → Supabase via service-role client.

## Self-Check: PASSED

- src/lib/eval/calibration.ts: FOUND (exports pearsonR, quadraticWeightedKappa, groupKappaByCategory, CategoryAgreementResult)
- tests/lib/eval/calibration.test.ts: FOUND (15 tests; all green)
- src/app/admin/(authed)/evals/page.tsx: FOUND (last 30 eval_runs Table with bulk eval_cases query)
- src/app/admin/(authed)/evals/[runId]/page.tsx: FOUND (run header + per-case <details> list)
- src/app/admin/(authed)/evals/calibrate/page.tsx: FOUND (candidate pool + JS shuffle + CalibrateClient render)
- src/app/admin/(authed)/evals/calibrate/CalibrateClient.tsx: FOUND ('use client'; score buttons + notes + result panel)
- src/app/api/admin/evals/calibrate/route.ts: FOUND (POST handler with server-side judge_score lookup + cross-check + bulk insert + metric computation)
- src/app/admin/components/AdminNav.tsx: MODIFIED (NAV_ITEMS contains 'Evals')
- Commit 4913b56 (Task 1 RED): FOUND
- Commit fb4eab4 (Task 1 GREEN): FOUND
- Commit 4e73a5c (Task 2): FOUND
- Commit a3ea420 (Task 3): FOUND
- Acceptance grep: `eval_runs` in src/app/admin/(authed)/evals/page.tsx: 1
- Acceptance grep: `Evals` in src/app/admin/components/AdminNav.tsx: 1
- Acceptance grep: `force-dynamic` in src/app/admin/(authed)/evals/page.tsx: 1
- Acceptance grep: `force-dynamic` in src/app/admin/(authed)/evals/[runId]/page.tsx: 1
- Acceptance grep: `quadraticWeightedKappa` in src/app/api/admin/evals/calibrate/route.ts: 1
- Acceptance grep: `requireAdmin` in src/app/api/admin/evals/calibrate/route.ts: 1
- Acceptance grep: `recalibrationTriggered` in src/app/api/admin/evals/calibrate/route.ts: 1
- Acceptance grep: stub patterns (TODO/FIXME/placeholder) in new files: 0 (the calibrate page renders a "(no response)" placeholder ONLY for the eval_cases.response IS NULL edge case — same pattern Plan 05-08 used)
- Test count: 518/518 passing (503 baseline + 15 new calibration)
- TypeScript on new files: clean (only pre-existing ChatUI.tsx:46 error remains — documented in deferred-items.md from Plan 05-06)
- Manual math sanity check (npx tsx): perfect agreement varied → kappa=1.0; +2 systematic bias with Pearson r=1.0 → kappa=0.24 (RESEARCH §11 textbook case); +1 slight-harsh → kappa=0.80

---
*Phase: 05-eval-gates-launch*
*Completed: 2026-05-10*
