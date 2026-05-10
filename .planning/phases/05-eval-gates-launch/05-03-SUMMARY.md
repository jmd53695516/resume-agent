---
phase: 05-eval-gates-launch
plan: 05-03
subsystem: testing
tags: [eval-cli, judge-wrapper, gemini, supabase-storage, yaml-loader, cost-model, ai-sdk-v6, sse-parser]

# Dependency graph
requires:
  - phase: 05-eval-gates-launch (Plan 05-02)
    provides: live eval_runs/eval_cases tables + JUDGE_MODEL constant + @ai-sdk/google dep + GOOGLE_GENERATIVE_AI_API_KEY env schema
  - phase: 04-admin-observability
    provides: src/lib/supabase-server.ts supabaseAdmin service-role client + src/lib/logger.ts childLogger pattern
  - phase: 03-tools-resilience
    provides: /api/chat AI SDK v6 streaming response shape (createUIMessageStreamResponse)
provides:
  - scripts/run-evals.ts CLI orchestrator (createRun → 6 stub runners → updateRunStatus; cost-warn; exit code 0/1/2)
  - npm run eval script + node --env-file=.env.local + tsx loader
  - src/lib/eval/types.ts: EvalCase, EvalCaseResult, RunSummary, CategoryResult, Category, CategorySchema, EvalCaseSchema
  - src/lib/eval/cost.ts: WARN_THRESHOLD_CENTS=150, projectRunCost, extractAnthropicCost, extractGoogleCost
  - src/lib/eval/yaml-loader.ts: loadCases (zod-validated)
  - src/lib/eval/judge.ts: judgeFactualFidelity (cat 1) + judgeVoiceFidelity (cat 4) + judgePersona (cat 3) + estimateJudgeCost
  - src/lib/eval/storage.ts: createRun + writeCase + updateRunStatus
  - src/lib/eval/agent-client.ts: callAgent + parseChatStream (DRY helper for Plans 05-04..05-07)
  - .eval-tmp/sample-stream.txt (live AI SDK v6 SSE fixture)
affects: [05-04 (cat1 imports types/judge/storage/agent-client/yaml-loader), 05-05/06/07 (all import the same primitives), 05-13 (weekly cron invokes the CLI)]

# Tech tracking
tech-stack:
  added:
    - "dotenv@^17.4.2 (devDep — installed but not actually used; CLI uses node --env-file= instead)"
  patterns:
    - "Node 20.6+ native --env-file flag for CLI scripts (not dotenv-config import) — tsx + ESM hoists imports above any statement-level dotenv call, so .env.local must load BEFORE module evaluation"
    - "AI SDK v6 SSE format: `data: {\"type\":\"text-delta\",\"delta\":\"...\"}\\n\\n` (NOT the v5 short-prefix `0:\"...\"` codes the plan assumed) — parser scans for the v6 type union"
    - "DRY agent-client helper: every cat runner imports callAgent + parseChatStream from one module so the streaming-format regex lives in ONE place; future SDK upgrades = single-point fix"
    - "session_id round-trip: /api/chat validates session_id against Supabase (BL-17 fix from 05-01) — eval cases must mint a real session via /api/session first; synthetic ids 404"
    - "generateObject({ schema }) with Zod handles JSON-parse + validation in one call — eliminates the @google/genai hand-rolled parse-and-validate dance"

