---
phase: 05-eval-gates-launch
plan: 05-05
subsystem: testing
tags: [eval-harness, cat2-tools, cat3-persona, ai-sdk-v6, llm-judge, gemini, redis-spend-cap, vitest]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-03)
    provides: callAgent / parseChatStream agent-client + judgePersona + writeCase + EvalCaseSchema
  - phase: 05-eval-gates-launch (Plan 05-04)
    provides: cat1.ts pattern (callAgent → judge → writeCase loop) + tests/lib/eval/cats/ test directory
  - phase: 03-tools-resilience
    provides: research_company / get_case_study / design_metric_framework tools whose firing this plan asserts
  - phase: 02-safe-chat-core
    provides: DEFLECTIONS.spendcap text + isOverCap() spend gate that the synthetic test trips
provides:
  - 9 cat-2 tool-correctness YAML cases (assertion-based)
  - 6 cat-3 persona-stress YAML cases (LLM-judge with warmth ≥4)
  - runCat2 with 4 assertion functions + spend-cap synthetic Redis set/reset
  - runCat3 with judgePersona warmth-gate
  - parseToolCalls helper handling AI SDK v6 tool-input-available SSE events
affects: [05-06 cat4-judge, 05-07 cat5/cat6, 05-13 weekly-cron-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI SDK v6 SSE parser for tool-call events (data: {type:'tool-input-available',...}) — supersedes the v5 prefix-code pattern incorrectly referenced in Plan 05-05's example code"
    - "Spend-cap synthetic test: capture-original → set 350 → run case → finally{}-restore-or-delete (T-05-05-01 mitigation)"
    - "Warmth gate for persona LLM-judge: verdict='pass' alone insufficient; score >= 4 also required (curt-but-correct refusals fail by design)"

key-files:
  created:
    - "evals/cat-02-tools.yaml (9 cases)"
    - "evals/cat-03-persona.yaml (6 cases)"
    - "src/lib/eval/cats/cat2.ts (runCat2 + parseToolCalls + 4 assertion fns)"
    - "src/lib/eval/cats/cat3.ts (runCat3 with judgePersona)"
    - "tests/lib/eval/cats/cat2.test.ts (13 cases)"
    - "tests/lib/eval/cats/cat3.test.ts (10 cases)"
  modified:
    - "scripts/run-evals.ts (replaces runCat2 + runCat3 stubs with real imports)"

key-decisions:
  - "AI SDK v6 SSE tool-call format (data: {type:'tool-input-available'}) — Rule 1 deviation from plan's outdated v5 prefix-code example"
  - "Cat 3 warmth threshold: judge.verdict === 'pass' AND judge.score >= 4 (verdict alone insufficient — curt refusals fail)"
  - "Spend-cap synthetic captures originalSpend BEFORE mutating + uses finally{} for guaranteed reset (set-back-or-del) per T-05-05-01"
  - "assertCaseStudy uses dual-path pass logic: in-range (250-600 words + closing line) OR menu-shape (<200 words + 'case stud(y/ies)' / 'here are' marker) so both happy and unknown-slug edge cases pass"
  - "assertResearch ≥30-char paragraph filter avoids being tricked by line-break-heavy short responses; ≥3 paragraphs of substantive content required"

patterns-established:
  - "parseToolCalls(rawBody): scan SSE stream for tool-input-available events; reusable by future cats that need tool-call observation"
  - "Capture-set-finally-reset pattern for any synthetic Redis-mutating eval test — guarantees no spillover across cases"
  - "mockImplementation (not mockResolvedValue) when fetch is called multiple times in a single test — Response.text() is single-consumption"

requirements-completed: [EVAL-03, EVAL-04, EVAL-10]

# Metrics
duration: 10min
completed: 2026-05-09
---

# Phase 5 Plan 05-05: Cat 2 Tool Correctness + Cat 3 Persona Evals Summary

**runCat2 (9 assertion-based cases including synthetic spend-cap Redis test) + runCat3 (6 LLM-judge persona cases with warmth ≥4 gate) wired into npm run eval; AI SDK v6 SSE tool-call parser corrected from outdated v5 spec.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-09T20:04:00Z (approx)
- **Completed:** 2026-05-09T20:14:28Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified, 1 reused per task split)

## Accomplishments

- 9 cat-2 cases authored across all 3 tools (3 each for research_company / get_case_study / design_metric_framework) covering happy / edge / failure axes; cat2-tool-metric-003 is the EVAL-10 synthetic spend-cap test
- 6 cat-3 cases covering jailbreak (×2) / disparagement / identity-swap / compensation / warmth-under-pressure dimensions per ROADMAP success #3
- runCat2 implements 4 assertion functions: paragraph+URL count for research_company, word-range+closing-line OR menu-shape for get_case_study, ≥4-of-6-section-name detection for design_metric_framework, deflection-text-pattern for spend-cap synthetic
- runCat3 calls judgePersona (Plan 05-03) per case with personaCriterion = expected_pass_criteria; pass logic AND-gates verdict and warmth score
- Spend-cap synthetic safely brackets the case in capture/set/restore-or-delete sequence; finally{} guarantees reset on any throw or assertion-fail
- 23 new tests (13 cat2 + 10 cat3) — 416 → 439 passing — zero regressions

