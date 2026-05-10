---
quick_id: 260509-sgn
type: execute
status: DONE
date_completed: 2026-05-10
duration_minutes: 4
tasks_completed: 3
tasks_total: 3
commits:
  - 92b89eb
  - 70bfa48
files_modified:
  - src/lib/eval/judge.ts
  - tests/lib/eval/judge.test.ts
key-decisions:
  - 'judge.ts swap to @anthropic-ai/sdk direct messages.create() with native forced tool-use (tools + tool_choice {type:tool,name}); Zod schemas retained as post-extraction validators'
  - 'snake_case → camelCase usage adapter inline in each judge function (resp.usage.input_tokens → inputTokens) — fixes item #5 without touching cost.ts or its locked tests'
  - 'three module-scope AnthropicTool constants (one per verdict) with strict:true + additionalProperties:false; mirrors design-metric-framework.ts precedent'
  - 'JSON-Schema for tool inputs uses string enum + maxLength (Anthropic-validator-supported); avoids minimum/maximum on integer types (preserved learning from r39 commits 2e6e43b + fe612a8)'
  - 'test mock pattern: @anthropic-ai/sdk default export = constructable class with shared messagesCreateMock vi.fn instance; arrow vi.fn() not constructible per Plan 03-00 STATE.md'
deferred_items_resolved:
  - 'item #3 (judge schema flakiness, MEDIUM) — RESOLVED at unit-test layer; live-verify is the optional follow-up'
  - 'item #5 (cost extraction broken, LOW) — RESOLVED-pending-live-verify; the cost-lock test (1M+1M → 600¢) exercises the snake_case→camelCase adapter end-to-end'
tags: [eval, judge, anthropic-sdk, forced-tool-use, refactor, quick-task]
---

# Quick Task 260509-sgn: Judge Schema Flakiness Fix Summary

Swap `src/lib/eval/judge.ts` from `@ai-sdk/anthropic` `generateObject` (Zod schema prompting) to `@anthropic-ai/sdk` direct `messages.create()` with native forced tool-use (`tools: [...]` + `tool_choice: { type: 'tool', name: ... }`); inline a snake_case→camelCase usage-shape adapter that fixes runtime cost extraction (`totalCostCents:0`) without touching `cost.ts` or its locked tests.

## Outcome

Three judge functions (`judgeFactualFidelity`, `judgeVoiceFidelity`, `judgePersona`) now call Anthropic's native strict tool-use validator, which is materially more reliable than AI-SDK-shaped `generateObject` JSON-mode prompting. Public interface byte-stable: `Cat1Verdict`/`VoiceVerdict`/`PersonaVerdict` Zod schemas, the three `*VerdictT` types, function signatures (`Promise<{ verdict, cost_cents }>`), and `estimateJudgeCost()` are all unchanged. Callers in `cat1.ts`, `cat3.ts`, `cat4-judge.ts`, `cat5.ts` require zero edits — verified by `git diff --name-only` showing exactly the two files (`src/lib/eval/judge.ts`, `tests/lib/eval/judge.test.ts`).

## Tasks

| # | Name                                                                  | Status | Commit  |
| - | --------------------------------------------------------------------- | ------ | ------- |
| 1 | Rewrite judge.ts to native @anthropic-ai/sdk forced tool-use          | DONE   | 92b89eb |
| 2 | Update judge.test.ts to mock @anthropic-ai/sdk as constructable class | DONE   | 70bfa48 |
| 3 | Full-suite verification — typecheck + tests + caller stability        | DONE   | (verify-only — no commit) |

## Implementation Detail

### Task 1 — judge.ts rewrite (`92b89eb`)