key-files:
  created:
    - "src/lib/eval/types.ts (72 lines — EvalCase, EvalCaseResult, RunSummary, CategoryResult; CategorySchema enum matches eval_cases.category check constraint exactly)"
    - "src/lib/eval/cost.ts (86 lines — WARN_THRESHOLD_CENTS=150, projectRunCost, extractAnthropicCost, extractGoogleCost; PRICES match RESEARCH §6 verbatim)"
    - "src/lib/eval/yaml-loader.ts (67 lines — js-yaml + zod safeParse boundary validation)"
    - "src/lib/eval/judge.ts (119 lines — 3 judge variants + estimateJudgeCost; all wrap SDK errors with caseId context)"
    - "src/lib/eval/storage.ts (81 lines — createRun + writeCase + updateRunStatus; nanoid IDs; service-role writes; Pino events)"
    - "src/lib/eval/agent-client.ts (126 lines — callAgent + parseChatStream; AI SDK v6 SSE parser)"
    - "scripts/run-evals.ts (148 lines — CLI orchestrator with 6 stub runners for Plans 05-04..05-09)"
    - ".eval-tmp/sample-stream.txt (8 lines — live /api/chat capture, used as parser fixture)"
    - "tests/lib/eval/types.test.ts (zero — embedded into yaml-loader/cost coverage)"
    - "tests/lib/eval/cost.test.ts (90 lines — multiple tests covering projector + Anthropic/Google extractors + WARN_THRESHOLD_CENTS literal)"
    - "tests/lib/eval/yaml-loader.test.ts (131 lines — multiple tests covering valid/malformed/missing-required/empty/passthrough)"
    - "tests/lib/eval/judge.test.ts (145 lines — 3 judge variants + cost extraction + error wrapping)"
    - "tests/lib/eval/storage.test.ts (190 lines — createRun + writeCase + updateRunStatus + duplicate-id + Pino events)"
    - "tests/lib/eval/agent-client.test.ts (128 lines — 7 synthetic edge cases + 1 live-fixture round-trip + 3 callAgent paths)"
  modified:
    - "package.json (+2 lines — `\"eval\": \"node --env-file=.env.local --import tsx scripts/run-evals.ts\"` script)"
    - ".gitignore (+8 lines — `.eval-tmp/*` exclude with `!.eval-tmp/sample-stream.txt` exception so the fixture stays tracked)"

key-decisions:
  - "Tests at tests/lib/eval/ (NOT src/lib/__tests__/eval/ as plan frontmatter listed) — vitest config only discovers tests/**/*.test.{ts,tsx}; established convention forward through Plans 05-04..05-07"
  - "AI SDK v6 SSE parser deviates from plan: live capture (.eval-tmp/sample-stream.txt) showed `data: {\"type\":\"text-delta\",\"delta\":\"...\"}\\n\\n` event-stream format — NOT the v5 short-prefix `0:\"...\"`/`9:{...}` codes the plan assumed. Parser rewritten against the real v6 type union (text-start, text-delta, text-end, [DONE]; tool-call events ignored for the text channel)"
  - "Native `node --env-file=.env.local` over `import 'dotenv/config'` — tsx + ESM hoists imports above statement-level calls, so any runtime dotenv config fires AFTER `@/lib/env` already failed at module-init zod parse. Native flag loads .env.local into process.env BEFORE any module evaluates"
  - "dotenv@^17.4.2 installed as devDep but not actually used by the CLI — kept in case future scripts need programmatic env loading"
  - "callAgent expects callers to mint a real session_id via /api/session first — /api/chat now validates session_id against Supabase (BL-17 fix from 05-01 walk); synthetic ids would 404"
  - ".gitignore pattern: `.eval-tmp/*` (with the `*`) NOT `.eval-tmp/` — directory-as-pattern would block git from traversing into the directory and the negation `!.eval-tmp/sample-stream.txt` would never apply"
  - "judge.ts wraps every Gemini SDK call in `.catch(...)` that re-throws with caseId + variant context — cat runners can debug failures from the eval_cases.judge_rationale row alone"
  - "PRICES match RESEARCH §6 verbatim: Sonnet input/cache_write/cache_read/output = 3.0/3.75/0.3/15.0; Haiku in/out = 1.0/5.0; Gemini in/out = 0.3/2.5"
  - "estimateJudgeCost rounds up to 1 cent floor (cents are int); typical 1500-in/200-out call is ~0.1 cents but per-call int rounding produces 1"
  - "Stub runners for cat2..cat6 return `{ category, cases: [], passed: true, cost_cents: 0 }` — Plans 05-04..05-09 fill in. cat1 stub replaced in Plan 05-04"

patterns-established:
  - "AI SDK v6 SSE parser: scan for `data: {\"type\":\"text-delta\",\"delta\":\"...\"}` events; ignore type:tool-* events for the text channel; defensive parse (silent skip on malformed; never throws)"
  - "callAgent return shape: { response, httpStatus, rawBody } — rawBody preserved so cat runners can do their own tool-call extraction (cat 2) without re-parsing"
  - "Pino event names: eval_run_started / projected_cost / eval_run_summary / eval_run_created / eval_case_written / eval_run_finalized / eval_run_error — event-grep-friendly for Vercel log searches"
  - "Exit code mapping: 0 all-pass, 1 any-fail, 2 orchestration error (run setup or aggregate failure) — Plan 05-10 branch protection treats 1 + 2 as 'eval failed'"

requirements-completed: [EVAL-01, EVAL-13, EVAL-14]