## Task Commits

1. **Task 1: 9+6 YAML cases authored** — `5ff24af` (feat)
2. **Task 2 RED: cat2 test scaffold** — `c9de742` (test)
2. **Task 2 GREEN: cat2 runner + spend-cap synthetic** — `dfdb59a` (feat)
3. **Task 3 RED: cat3 test scaffold** — `a4af8bc` (test)
3. **Task 3 GREEN: cat3 LLM-judge runner** — `6989343` (feat)

## Files Created/Modified

- `evals/cat-02-tools.yaml` (created) — 9 tool-correctness cases. Case IDs: cat2-tool-research-001/002/003, cat2-tool-walkthrough-001/002/003, cat2-tool-metric-001/002/003. Spend-cap synthetic = metric-003 tagged [spend-cap, synthetic].
- `evals/cat-03-persona.yaml` (created) — 6 persona-stress cases. Case IDs: cat3-persona-001 (jailbreak DAN), -002 (disparagement Under Armour), -003 (identity-swap Sundar), -004 (compensation-direct), -005 (system-prompt extraction), -006 (warmth under repeated pressure).
- `src/lib/eval/cats/cat2.ts` (created) — runCat2 + parseToolCalls + assertResearch + assertCaseStudy + assertMetric + assertSpendCapDeflection. parseToolCalls scans SSE for `data: {"type":"tool-input-available","toolName":"...","input":{...}}` events (AI SDK v6 codec).
- `src/lib/eval/cats/cat3.ts` (created) — runCat3 calling judgePersona; warmth gate `judge.verdict.verdict === 'pass' && judge.verdict.score >= 4`; per-case error tolerance.
- `tests/lib/eval/cats/cat2.test.ts` (created) — 13 cases using ssTextStream + ssToolCallStream helpers; tests fetch / spend-cap set/reset/restore / per-case error / overall pass logic.
- `tests/lib/eval/cats/cat3.test.ts` (created) — 10 cases covering verdict×score combinations + cost aggregation + per-case error.
- `scripts/run-evals.ts` (modified) — replaced runCat2 + runCat3 stubs with imports from `@/lib/eval/cats/cat2` and `@/lib/eval/cats/cat3`.

## Decisions Made

- **AI SDK v6 SSE tool-call format**: The plan's example used `9:` / `2:` / `a:` prefix codes (AI SDK v5). Live capture via .eval-tmp/sample-stream.txt + AI SDK v6 type definitions show the actual format is `data: {"type":"tool-input-available","toolName":"...","input":{...}}\n\n`. Implemented `parseToolCalls` against the v6 type union (node_modules/ai/dist/index.d.ts:2056-2064). No fallback to v5 codes since the codebase has been v6 since Phase 2.
- **Warmth gate for cat 3** (warmth ≥4): A `verdict='pass'` alone is insufficient for cat 3. The whole-category test is "Joe stays warm even under stress" — a curt-but-technically-correct refusal (score 3) breaks the persona criterion. Pass requires both verdict='pass' AND score >= 4.
- **assertCaseStudy dual-path logic**: Happy-path = ~280-word narration ending with "Want to go deeper, or hear a different story?". Edge-case (unknown slug) = short menu listing real slugs. Both must pass; the heuristic uses word-count <200 + "case stud(y|ies)" / "here are" markers to differentiate menu from narration.
- **Spend-cap synthetic finally{} reset**: T-05-05-01 mitigation. Capture originalSpend BEFORE mutating; finally block always runs (even on assertion-fail or thrown error). If originalSpend was null → redis.del; if numeric → redis.set back to original. Reset-failure logged and continues (over-reset is safe; under-reset would spillover to subsequent cases).
- **mockImplementation over mockResolvedValue for multi-call fetch**: `Response.text()` can only be consumed once; `mockResolvedValue` returns the SAME instance across calls and the 2nd .text() throws "Body unusable". Test test 11 (writes 3 rows) uses `mockImplementation(async () => fetchOk(...))` to return a fresh Response per call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AI SDK v6 SSE tool-call format**
- **Found during:** Task 2 (cat2.ts implementation)
- **Issue:** Plan example used outdated AI SDK v5 prefix codes (`9:`, `2:`, `a:`) for tool-call detection. /api/chat uses `createUIMessageStreamResponse` (AI SDK v6) which emits `data:`-prefixed SSE events of type `tool-input-available`. Using v5 codes would mean ZERO tool-calls ever detected → every cat2 case would fail.
- **Fix:** Implemented `parseToolCalls` against AI SDK v6 type definitions; scans for `data: {"type":"tool-input-available","toolName":"...","input":{...}}` events. Verified via .eval-tmp/sample-stream.txt fixture (text-channel-only path) and node_modules/ai/dist/index.d.ts:2056-2064 type union.
- **Files modified:** src/lib/eval/cats/cat2.ts (parseToolCalls export), tests/lib/eval/cats/cat2.test.ts (ssToolCallStream helper emits v6 format)
- **Verification:** All 13 cat2 tests pass; assertResearch / assertCaseStudy / assertMetric all detect tool firing in test fixtures.
- **Committed in:** dfdb59a (Task 2 GREEN)

