---
phase: 05-eval-gates-launch
plan: 05-04
subsystem: testing
tags: [eval-harness, cat1-fabrication, deterministic-check, llm-judge, gemini, name-token-allowlist, hybrid-zero-tolerance]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-03)
    provides: callAgent, parseChatStream, judgeFactualFidelity, Cat1Verdict, writeCase, loadCases, EvalCase, CategoryResult, EvalCaseResult — and the runCat1 stub in scripts/run-evals.ts to replace
  - phase: 01-foundation-content
    provides: kb/profile.yml + kb/resume.md + kb/case_studies — sources for the name_token_allowlist content
provides:
  - 15 cat-1 fabrication-trap YAML cases at evals/cat-01-fabrication.yaml
  - kb/profile.yml extended with name_token_allowlist (66 entries)
  - src/lib/eval/fabrication.ts (tokenizeNames + checkAllowlist + loadAllowlist + STOPWORDS internal)
  - src/lib/eval/cats/cat1.ts (runCat1 — zero-tolerance hybrid det+judge runner)
  - scripts/run-evals.ts wired with real runCat1 (replacing the Plan 05-03 stub)
affects: [05-05 cat2/cat3 (reuse callAgent + writeCase + agent-client patterns), 05-06 cat4-judge (same pattern), 05-07 cat5/cat6, 05-13 weekly cron (full suite)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-tolerance hybrid pass logic for cat 1: passed = (det.verdict === 'pass') AND (judge.verdict === 'pass') — deterministic name-token allow-list catches invented proper nouns; LLM judge catches vague-claim fabrications and counterfactual scenarios"
    - "judge_rationale stores JSON-stringified bundle of `{ llm_judge: <Cat1Verdict>, deterministic: <AllowlistResult> }` per case — failed cases debuggable from the eval_cases row alone, no log archaeology needed"
    - "Possessive-strip (Pitfall 5): trailing `'s` stripped before allow-list membership check so `Cortex's` matches `cortex` — avoids false-flagging legitimate references to allow-listed proper nouns in possessive form"
    - "tokenizeNames preserves intra-word `'` and `-` plus Latin-1 supplement (À-ſ) — handles names like O'Brien, UnitedHealth-Group, Müller correctly per RESEARCH §15"
    - "Per-case error tolerance: try/catch around callAgent + judge per case; failed-row written with passed:false + judge_rationale='error: <message>'; category continues — single network failure doesn't abort the cat 1 run"

key-files:
  created:
    - "src/lib/eval/fabrication.ts (98 lines — tokenizeNames + isProperNounShape + stripPossessive + checkAllowlist + loadAllowlist + 99-word STOPWORDS set)"
    - "evals/cat-01-fabrication.yaml (190 lines — 15 cases: 4 counterfactual-project + 3 counterfactual-quantity + 3 persona-expert + 3 compound-fabrication + 2 verifiable-easy)"
    - "src/lib/eval/cats/cat1.ts (131 lines — runCat1 hybrid det+judge runner)"
    - "tests/lib/eval/fabrication.test.ts (134 lines — 14 tests)"
    - "tests/lib/eval/cats/cat1.test.ts (212 lines — 8 behaviors)"
  modified:
    - "kb/profile.yml (+87 lines — name_token_allowlist key with 66 entries spanning identity / companies / tools/tech / products/projects / job titles / months / side-project game types)"
    - "scripts/run-evals.ts (replaced runCat1 stub with `import { runCat1 } from '@/lib/eval/cats/cat1'`)"

key-decisions:
  - "Allow-list size = 66 entries from real KB content (kb/profile.yml + kb/resume.md + kb/case_studies/*.md proper nouns) — exceeds plan minimum of 30; categories: 9 identity, 14 companies (nimbl, digital, sei, retailcloud, gap, inc, under, armour, gsk, lockheed, martin, aeronautics, dorman, products), 22 tools/tech (snowflake, cortex, power, tableau, microstrategy, dbt, jira, servicenow, sap, afs, fms, businessobjects, hana, excel, control-m, python, sql, git, statcast, streamlit, railway, mlb), 6 products/projects, 4 job titles, 12 months, 4 side-project game types"
  - "Months included in allow-list (january..december) — sentence-start safe; resume content references months frequently and capitalized month names match isProperNounShape filter"
  - "tokenizeNames regex matches RESEARCH §15 verbatim including Latin-1 range À-ſ — verified by acceptance grep"
  - "Zero-tolerance hybrid pass logic per EVAL-02: 15/15 required (any case fail = category fail). Plan rationale: a single fabrication is a content-trust failure mode; tolerance > 0 invites prompt-engineering drift"
  - "judge_rationale = JSON.stringify({ llm_judge, deterministic }) — per-case debug bundle keeps failed-case investigation in the eval_cases row, not in dev-server logs that may have rotated"
  - "Per-case error tolerance with try/catch: failed-row written with `response: null, judge_verdict: null, judge_rationale: 'error: <msg>', passed: false`; category does not abort. Pattern carried forward to Plans 05-05..05-07"
  - "STOPWORDS LOCKED v1 with 99 English-only words (RESEARCH Open Question 3 closed at planning time). Future i18n would extend; out of scope for v1"
  - "Allow-list maintenance discipline: when a case study references a new company/tool, add the token here. Documented inline in kb/profile.yml comment block"
  - "15 cases authored to spec distribution: 4 counterfactual-project (Anthropic / Databricks / OpenAI / Google Cloud — companies Joe never worked at), 3 counterfactual-quantity (200-engineer team at Snowflake / $50M UA figure / 90-SKUs/80% Gap claim — specific made-up numbers), 3 persona-expert (ML engineer training Cortex AI / React-Vue frontend / SEI security architect — domain-swap traps), 3 compound-fabrication (Gap SAP HANA→BigQuery / Retailcloud iOS app / Lockheed CEO-reporting — multi-claim traps mixing real + fake), 2 verifiable-easy (SEI Data Cloud / Gap Senior Manager BI Supply Chain — should pass with true facts)"
  - "Task 4 (live 15/15 smoke run against preview) DEFERRED — gated on GOOGLE_GENERATIVE_AI_API_KEY in .env.local. Without the key, judgeFactualFidelity errors at the Gemini call and 15/15 cases would error. Code path is unit-tested via 8 cat1.test.ts behaviors; live verification is the first thing to run after the key lands"

patterns-established:
  - "Hybrid det+judge runner skeleton: load cases + load allowlist → for each case { try { callAgent → checkAllowlist → judge → combine → writeCase } catch { write error-row } } → aggregate (every-passed) — directly reused by Plans 05-05/06/07 with different judge/assertion bodies"
  - "Allow-list-as-KB-data: maintained in kb/profile.yml alongside content; one source of truth; case-study additions trigger allow-list updates"
  - "Cat-runner test surface: mock loadCases + loadAllowlist + callAgent (via fetch) + judgeFactualFidelity + writeCase; 8 behaviors cover load / per-case dispatch / hybrid-pass / writeCase / aggregate / error-tolerance / cost"

requirements-completed: [EVAL-02]

# Metrics
duration: 3 sequential commits in one session (120ea64 → 627037c → 7913596) — Task 4 deferred
completed: 2026-05-09 (code-complete; live smoke verification deferred pending GOOGLE_GENERATIVE_AI_API_KEY)
---

# Phase 5 Plan 05-04: Cat 1 Fabrication Runner Summary

**Cat 1 (factual fidelity, EVAL-02) shipped code-complete: 15 fabrication-trap YAML cases, 66-entry name_token_allowlist on kb/profile.yml, deterministic checkAllowlist + LLM-judge hybrid via runCat1, zero-tolerance pass logic (15/15 required), wired into `npm run eval`. 416/416 tests pass; Task 4 live smoke verification deferred pending GOOGLE_GENERATIVE_AI_API_KEY.**

## Performance

- **Duration:** ~3 sequential commits in one session
- **Tasks:** 4 of which 3 shipped + 1 (live smoke run) deferred
- **Files modified:** 7 (5 created, 2 modified)
- **Test count:** 416/416 (per Task 3 commit body) — adds 14 fabrication tests + 8 cat1 tests = +22 over Plan 05-03's 394

## Accomplishments

- 15 cat-1 cases authored in evals/cat-01-fabrication.yaml per spec distribution: 4 counterfactual-project, 3 counterfactual-quantity, 3 persona-expert, 3 compound-fabrication, 2 verifiable-easy. Each case has `case_id`, `category: cat1`, `prompt`, `expected_pass_criteria` (free-text rubric for the LLM judge), `ground_truth_facts[]` (the verifiable claims judgeFactualFidelity grades against), and `tags[]`.
- kb/profile.yml extended with `name_token_allowlist` (66 entries spanning identity, companies, tools/tech, products/projects, job titles, months, side-project game types). Includes `joe`, `dollinger`, all months, plus tokens for SEI, Snowflake, Cortex, Gap, Under Armour, Lockheed Martin, etc. Allow-list maintained alongside KB; documented inline.
- `src/lib/eval/fabrication.ts` (98 lines) implements RESEARCH §15:
  - `tokenizeNames(text)`: lowercases, replaces non-`[a-z0-9'\-À-ſ\s]` with space, splits on whitespace, filters length<2 and pure-numeric (Latin-1 supplement preserved)
  - `isProperNounShape(originalToken)`: length≥3 + lowercase-stripped-of-`'s` not in STOPWORDS + original casing starts with uppercase
  - `stripPossessive`: removes trailing `'s` (Pitfall 5)
  - `checkAllowlist(response, allowlist)` returns `{ unverifiedTokens, verdict: 'pass' | 'flag-for-llm-judge' }`
  - `loadAllowlist()`: reads kb/profile.yml `name_token_allowlist` key; throws if missing/non-array
  - 99-word English-only STOPWORDS set (LOCKED v1)
- `src/lib/eval/cats/cat1.ts` (131 lines) implements runCat1:
  - Loads cases + allowlist at runner start
  - Per case: `callAgent → checkAllowlist → judgeFactualFidelity → combine into EvalCaseResult → writeCase`
  - Pass logic: `passed = det.verdict === 'pass' AND judge.verdict === 'pass'` (zero-tolerance hybrid)
  - judge_rationale stores JSON-stringified bundle of both signals
  - Per-case errors caught (network/timeout/judge throw); writes fail-row + continues
  - Aggregates cost_cents; emits `cat1_started` + `cat1_complete` Pino events
- scripts/run-evals.ts: imports `runCat1` from `'@/lib/eval/cats/cat1'`; local stub removed.
- 14 fabrication.test.ts behaviors pass (5 tokenize + 5 checkAllowlist + 4 edge cases including possessives + Unicode)
- 8 cat1.test.ts behaviors pass: load cases+allowlist, per-case callAgent w/ unique session_id, judge runs every case, zero-tolerance hybrid (det fail blocks pass even when judge passes), writeCase per case, CategoryResult.passed = every-passed, per-case error tolerance, cost aggregation
- 416/416 in full suite

## Task Commits

1. **Task 1: fabrication.ts deterministic check + kb/profile.yml allowlist (66 entries)** — `120ea64` (feat) — 14/14 fabrication tests
2. **Task 2: 15 cat-1 fabrication-trap YAML cases** — `627037c` (feat) — yaml validates + all required fields
3. **Task 3: runCat1 hybrid det+judge runner + wire into CLI** — `7913596` (feat) — 8/8 cat1 tests + 416/416 full suite
4. **Task 4: live 15/15 smoke run against preview** — DEFERRED (no GOOGLE_GENERATIVE_AI_API_KEY)

## Files Created/Modified

- `src/lib/eval/fabrication.ts` (created, 98 lines) — tokenizeNames + isProperNounShape + stripPossessive + checkAllowlist + loadAllowlist; STOPWORDS module-internal const (99 words). tokenizeNames regex matches RESEARCH §15 verbatim including Latin-1 range `À-ſ`.
- `kb/profile.yml` (modified, +87 lines) — `name_token_allowlist:` key appended with 66 entries. Comment block documents the maintenance discipline ("when a case study references a new company/tool, add the token here").
- `evals/cat-01-fabrication.yaml` (created, 190 lines) — 15 cases. case_ids cat1-fab-001..015. Each has expected_pass_criteria, ground_truth_facts[], tags[]. YAML validates; 15 unique case_ids.
- `src/lib/eval/cats/cat1.ts` (created, 131 lines) — exports `runCat1(targetUrl, runId): Promise<CategoryResult>`. Imports loadCases, writeCase, checkAllowlist, loadAllowlist, judgeFactualFidelity, callAgent, types.
- `tests/lib/eval/fabrication.test.ts` (created, 134 lines) — 14 tests covering tokenize edge cases (apostrophes/hyphens/Unicode/numerics) and checkAllowlist (pass/flag/possessive/stopwords/lowercase-common-words).
- `tests/lib/eval/cats/cat1.test.ts` (created, 212 lines) — 8 behaviors covering full runner contract.
- `scripts/run-evals.ts` (modified, +6/-3 lines) — `import { runCat1 } from '@/lib/eval/cats/cat1'`; local stub removed; runCat2..runCat6 stubs remain pending Plans 05-05..05-09.

## Decisions Made

- **66-entry allow-list (>30 plan minimum)**: extracted from kb/profile.yml + kb/resume.md + kb/case_studies/*.md proper nouns. Categories: 9 identity, 14 companies, 22 tools/tech, 6 products/projects, 4 job titles, 12 months, 4 side-project game types. Months included because resume references them frequently and capitalized month names match isProperNounShape filter — not flagging them avoids false-positives.
- **Zero-tolerance hybrid (15/15 required) per EVAL-02**: a single fabrication is a content-trust failure mode for a recruiter-facing agent. Tolerance > 0 invites prompt-engineering drift. Det+judge AND-gate catches both invented-proper-noun (det) and counterfactual-scenario / vague-fabrication (judge) failure modes.
- **judge_rationale = JSON.stringify({ llm_judge, deterministic })**: per-case debug bundle. Failed cases investigable from the eval_cases row alone — no need to grep dev-server logs that may have rotated. Format makes the dual-signal nature explicit (it was the LLM judge OR the deterministic check OR both that flagged this case).
- **Per-case error tolerance**: try/catch wraps callAgent + judge per case. Failed-row written with `response: null, judge_verdict: null, judge_rationale: 'error: <msg>', passed: false`. Category does not abort — single network failure doesn't kill the cat 1 run. Pattern carries forward to all Plan 05-05..05-07 cat runners.
- **STOPWORDS LOCKED v1 (99 English-only words)** per RESEARCH Open Question 3. i18n is out of scope for v1.
- **`||` for env override (not `??`)** — already established in Plan 05-02. fabrication.ts loadAllowlist uses simple readFile + js-yaml (no env-override path).
- **Task 4 deferral approved**: live judge calls require GOOGLE_GENERATIVE_AI_API_KEY which Joe has not yet set. Code path is fully unit-tested via 8 cat1 behaviors. Task 4 will close when the key lands; same dependency gates Plans 05-05/06/07 Task 4.

## Issues Encountered

No issues. Pre-commit hooks ran cleanly on all 3 commits.

## User Setup Required

- **`GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`** — required to close Task 4. Without it, the cat 1 live smoke run errors at the first judgeFactualFidelity call. Same dependency outstanding from Plan 05-03; closes for Plans 05-04/05/06/07 simultaneously when the key lands.

## Known Stubs

None for cat 1. cat1.ts is wired end-to-end through callAgent → checkAllowlist → judgeFactualFidelity → writeCase; scripts/run-evals.ts imports the real runner. The runCat2..runCat6 stubs in scripts/run-evals.ts remain pending Plans 05-05..05-09.

## Task 4 Deferral

**Status:** Deferred — code-complete; live verify pending env-var prerequisite.

**Reason:** Task 4 is `checkpoint:human-verify` requiring `EVAL_TARGET_URL=<preview> npm run eval` against a live preview deploy. The cat-1 hybrid logic calls Gemini (judgeFactualFidelity) on every case; without `GOOGLE_GENERATIVE_AI_API_KEY` the judge call errors and all 15 cases would record as fail-rows.

**Approval:** Continued execution with Task 4 deferred; orchestrator records the dependency in deferred-items.md (re-confirmed by Plan 05-07 close-out which appended a joint deferral block).

**Resume path:** Joe sets the env var → runs `EVAL_TARGET_URL=<preview-url> npm run eval` → captures the resume signal `cat1: 15/15 pass` (or `cat1: N failures — <list>`). Plans 05-05/06/07 Task 4 close simultaneously.

## Next Phase Readiness

- **Ready: Plan 05-05 (cat 2 tool-correctness + cat 3 persona)** — can reuse callAgent + writeCase + agent-client patterns; cat 3 follows the same LLM-judge skeleton with judgePersona.
- **Ready: Plan 05-06 (cat 4 voice-fidelity LLM-judge)** — same hybrid skeleton with judgeVoiceFidelity + 5-dim Likert.
- **Ready: Plan 05-07 (cat 5 abuse + cat 6 UX-smoke)** — independent stub replacements.
- **Live verification deferred**: 4 plans (05-04/05/06/07) all gated on the same key; closes together.
- **Allow-list maintenance future-work**: documented in kb/profile.yml comment — case-study additions trigger allow-list updates.

## Self-Check: PASSED

- src/lib/eval/fabrication.ts: FOUND (exports tokenizeNames, checkAllowlist, loadAllowlist; STOPWORDS module-internal)
- evals/cat-01-fabrication.yaml: FOUND (15 case_ids cat1-fab-001..015 verified via grep)
- src/lib/eval/cats/cat1.ts: FOUND (exports runCat1)
- tests/lib/eval/fabrication.test.ts: FOUND
- tests/lib/eval/cats/cat1.test.ts: FOUND
- kb/profile.yml `name_token_allowlist:` key: FOUND (66 entries per commit body)
- scripts/run-evals.ts `from '@/lib/eval/cats/cat1'` import: present
- Commit 120ea64 (Task 1): FOUND
- Commit 627037c (Task 2): FOUND
- Commit 7913596 (Task 3): FOUND
- Test count: 416/416 (per 7913596 commit body)
- Acceptance grep: tokenizeNames regex contains `À-ſ`: present (per commit body)
- Acceptance grep: zero-tolerance hybrid `det.verdict === 'pass' && judgeVerdict === 'pass'`: present in cat1.ts (per commit body)

---
*Phase: 05-eval-gates-launch*
*Completed: 2026-05-09 (Tasks 1-3 code-complete; Task 4 live smoke deferred pending GOOGLE_GENERATIVE_AI_API_KEY)*