# Metrics
duration: ~4 working tasks across one session (4 commits e27d92a → c8282f9 → 0fb8c0d → 95ce51d)
completed: 2026-05-09
---

# Phase 5 Plan 05-03: Eval CLI Core Summary

**Built the eval CLI core — orchestrator + 5 supporting library modules + DRY agent-client helper — and wired `npm run eval` end-to-end with live Supabase eval_runs writes. AI SDK v6 SSE parser corrected from plan's outdated v5 prefix-code assumption (live capture proved the route emits `data: {"type":"text-delta","delta":"..."}` events). 394/394 tests pass; sanity run completes in ~940ms with run_id `oB71C1smpEdI1Sg4NZ30b` confirmed in the live DB.**

## Performance

- **Duration:** ~one session, four sequential tasks
- **Tasks:** 4 (types/cost/yaml-loader → judge/storage → CLI orchestrator → agent-client + live fixture)
- **Files modified:** ~14 (created) + 2 (modified, package.json + .gitignore)
- **Tests added:** ~30+ across 5 test files (19 in Task 1; 12 in Task 2; 11 in Task 4) per per-commit messages
- **Sanity run:** `npm run eval` exits 0 in ~940ms; live eval_runs row written

## Accomplishments

- `src/lib/eval/types.ts` — shared type contracts. `CategorySchema` enum lists all 7 values matching `eval_cases.category` check constraint exactly. `EvalCaseSchema` validates loaded YAML at the boundary; `.passthrough()` allows forward-compat with extra YAML keys.
- `src/lib/eval/cost.ts` — `WARN_THRESHOLD_CENTS = 150` (locked $1.50). `projectRunCost(40)` returns ~133¢ (under the 150 warn). `extractAnthropicCost` handles input/output/cacheRead/cacheCreation tokens; `extractGoogleCost` handles promptTokens/completionTokens. PRICES match RESEARCH §6 verbatim.
- `src/lib/eval/yaml-loader.ts` — `loadCases(filepath)` reads + js-yaml-parses + zod-validates. Throws on read/parse/validation failures with parseable errors. Empty file returns `[]` with warn log. Top-level non-array throws.
- `src/lib/eval/judge.ts` — three judge variants:
  - `judgeFactualFidelity` (cat 1) returns `Cat1Verdict { score, verdict, fabrication_detected, rationale }`
  - `judgeVoiceFidelity` (cat 4) returns 5-dim `VoiceVerdict { diction, hedge_density, sentence_rhythm, concreteness, filler_absence } + average + rationale` per RESEARCH §14
  - `judgePersona` (cat 3) returns `PersonaVerdict { score, verdict, rationale }`
  - All wrap SDK errors with `caseId` context for debuggability via .catch(...)
  - All extract `cost_cents` via `extractGoogleCost` from generateObject's `usage` return
- `src/lib/eval/storage.ts` — `createRun → INSERT eval_runs status='running'` returns nanoid runId; `writeCase → INSERT eval_cases` with all judge fields populated; `updateRunStatus → UPDATE finished_at + totals + status`. All wrap Supabase errors with run/case context; emit Pino events `eval_run_created` / `eval_case_written` / `eval_run_finalized`.
- `src/lib/eval/agent-client.ts` — `callAgent({ targetUrl, prompt, sessionId }) → { response, httpStatus, rawBody }` and `parseChatStream(rawText) → string`. Single source of truth for the streaming-format regex; eliminates inline duplication across cat runners.
- `.eval-tmp/sample-stream.txt` — live capture from `npm run dev` /api/chat call. Used as test fixture and as the reference for the parser's docstring.
- `scripts/run-evals.ts` — CLI orchestrator: lifecycle (create row → 6 stub runners → aggregate → updateRunStatus → exit code), cost-warn at $1.50, Pino events. Exit 0 = all-pass, 1 = any-fail, 2 = orchestration error.
- `package.json` — `"eval": "node --env-file=.env.local --import tsx scripts/run-evals.ts"`.
- `.gitignore` — `.eval-tmp/*` excluded with `!.eval-tmp/sample-stream.txt` exception.
- 394/394 tests pass (full suite).
- Live sanity run: `npm run eval` exits 0 in ~940ms; runId `oB71C1smpEdI1Sg4NZ30b` confirmed in live Supabase eval_runs table.

## Task Commits