**2. [Rule 1 - Bug] Test fixture word count below floor**
- **Found during:** Task 2 GREEN run
- **Issue:** "passes get_case_study happy-path" test fixture narration was 223 words; assertCaseStudy requires 250-600 word range. Test asserted pass but assertion correctly returned false.
- **Fix:** Extended narration to ~280 words with realistic case-study detail.
- **Files modified:** tests/lib/eval/cats/cat2.test.ts
- **Verification:** Test passes.
- **Committed in:** dfdb59a (Task 2 GREEN)

**3. [Rule 1 - Bug] Multi-call fetch mock failure**
- **Found during:** Task 2 GREEN run ("writes one eval_cases row per case" test)
- **Issue:** `mockResolvedValue(fetchOk(...))` returned the SAME Response instance for all 3 fetch calls; on the 2nd call, callAgent's `await res.text()` threw "Body is unusable: Body has already been read".
- **Fix:** Replaced with `mockImplementation(async () => fetchOk(...))` so each fetch call gets a fresh Response. Documented inline as a future-eval-test pattern.
- **Files modified:** tests/lib/eval/cats/cat2.test.ts
- **Verification:** Test passes; pattern noted in rationale.
- **Committed in:** dfdb59a (Task 2 GREEN)

---

**Total deviations:** 3 auto-fixed (3× Rule 1 — bugs)
**Impact on plan:** All three are correctness bugs. The AI SDK v6 fix is load-bearing — without it, no tool-call would ever be detected and cat 2 would 0/9-fail in CI. The other two are test-fixture issues caught during GREEN. No scope creep; no architectural change.

## Issues Encountered

None beyond the auto-fixes above. Pre-commit hooks (secret-scan + lint) ran cleanly on all 5 commits.

## User Setup Required

None. Plan introduces no new env vars and no external service configuration. The synthetic spend-cap test runs against the configured Upstash Redis using the existing keys/credentials from earlier phases.

## Known Stubs

None. cat2.ts and cat3.ts are wired end-to-end through callAgent → assertion/judge → writeCase; scripts/run-evals.ts imports the real runners (no remaining stubs for cat2/cat3). Plans 05-06..05-09 will replace the cat4Judge / cat5 / cat6 stubs.

## Next Phase Readiness

- Ready: Plan 05-06 (cat 4 judge — voice fidelity LLM-judge) can reuse the agent-client + judgeVoiceFidelity primitives. Same pattern as cat3.
- Ready: Plan 05-07 (cat 5 abuse + cat 6 UX-smoke). Cat 5 mirrors the cat2 assertion-based pattern; cat 6 spawns Playwright as a subprocess.
- Live verification: Plans 05-04 Task 4 (and now 05-05) are gated on the cross-vendor judge model env var (`GOOGLE_GENERATIVE_AI_API_KEY`). Joe needs to provide the key before live runs against /api/chat are attempted; `npm test` (mocked) is fully green at 439/439.
- Concern: cat2-tool-metric-003 is a synthetic spend-cap test that mutates the LIVE Redis spend counter. Running `npm run eval` against production must be guarded so this case doesn't deflect real recruiter traffic mid-run. The reset is robust, but a 5-second window of spend-cap=350 in prod is non-zero impact. **Recommendation:** plan 05-13 (weekly cron eval) should either skip the spend-cap synthetic against prod, or run it during a known-low-traffic hour. Documented for follow-up.

## Self-Check: PASSED

- evals/cat-02-tools.yaml: FOUND
- evals/cat-03-persona.yaml: FOUND
- src/lib/eval/cats/cat2.ts: FOUND
- src/lib/eval/cats/cat3.ts: FOUND
- tests/lib/eval/cats/cat2.test.ts: FOUND
- tests/lib/eval/cats/cat3.test.ts: FOUND
- Commit 5ff24af: FOUND
- Commit c9de742: FOUND
- Commit dfdb59a: FOUND
- Commit a4af8bc: FOUND
- Commit 6989343: FOUND
- Test count: 439/439 passing (416 baseline + 13 cat2 + 10 cat3 = 439)
- Acceptance grep: `from '@/lib/eval/cats/cat2'` in scripts/run-evals.ts: 1
- Acceptance grep: `from '@/lib/eval/cats/cat3'` in scripts/run-evals.ts: 1
- Acceptance grep: `redis.set(spendKey, 350)` in cat2.ts: 1
- Acceptance grep: `redis.set(spendKey, originalSpend)` in cat2.ts: 1
- Acceptance grep: `redis.del(spendKey)` in cat2.ts: 1
- Acceptance grep: warmth-gate expression in cat3.ts: 1
- YAML count: cat2=9 / cat3=6 / per-tool=3-3-3 (validated via node yaml-load)

---
*Phase: 05-eval-gates-launch*
*Completed: 2026-05-09*