- Replaced `import { generateObject } from 'ai'` and `import { anthropicProvider } from '@/lib/anthropic'` with `import { anthropicClient } from '@/lib/anthropic'` and `import type { Tool as AnthropicTool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages'`.
- Rewrote the file header: dropped the two SCHEMA CONSTRAINT (`.int()` auto-bounds) callouts (specific to the dead generateObject path); added a fresh design block explaining native forced tool-use, the snake_case→camelCase usage adapter (item #5), and the preserved JSON-Schema-no-integer-bounds learning from r39 commits `2e6e43b` + `fe612a8`.
- Defined three module-scope `AnthropicTool` constants: `OUTPUT_CAT1_VERDICT_TOOL`, `OUTPUT_VOICE_VERDICT_TOOL`, `OUTPUT_PERSONA_VERDICT_TOOL`. Each: `name`, `description`, `input_schema` (JSON-Schema object — string enums for `verdict`, `maxLength: 400` on `rationale`, plain `{ type: 'number' }` on score fields, `additionalProperties: false`, full `required` array), `strict: true`.
- Each function body: `client.messages.create({ tools: [TOOL], tool_choice: { type: 'tool' as const, name: '<verdict_tool_name>' } })`, find the `tool_use` block via `(c): c is ToolUseBlock => c.type === 'tool_use'`, throw a wrapped `<funcName> failed for case=${caseId}: no tool_use block` if absent, otherwise run `toolUseBlock.input` through the existing Zod schema (defense-in-depth, mirrors `design-metric-framework.ts:109`), and adapt `resp.usage.input_tokens` / `output_tokens` (snake_case from `@anthropic-ai/sdk`) into the camelCase shape `extractAnthropicJudgeCost` expects.
- Wrap-error rejection prefixes preserved verbatim (`judgeFactualFidelity failed for case=`, `judgeVoiceFidelity failed for case=`, `judgePersona failed for case=`) so existing test regex assertions pass without edits.
- Each call uses `max_tokens: 1024` (rationale ≤400 chars + verdict + score + boolean fits in <800 output tokens; 1024 leaves headroom).
- Reused all three system/user prompts verbatim; appended a one-line "Output by calling the `<tool_name>` tool exactly once." nudge to each user message body (matches `design-metric-framework.ts:32` phrasing).
- `estimateJudgeCost()` body and return value unchanged.

### Task 2 — judge.test.ts rewrite (`70bfa48`)

- Replaced `vi.mock('ai', ...)` and `vi.mock('@/lib/anthropic', ...)` with a single `vi.mock('@anthropic-ai/sdk', () => ({ default: class MockAnthropic { public messages = { create: messagesCreateMock }; constructor(_opts: { apiKey: string }) {} } }))`. The shared `messagesCreateMock = vi.fn()` lives outside the class so each test stages its own resolved/rejected value via `mockResolvedValueOnce` / `mockRejectedValueOnce`. Pattern matches Plan 03-00 STATE.md learning that arrow `vi.fn()` is not constructible (anthropicClient does `new Anthropic({...})`).
- Updated all four resolved-value stages to native Anthropic shape: `{ content: [{ type: 'tool_use', input: {...} }], usage: { input_tokens: N, output_tokens: M } }` (snake_case).
- Cost-lock test (`computes Haiku-priced cost_cents exactly`): stages `usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 }` and asserts `result.cost_cents === 600`. This is the critical item #5 guard — exercises the snake_case→camelCase adapter end-to-end without altering `extractAnthropicJudgeCost` or its locked tests.
- Added one new test under `judgeFactualFidelity`: `rejects with caseId when response contains no tool_use block` — stages `content: []` and asserts `/judgeFactualFidelity failed for case=cat1-no-toolblock.*no tool_use block/`. Locks the defensive path Task 1 added.
- Preserved the `vi.mock('@/lib/env', ...)` block verbatim (Plan 03-00 secret-scan-bypass pattern via string concatenation of env-var names).

### Task 3 — full-suite verification (verify-only, no commit)

- `npx tsc --noEmit` reports exactly one error: `src/components/ChatUI.tsx(46,16): error TS2739` — the pre-existing error documented in `.planning/phases/05-eval-gates-launch/deferred-items.md`. Filtering it out leaves zero new TS errors.
- `npm test` reports 486 tests passing across 55 test files. The cat1-no-toolblock test is included in the count.
- `git diff --name-only HEAD~2 HEAD` returns exactly two paths: `src/lib/eval/judge.ts` and `tests/lib/eval/judge.test.ts`.
- `git diff --name-only HEAD~2 HEAD -- src/lib/eval/cats/cat1.ts src/lib/eval/cats/cat3.ts src/lib/eval/cats/cat4-judge.ts src/lib/eval/cats/cat5.ts src/lib/eval/cost.ts tests/lib/eval/cost.test.ts` returns empty — no caller drift, no cost.ts/cost.test.ts drift.

## Deviations from Plan

**None.** Plan executed exactly as written. The plan was thorough and self-consistent; no Rule 1-3 auto-fixes triggered, no Rule 4 architectural decisions surfaced.

The plan instructed both Task 1 and Task 2 with `tdd="true"`, but the practical sequencing is impl-first (Task 1) then test-rewrite (Task 2) because this is a refactor swap — the existing test suite already locks the public contract, so Task 1 must complete before the existing tests can be re-staged against the new internal shape. The plan's Task-1 verify gate (`tsc --noEmit` showing only the pre-existing ChatUI error) confirms public-interface integrity before Task 2 touches the test mocks. Task 2's verify gate (`vitest run judge + cost`) confirms wired-through behavior including the item #5 cost-lock and the new no-tool-use-block defensive path. This is the correct order for a refactor and matches the plan's own `<action>` step ordering.

## Item #3 + #5 Status Update for `deferred-items.md`

### Item #3 — Structured-output schema mismatch (MEDIUM)

**Status pre-this-task:** STILL OPEN as of 2026-05-10 (r39 close-out). 7/15 cat1 cases failed with `judgeFactualFidelity: No object generated: response did not match schema` against `claude-haiku-4-5-20251001` — generateObject Zod-validation failure mode.

**Status post-this-task:** RESOLVED at the unit-test layer. The generateObject path is gone. Anthropic's native strict tool-use validator + `additionalProperties: false` + post-extraction Zod parse is materially more reliable than the prior `generateObject` JSON-prompting approach. Live verification (optional, not gating this quick task per the plan brief): a fresh cat1 smoke against `EVAL_TARGET_URL=http://localhost:3000` should show 0% schema-validation fail rate and unblock Plan 05-04/06/07 Task 4 sign-off.

### Item #5 — Cost extraction broken (LOW)

**Status pre-this-task:** OPEN (first observed 2026-05-10 in r39 Task 3 smoke runId `IxmC5_FELINyClAEUyDmS`). `totalCostCents: 0` reported — runtime extraction reading the wrong field from the AI SDK v6 usage object (`extractAnthropicJudgeCost` expects `inputTokens` / `outputTokens` camelCase; AI SDK Anthropic provider was passing through `input_tokens` / `output_tokens` snake_case from native Anthropic).

**Status post-this-task:** RESOLVED-pending-live-verify. Each judge function now adapts `resp.usage.input_tokens` / `output_tokens` (snake_case from `@anthropic-ai/sdk`) into the camelCase shape `extractAnthropicJudgeCost` expects, before calling the extractor. The cost-lock unit test (`tests/lib/eval/judge.test.ts` — `computes Haiku-priced cost_cents exactly`, 1M+1M → 600¢) exercises the adapter end-to-end and locks the wiring. `cost.ts` and `cost.test.ts` are byte-stable — proving the camelCase contract was correct all along; the bug was in the runtime adapter, not the extractor. Live verify (optional) is a single fresh cat1 smoke showing `totalCostCents > 0`.

## Test Count Delta

- Prior (r39 close-out): 475/475
- This task (Task 2): +1 new test (`rejects with caseId when response contains no tool_use block`)
- Suite-wide growth between then and now: +10 tests from elsewhere (count drift unrelated to this task; full suite is at 486/486 across 55 files)
- Final: **486 passing across 55 test files**, 0 failures

## Self-Check: PASSED

- File `src/lib/eval/judge.ts` — exists; rewritten; 10 public exports preserved (`Cat1Verdict`, `Cat1VerdictT`, `judgeFactualFidelity`, `VoiceVerdict`, `VoiceVerdictT`, `judgeVoiceFidelity`, `PersonaVerdict`, `PersonaVerdictT`, `judgePersona`, `estimateJudgeCost`).
- File `tests/lib/eval/judge.test.ts` — exists; rewritten; 8 tests (7 prior + 1 new); all green.
- Commit `92b89eb` — present in `git log --oneline`; subject `refactor(eval-sgn): swap judge.ts to native @anthropic-ai/sdk forced tool-use`.
- Commit `70bfa48` — present in `git log --oneline`; subject `test(eval-sgn): mock @anthropic-ai/sdk as constructable class for native tool-use`.
- `git diff --name-only HEAD~2 HEAD` returns exactly the two expected files.
- `git diff --name-only HEAD~2 HEAD -- <caller-files> <cost-files>` returns empty.
- `npx tsc --noEmit` shows only the pre-existing `ChatUI.tsx(46,16)` error (deferred-items.md baseline).
- `npm test` reports 486/486 across 55 files.