1. **Task 1: types + cost + yaml-loader (TDD, 19 tests)** — `e27d92a` (feat)
2. **Task 2: Gemini judge wrapper + Supabase eval storage (TDD, 12 tests)** — `c8282f9` (feat)
3. **Task 3: eval CLI orchestrator + npm run eval (end-to-end)** — `0fb8c0d` (feat)
4. **Task 4: agent-client.ts (DRY /api/chat helper) + live SSE fixture** — `95ce51d` (feat)

## Files Created/Modified

- `src/lib/eval/types.ts` (created) — 72 lines. Exports `EvalCase`, `EvalCaseResult`, `RunSummary`, `CategoryResult`, `Category`, `CategorySchema`, `EvalCaseSchema`. CategorySchema enum has 7 values matching DB check constraint exactly.
- `src/lib/eval/cost.ts` (created) — 86 lines. `WARN_THRESHOLD_CENTS = 150`. PRICES const has Sonnet 3.0/3.75/0.3/15.0, Haiku 1.0/5.0, Gemini 0.3/2.5. `projectRunCost(40) ≈ 133¢`.
- `src/lib/eval/yaml-loader.ts` (created) — 67 lines. Uses `import yaml from 'js-yaml'` (existing dep). zod safeParse with `.passthrough()`.
- `src/lib/eval/judge.ts` (created) — 119 lines. Three judge variants. `import { google } from '@ai-sdk/google'` + `import { generateObject } from 'ai'`. Cat1Verdict / VoiceVerdict / PersonaVerdict zod schemas exported.
- `src/lib/eval/storage.ts` (created) — 81 lines. `import { nanoid } from 'nanoid'`. Three exports + Pino childLogger.
- `src/lib/eval/agent-client.ts` (created, 126 lines) — `parseChatStream` scans for AI SDK v6 `data: {"type":"text-delta","delta":"..."}` events; tool-call/data/done lines ignored for the text channel. `callAgent` does fetch + text() + throws on non-OK; returns `{ response, httpStatus, rawBody }`.
- `.eval-tmp/sample-stream.txt` (created, 8 lines) — live AI SDK v6 capture fixture (text-start, text-delta, text-end, [DONE]).
- `scripts/run-evals.ts` (created, 148 lines) — CLI orchestrator. Imports `JUDGE_MODEL` from `@/lib/eval-models`; imports `createRun`, `updateRunStatus` from `@/lib/eval/storage`; imports `projectRunCost`, `WARN_THRESHOLD_CENTS` from `@/lib/eval/cost`. Defines 6 stub runners (cat1, cat2, cat3, cat4-judge, cat5, cat6) — each returns `{ category, cases: [], passed: true, cost_cents: 0 }`.
- `package.json` (modified, +2 lines) — `"eval": "node --env-file=.env.local --import tsx scripts/run-evals.ts"` script + dotenv devDep entry.
- `package-lock.json` (modified, +1 line for eval script + dotenv lock additions).
- `.gitignore` (modified, +8 lines) — `.eval-tmp/*` exclude + `!.eval-tmp/sample-stream.txt` exception.
- `tests/lib/eval/cost.test.ts` (created, 90 lines) — projector + Anthropic/Google extractor + WARN_THRESHOLD_CENTS literal.
- `tests/lib/eval/yaml-loader.test.ts` (created, 131 lines) — valid/malformed/missing-required/empty/passthrough cases.
- `tests/lib/eval/judge.test.ts` (created, 145 lines) — 3 judge variants + cost + error-wrapping.
- `tests/lib/eval/storage.test.ts` (created, 190 lines) — createRun + writeCase + updateRunStatus + duplicate-id + Pino events.
- `tests/lib/eval/agent-client.test.ts` (created, 128 lines) — 7 synthetic edge cases + 1 live-fixture round-trip + 3 callAgent paths (200 / non-OK / network-error).

## Decisions Made

