---
phase: 05-eval-gates-launch
plan: 05-06
subsystem: testing
tags: [eval-harness, cat4-voice, llm-judge, gemini, voice-fidelity, vitest]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-03)
    provides: judgeVoiceFidelity (5-dim Likert) + callAgent + writeCase + EvalCaseSchema
  - phase: 05-eval-gates-launch (Plan 05-05)
    provides: cat3.ts pattern (LLM-judge runner; per-case error tolerance)
  - phase: 01-foundation-content
    provides: kb/voice.md (12 voice samples); kb/stances.md (12 stances; Stance 4 referenced by prompt-4)
provides:
  - 5 fixed cat-4 voice-eliciting prompts (Joe-finalized; shared with Plan 05-07 blind A/B)
  - cat-04-voice.yaml rubric (5 dimensions + thresholds + voice-samples-source pointer)
  - runCat4Judge with two-gate pass logic (per-case avg >= 4.0 AND aggregate avg >= 4.0)
  - loadVoiceSamples helper with refined heuristic (skips HTML comments + *Source: lines)
affects: [05-07 cat4-blind-ab (reads same prompts.yaml), 05-13 weekly-cron-eval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-gate pass logic: results.every(c.passed) AND aggregateAvg >= threshold — defense in depth (per-case gate would catch all 4-failures alone, but the aggregate gate is the durable contract documented in cat-04-voice.yaml)"
    - "Voice-sample loader heuristic refinement: 60-600 chars + ≥2 sentence terminators + reject `<!--` blocks + reject `*Source:` italic lines + reject headers/hr — produces 8 clean samples from kb/voice.md as authored"
    - "Aggregate computed only over verdict-producing cases (errors excluded from aggregateCount/aggregateSum) so a single network failure cannot inflate denominator and disguise judge-quality drops"

key-files:
  created:
    - "evals/cat-04-prompts.yaml (5 cases; prompt-4 swap from conflict to PM-lesson-5-years-earlier per Joe approval)"
    - "evals/cat-04-voice.yaml (5-dim rubric + thresholds + voice-samples reference)"
    - "src/lib/eval/cats/cat4-judge.ts (runCat4Judge + loadVoiceSamples)"
    - "tests/lib/eval/cats/cat4-judge.test.ts (11 cases)"
    - ".planning/phases/05-eval-gates-launch/deferred-items.md (pre-existing ChatUI TS error log)"
  modified:
    - "scripts/run-evals.ts (replaced Plan 05-03 cat4-judge stub with real import)"

key-decisions:
  - "prompt-4 swap from cross-functional-conflict to 'PM lesson 5 years earlier' opens warmth/teaching register (voice.md Sample 8/11) and curiosity-over-tools stance (Stance 4) — coverage gap the conflict prompt didn't reach (overlapped with prompt-3 stance disagreement)"
  - "Two-gate pass logic (per-case AND aggregate) matches cat-04-voice.yaml pass_threshold contract — keeps the YAML the durable source-of-truth and lets a future cleaner test config flip thresholds without code change"
  - "Voice-sample heuristic refined past plan example: skip HTML comments + *Source: italic attributions — without that refinement the seeded voice.md leaks block-1 (HTML-comment metadata block) and 7+ source-attribution lines into the judge prompt, reducing voice signal density"
  - "Test file path: tests/lib/eval/cats/cat4-judge.test.ts (matches established cat1/cat2/cat3 location). Plan frontmatter listed src/lib/__tests__/eval/cats/ which doesn't exist as a vitest collection root — followed established convention (Rule 3: blocking issue auto-resolved)"
  - "Aggregate denominator excludes errored cases — counting an errored case as 0 would falsely depress the aggregate even when 4 of 4 verdict-producing cases averaged 4.5; with this fix, 1 network error + 4 strong cases reports the honest 4.5 aggregate AND fails the category via the every-passed gate (correct outcome via correct path)"

patterns-established:
  - "loadVoiceSamples (exported): reusable for any future voice-comparison test or admin-UI surface that needs Joe-voice excerpts for visual reference"
  - "Two-gate pass logic for multi-case category: pattern transferable to any future per-case-AND-aggregate evaluation (e.g., a cat-7 latency test where p95 AND p99 both gate)"

requirements-completed: [EVAL-06]

# Metrics
duration: 12min
completed: 2026-05-09
---

# Phase 5 Plan 05-06: Cat 4 Voice-Fidelity LLM-Judge Summary

**runCat4Judge wired end-to-end: 5 Joe-finalized voice-eliciting prompts → judgeVoiceFidelity 5-dim Likert per response → two-gate pass (per-case avg ≥ 4.0 AND aggregate avg ≥ 4.0); 450/450 tests; cat4-judge stub in scripts/run-evals.ts replaced with real runner.**

## Performance

- **Duration:** ~12 min (continuation after Joe's prompt-4 approval)
- **Tasks:** 3 (Task 1 checkpoint resumed; Tasks 2-3 ran end-to-end)
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments

- 5 fixed cat-4 prompts authored in evals/cat-04-prompts.yaml; prompt-4 changed at Joe's direction from "cross-functional conflict" (overlapped with prompt-3 stance) to "PM lesson 5 years earlier" (opens warmth/teaching register from voice.md Sample 8 + Sample 11 + Stance 4 territory)
- Voice rubric durably documented in evals/cat-04-voice.yaml: 5 dimensions (diction / hedge_density / sentence_rhythm / concreteness / filler_absence) with anchored 1-5 descriptors + threshold contract (per_case_min_avg=4.0, aggregate_min_avg=4.0, n_cases=5) + voice_samples_source pointer (kb/voice.md, count=8)
- runCat4Judge implemented with two-gate pass logic: per-case `verdict.average >= 4.0` AND `aggregateAvg >= 4.0` over verdict-producing cases
- loadVoiceSamples helper refined past plan-example heuristic: 60-600 chars + ≥2 sentences + reject HTML comments + reject *Source: lines + reject headers/hr — produces exactly 8 clean Joe-voice excerpts from the seeded kb/voice.md (Samples 1-8)
- Per-case error tolerance preserved (cat3 pattern): callAgent or judge throw becomes a fail row, category continues
- 11 new tests covering all 7 plan-spec behaviors + extras (returns category 'cat4-judge' / per-case error tolerance) — 439 → 450 passing, zero regressions
- scripts/run-evals.ts updated: stub replaced with `import { runCat4Judge } from '@/lib/eval/cats/cat4-judge'`

## Task Commits

1. **Task 1: Joe-approved 5 cat-4 prompts (with prompt-4 teaching swap)** — `beefda5` (feat)
2. **Task 2: cat-4 voice rubric YAML** — `72989d8` (feat)
3. **Task 3 RED: cat4-judge test scaffold (11 cases)** — `6b81bed` (test)
3. **Task 3 GREEN: runCat4Judge + loadVoiceSamples + CLI wire** — `fe12c47` (feat)

## Files Created/Modified

- `evals/cat-04-prompts.yaml` (created) — 5 voice-eliciting prompts. case_id pattern cat4-prompt-NNN. prompt-4 = "What's something about being a PM that you wish you'd understood five years earlier?" with tags [voice-elicit, teaching, retrospective].
- `evals/cat-04-voice.yaml` (created) — Rubric YAML. 5 dimensions × {id, measures, anchor_5, anchor_1}. pass_threshold object. voice_samples_source pointer to kb/voice.md.
- `src/lib/eval/cats/cat4-judge.ts` (created) — runCat4Judge + loadVoiceSamples + PASS_THRESHOLD constant + MAX_VOICE_SAMPLES=8.
- `tests/lib/eval/cats/cat4-judge.test.ts` (created) — 11 vitest cases. Mocks loadCases / judgeVoiceFidelity / writeCase / callAgent. Verifies all 7 plan-spec behaviors plus error tolerance + category-id.
- `scripts/run-evals.ts` (modified) — replaced inline runCat4Judge stub with `import { runCat4Judge } from '@/lib/eval/cats/cat4-judge'`. Updated comment block from "Plans 05-06..05-09 fill in" to "Plans 05-07..05-09".
- `.planning/phases/05-eval-gates-launch/deferred-items.md` (created) — log of pre-existing ChatUI.tsx TS error (verified via git stash; out of scope per Plan 05-06).

## Decisions Made

- **prompt-4 swap rationale (Joe-driven)**: Replacement opens the warmth/teaching voice register (voice.md Sample 8 "products that perform best are the ones you hear least about" + Sample 11 "any week where we ship something") and the curiosity-over-tools stance (Stance 4: "Hire for curiosity; tools are teachable"). The original conflict prompt overlapped with prompt-3's stance-disagreement territory; the swap delivers coverage of registers the other 4 prompts don't reach.

- **Two-gate pass logic**: `results.every(c => c.passed) && aggregateAvg >= 4.0`. The plan suggests per-case OR aggregate could be sufficient; chose AND because (a) it matches cat-04-voice.yaml's pass_threshold contract documenting BOTH per_case_min_avg=4.0 AND aggregate_min_avg=4.0, (b) defense-in-depth — if a future judge-prompt change rounds boundary cases, AND keeps both gates honest, (c) cheap: aggregate gate is one division and one comparison.

- **Aggregate denominator = verdict-producing cases only**: Errored cases (network down, judge throw) are excluded from `aggregateSum / aggregateCount`. If counted as 0, a single network blip would falsely depress aggregate from 4.5 → 3.6 even when 4 of 4 verdict-producing cases scored 4.5. With this fix, the every-passed gate correctly fails the category (errored case has `passed: false`) AND the aggregate metric remains honest as a separate signal.

- **Voice-sample loader heuristic refinement**: Plan example used `b.length > 60 && b.length < 600 && !b.startsWith('#') && !b.startsWith('---')`. Live test against current kb/voice.md showed this lets through (1) the leading HTML-comment block "Seeded 2026-04-23 from voice interview..." which is metadata not voice, and (2) the `*Source: voice-interview-2026-04-23-promptN*` italic lines which are attribution metadata not voice. Added 4 rejection clauses: `<!--` (HTML comments), `*Source:` (attributions), and tightened to `>=2 sentence-terminators` (filters out short pre-punct snippets that survived the length filter). Result: 11 candidate blocks → 8 clean Joe-voice samples (Samples 1-8 from voice.md). Documented inline as a pattern for future kb-format changes.

- **Test path follows established convention**: Plan frontmatter listed `src/lib/__tests__/eval/cats/cat4-judge.test.ts`, but `src/lib/__tests__/` does not exist as a vitest collection root in this repo — established convention (cat1, cat2, cat3) is `tests/lib/eval/cats/`. Used the established path (Rule 3: blocking issue, auto-resolved).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file path mismatch with vitest collection root**
- **Found during:** Task 3 RED scaffold
- **Issue:** Plan frontmatter `files_modified` listed `src/lib/__tests__/eval/cats/cat4-judge.test.ts`. Established cat1/cat2/cat3 tests live under `tests/lib/eval/cats/` and `src/lib/__tests__/` does not exist anywhere in the repo. Following the plan path would have produced a test file vitest never discovers.
- **Fix:** Wrote tests to `tests/lib/eval/cats/cat4-judge.test.ts` matching the established convention.
- **Files modified:** tests/lib/eval/cats/cat4-judge.test.ts (created at correct path)
- **Verification:** `npx vitest run tests/lib/eval/cats/cat4-judge.test.ts` discovers and runs 11 tests; all pass.
- **Committed in:** 6b81bed (RED) and fe12c47 (GREEN)

**2. [Rule 1 - Bug] Voice-sample loader heuristic admits non-voice content**
- **Found during:** Task 3 GREEN sanity check (before writing implementation)
- **Issue:** Plan example heuristic `length > 60 && length < 600 && !startsWith('#') && !startsWith('---')` admits the leading HTML-comment block in kb/voice.md (block 1: "Seeded 2026-04-23 from voice interview per docs/...") and admits the `*Source: voice-interview-2026-04-23-promptN*` italic attribution lines as voice samples. These are metadata, not voice — feeding them to the judge dilutes voice signal density and risks the judge anchoring on metadata-vocabulary instead of Joe-voice.
- **Fix:** Added 4 rejection clauses: `b.startsWith('<!--')` (HTML comments), `b.startsWith('*Source:')` (italic attributions), `>=2 sentence-terminators`, and consolidated existing skip-headers/hr clauses. Validated against current kb/voice.md: produces 11 raw → 8 capped clean voice samples (the actual Samples 1-8 from voice.md).
- **Files modified:** src/lib/eval/cats/cat4-judge.ts (loadVoiceSamples)
- **Verification:** test "loads voice samples from kb/voice.md and passes them to judgeVoiceFidelity" asserts samples never start with `<!--`, `*Source:`, or `#`. Pre-flight `node -e` script confirms 8 clean blocks from Samples 1-8 of voice.md.
- **Committed in:** fe12c47 (Task 3 GREEN)

**3. [Rule 2 - Critical] Aggregate denominator inflation by errored cases**
- **Found during:** Task 3 GREEN implementation review
- **Issue:** Plan example used `aggregateAvg = aggregateAvg / results.length`, which divides by the count of ALL cases including errored ones (where verdict was never produced). A single network failure could falsely depress the aggregate from 4.5 to 3.6 (e.g., 4 cases at 4.5 + 1 errored counted as 0 = 18/5 = 3.6) and obscure whether the judge actually ran cleanly on the verdict-producing cases.
- **Fix:** Track `aggregateSum` and `aggregateCount` independently, both incremented only inside the try-block (where the verdict was produced). On error, neither moves. Aggregate = `aggregateSum / aggregateCount`. The every-passed gate already fails the category on any errored case (passed=false), so this fix preserves correct fail behavior while giving an honest aggregate metric for diagnostics.
- **Files modified:** src/lib/eval/cats/cat4-judge.ts (lines 79-80, 95-96, 115)
- **Verification:** test "handles per-case errors without aborting" passes with 1 error + 1 pass — log line shows `aggregate_avg: 5.00, category_passed: false`. Aggregate honestly reports the verdict-producing case avg; category correctly fails via the every-passed gate.
- **Committed in:** fe12c47 (Task 3 GREEN)

---

**Total deviations:** 3 auto-fixed (1× Rule 1 — bug; 1× Rule 2 — critical correctness; 1× Rule 3 — blocking convention mismatch)
**Impact on plan:** Three correctness/convention fixes; no scope creep, no architectural change. The voice-sample heuristic and aggregate-denominator fixes are load-bearing — without them, judge signal is diluted and the aggregate metric lies on errors. The test-path fix is convention-only but mandatory for vitest discovery.

## Issues Encountered

None beyond the auto-fixes above. Pre-commit hooks ran cleanly on all 4 commits. No new lint warnings on Plan 05-06 files. The pre-existing ChatUI.tsx TS error (line 46) was logged to deferred-items.md and verified out of scope via `git stash` reproduction.

## User Setup Required

None. Plan introduces no new env vars and no external service configuration. Live verification of the cat-4-judge runner against /api/chat is gated on the existing `GOOGLE_GENERATIVE_AI_API_KEY` (Plans 05-04 / 05-05 same dependency) — when Joe provides the key, `EVAL_TARGET_URL=<preview> npm run eval` will produce real cat-4-judge aggregate score against current preview.

## Known Stubs

None. cat4-judge.ts is wired end-to-end through callAgent → judgeVoiceFidelity → writeCase; scripts/run-evals.ts imports the real runner. The remaining cat5 / cat6 stubs in scripts/run-evals.ts are owned by Plans 05-07..05-09 (out of scope here).

## Next Phase Readiness

- **Ready: Plan 05-07 (cat 4 blind A/B half).** Reads the SAME `evals/cat-04-prompts.yaml` (single source of truth, no copy). Reuses `loadVoiceSamples` (exported) for the curated Joe-voice rendering on the /admin/eval-ab page. Page generates fresh agent replies via callAgent against the 5 prompts and intermixes with voice-sample excerpts.
- **Ready: Plan 05-08+ (cat 5 abuse, cat 6 UX-smoke).** Independent stub replacements; cat5 follows the cat2 assertion-based pattern; cat6 spawns Playwright as subprocess.
- **Live verification deferred:** Cat-4-judge live runs require `GOOGLE_GENERATIVE_AI_API_KEY` (Plan 05-03 dependency, deferred at Plan 05-04 close). When Joe sets the key, smoke run via `EVAL_TARGET_URL=<preview-url> npm run eval` will surface a real cat4-judge aggregate score for the current preview deployment.
- **Pre-existing concern documented:** ChatUI.tsx TS2739 error logged to deferred-items.md; not a Plan 05-06 regression; recommend folding into a future Phase 3 cleanup or Plan 05-NN-LAUNCH pre-flight TS audit.

## Self-Check: PASSED

- evals/cat-04-prompts.yaml: FOUND
- evals/cat-04-voice.yaml: FOUND
- src/lib/eval/cats/cat4-judge.ts: FOUND
- tests/lib/eval/cats/cat4-judge.test.ts: FOUND
- .planning/phases/05-eval-gates-launch/deferred-items.md: FOUND
- scripts/run-evals.ts (modified — `runCat4Judge` import): FOUND
- Commit beefda5 (Task 1): FOUND
- Commit 72989d8 (Task 2): FOUND
- Commit 6b81bed (Task 3 RED): FOUND
- Commit fe12c47 (Task 3 GREEN): FOUND
- Test count: 450/450 passing (439 baseline + 11 new cat4-judge)
- Acceptance grep: `PASS_THRESHOLD = 4.0` in cat4-judge.ts: 1
- Acceptance grep: `kb/voice.md` reference in cat4-judge.ts: 3
- Acceptance grep: `from '@/lib/eval/cats/cat4-judge'` in scripts/run-evals.ts: 1
- YAML validation: cat-04-prompts.yaml = 5 cases (cat4-prompt-001..005, all category=cat4-judge); cat-04-voice.yaml = 5 dimensions, threshold=4.0, source=kb/voice.md
- Joe-approved prompt-4 wording verified in cat-04-prompts.yaml line 33

---
*Phase: 05-eval-gates-launch*
*Completed: 2026-05-09*