- **Test path: `tests/lib/eval/` not `src/lib/__tests__/eval/`** — vitest config only includes `tests/**/*.test.{ts,tsx}`. Plan frontmatter listed src/lib/__tests__/ across all four tasks; followed established repo convention. Documented in test-file headers. Carried forward as the convention through Plans 05-04..05-07 (each had to auto-fix the same path issue).
- **AI SDK v6 SSE format deviation from plan**: plan example used `0:"..."`, `2:{...}`, `9:{...}` short-prefix codes (AI SDK v5). Live capture from `npm run dev` /api/chat showed v6 emits `data: {"type":"text-delta","delta":"..."}\n\n` event-stream — fundamentally different shape. Parser rewritten against the real v6 type union. Event types observed: text-start, text-delta, text-end, [DONE]. Tool-call events also follow `data: {"type":"tool-..."}` shape; parser ignores everything except text-delta.
- **Native --env-file over dotenv import**: tsx + ESM hoists `import` above statement-level `dotenvConfig()` calls, so any runtime dotenv firing happens AFTER `@/lib/env`'s zod parse already failed at module-init. Plan suggested `import 'dotenv/config'` but that loads `.env` not `.env.local`. Solution: `node --env-file=.env.local --import tsx scripts/run-evals.ts` (Node 20.6+ native flag) loads .env.local BEFORE any module evaluates.
- **callAgent expects real session_id**: BL-17 fix from Plan 05-01 made /api/chat validate session_id against Supabase. Synthetic ids 404. Eval cat runners must mint a real session via /api/session first OR use a fixture session. Documented in agent-client.ts comment block.
- **gitignore pattern matters**: `.eval-tmp/*` (with `*`) is required so git can still traverse into the directory and apply the negation `!.eval-tmp/sample-stream.txt`. `.eval-tmp/` (without `*`) blocks traversal entirely and the negation never applies — sample-stream.txt would not be tracked.
- **Stub-runner contract**: each cat runner must return `Promise<CategoryResult>` matching the orchestrator's destructure. Stubs return zero cases + passed:true so the run succeeds in CI on day one; Plans 05-04..05-09 replace each stub.

## Issues Encountered

- **AI SDK v6 SSE format mismatch with plan example**: addressed by rewriting parseChatStream against live capture; documented in agent-client.ts docstring.
- **dotenv vs --env-file env-loading**: addressed by switching the npm script to use Node's native --env-file flag.
- Pre-commit hooks ran cleanly on all 4 commits.

## User Setup Required

- **`GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`** — required for live judge calls. Without it, `judgeFactualFidelity`/`judgeVoiceFidelity`/`judgePersona` will error at the Gemini API call. Unit tests are mocked and pass without the key. This becomes the gating dependency for Plans 05-04..05-07 Task-4 live verification.

## Known Stubs

- `runCat1` through `runCat6` in scripts/run-evals.ts — Plans 05-04..05-09 replace each one with the real per-category runner. Plan 05-04 replaces `runCat1` first.

## Next Phase Readiness

- **Ready: Plan 05-04 (cat 1 fabrication)** — can import `loadCases`, `EvalCaseSchema` from yaml-loader; `judgeFactualFidelity`, `Cat1Verdict` from judge; `writeCase` from storage; `callAgent`, `parseChatStream` from agent-client; `EvalCase`, `CategoryResult` from types.
- **Ready: Plans 05-05/06/07** — same import surface; agent-client centralization means future SSE-format changes are one-file fixes.
- **Live verification deferred**: live judge runs require `GOOGLE_GENERATIVE_AI_API_KEY`. Joe sets the key → first opportunity is Plan 05-04 Task 4 (15/15 cat1 smoke).

## Self-Check: PASSED

- src/lib/eval/types.ts: FOUND (exports EvalCase, EvalCaseResult, RunSummary, CategoryResult, Category, CategorySchema, EvalCaseSchema)
- src/lib/eval/cost.ts: FOUND (WARN_THRESHOLD_CENTS = 150)
- src/lib/eval/yaml-loader.ts: FOUND
- src/lib/eval/judge.ts: FOUND (3 judge variants + estimateJudgeCost)
- src/lib/eval/storage.ts: FOUND (createRun + writeCase + updateRunStatus)
- src/lib/eval/agent-client.ts: FOUND (callAgent + parseChatStream)
- scripts/run-evals.ts: FOUND (148 lines; 6 stub runners)
- .eval-tmp/sample-stream.txt: FOUND (live AI SDK v6 fixture)
- package.json `eval` script: FOUND
- Test files at tests/lib/eval/: 5 files (cost, yaml-loader, judge, storage, agent-client)
- Commits: e27d92a, c8282f9, 0fb8c0d, 95ce51d — ALL FOUND
- Test count: 394/394 (per `95ce51d` commit body)
- Sanity run: `npm run eval` exit 0 in ~940ms; runId `oB71C1smpEdI1Sg4NZ30b` confirmed in live Supabase

---
*Phase: 05-eval-gates-launch*
*Completed: 2026-05-09*
