---
quick_id: 260509-sgn
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/eval/judge.ts
  - tests/lib/eval/judge.test.ts
autonomous: true
---

<objective>
Swap `src/lib/eval/judge.ts` from `@ai-sdk/anthropic` `generateObject` (Zod schema) to `@anthropic-ai/sdk` direct `messages.create()` with native forced tool-use (`tools: [...]` + `tool_choice: { type: 'tool', name: '...' }`). Keep existing `Cat1Verdict`, `VoiceVerdict`, `PersonaVerdict` Zod schemas as post-extraction validators on `tool_use.input` for defense-in-depth.

Purpose: close deferred-items.md item #3 (~47% Zod-validation failure rate against Anthropic Haiku 4.5 in cat1 smoke runId `IxmC5_FELINyClAEUyDmS`, 7/15 cases). Anthropic's native strict tool-use schema is materially more reliable than AI-SDK-shaped `generateObject` JSON prompting (per RESEARCH §4 — Plan 03-01 / `design-metric-framework.ts` precedent confirms this empirically). Simultaneously fixes item #5 (LOW, cost extraction reading `inputTokens`/`outputTokens` camelCase via `?? 0` fallbacks against an Anthropic-native usage shape that emits `input_tokens`/`output_tokens` snake_case, producing `totalCostCents:0`) by adapting the snake_case usage shape to the camelCase shape `extractAnthropicJudgeCost` already expects — without touching `cost.ts` or its locked tests.

Output: `src/lib/eval/judge.ts` rewritten against `anthropicClient()` (existing lazy singleton in `src/lib/anthropic.ts`); `tests/lib/eval/judge.test.ts` updated to mock `@anthropic-ai/sdk` as a constructable class. Public interface (function names, argument shapes, `Promise<{ verdict, cost_cents }>` returns, exported `Cat1Verdict`/`VoiceVerdict`/`PersonaVerdict` types) stays byte-stable so the four callers (cat1.ts, cat3.ts, cat4-judge.ts, cat5.ts) need zero edits.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/05-eval-gates-launch/deferred-items.md
@.planning/quick/260509-r39-swap-eval-judge-to-claude-haiku-4-5/260509-r39-PLAN.md
@src/lib/eval/judge.ts
@src/lib/eval/cost.ts
@src/lib/eval-models.ts
@src/lib/anthropic.ts
@src/lib/tools/design-metric-framework.ts
@src/app/api/cron/heartbeat/route.ts
@tests/lib/eval/judge.test.ts
@tests/lib/eval/cost.test.ts
@src/lib/eval/cats/cat1.ts
@src/lib/eval/cats/cat3.ts
@src/lib/eval/cats/cat4-judge.ts
@src/lib/eval/cats/cat5.ts

<interfaces>
<!-- Established patterns to mirror, NOT discover. -->

`anthropicClient()` (singleton, lazy) — from `src/lib/anthropic.ts`:
```typescript
export function anthropicClient(): Anthropic;     // new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
export const MODELS = { MAIN: 'claude-sonnet-4-6', CLASSIFIER: 'claude-haiku-4-5' };
```

`@anthropic-ai/sdk@0.90` Tool + ToolUseBlock types — already imported in `design-metric-framework.ts`:
```typescript
import type { Tool as AnthropicTool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
// AnthropicTool surfaces native `strict?: boolean` on the interface (messages.d.ts:1075).
// No StrictAnthropicTool extension needed.
```

`messages.create()` forced-tool pattern (from `design-metric-framework.ts` lines 89-109):
```typescript
const resp = await client.messages.create({
  model: JUDGE_MODEL,                                   // claude-haiku-4-5-20251001
  max_tokens: 1024,                                     // verdict + rationale fits comfortably
  system: '...',
  messages: [{ role: 'user', content: '...' }],
  tools: [VERDICT_TOOL],
  tool_choice: { type: 'tool' as const, name: '...' },  // `as const` narrows literal for SDK union
});
const toolUseBlock = resp.content.find((c): c is ToolUseBlock => c.type === 'tool_use');
if (!toolUseBlock) throw new Error('...');
const parsed = ZodSchema.parse(toolUseBlock.input);     // defense-in-depth post-extraction
```

`Anthropic.Messages.Usage` shape (from @anthropic-ai/sdk responses) — snake_case:
```typescript
type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  // ...
};
```

`extractAnthropicJudgeCost` (existing, in cost.ts, MUST stay unchanged — its tests are locked):
```typescript
export function extractAnthropicJudgeCost(usage: {
  inputTokens?: number;
  outputTokens?: number;
}): number;
```

Public judge.ts contract (callers depend on these — DO NOT change):
```typescript
export const Cat1Verdict: ZodObject<...>;
export const VoiceVerdict: ZodObject<...>;
export const PersonaVerdict: ZodObject<...>;
export type Cat1VerdictT, VoiceVerdictT, PersonaVerdictT;
export function judgeFactualFidelity(args: { prompt, response, groundedFacts, caseId }): Promise<{ verdict: Cat1VerdictT; cost_cents: number }>;
export function judgeVoiceFidelity(args: { response, voiceSamples, caseId }): Promise<{ verdict: VoiceVerdictT; cost_cents: number }>;
export function judgePersona(args: { prompt, response, personaCriterion, caseId }): Promise<{ verdict: PersonaVerdictT; cost_cents: number }>;
export function estimateJudgeCost(): number;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite judge.ts to native @anthropic-ai/sdk forced tool-use</name>
  <files>src/lib/eval/judge.ts</files>
  <behavior>
    After this task:
    - Three judge functions (`judgeFactualFidelity`, `judgeVoiceFidelity`, `judgePersona`) call `anthropicClient().messages.create({...})` with `tools: [VERDICT_TOOL]` + `tool_choice: { type: 'tool', name: '<verdict_tool_name>' }`. NOT `generateObject` from `ai`.
    - Each verdict has its own `AnthropicTool` definition: `name`, `description`, `input_schema` (JSON-Schema object hand-derived from the Zod schema; `strict: true`).
    - The forced tool-use block is extracted via `resp.content.find((c): c is ToolUseBlock => c.type === 'tool_use')`; missing block throws a wrapped error with `caseId`.
    - The extracted `toolUseBlock.input` is run through the existing `Cat1Verdict.parse(...)` / `VoiceVerdict.parse(...)` / `PersonaVerdict.parse(...)` Zod schema — defense-in-depth, mirrors `design-metric-framework.ts:109`. Public schema exports stay byte-identical (no Zod schema changes).
    - Cost extraction adapts the snake_case `resp.usage` (`input_tokens` / `output_tokens`) into the camelCase shape `extractAnthropicJudgeCost` expects: `extractAnthropicJudgeCost({ inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens })`. NO changes to `cost.ts` — its tests are locked at the camelCase shape.
    - Public function signatures (function names, argument shapes, return shape `Promise<{ verdict, cost_cents }>`) are byte-stable. Callers in cat1/cat3/cat4-judge/cat5 require zero edits.
    - `estimateJudgeCost()` is preserved unchanged (returns `1`).
    - The `import { generateObject } from 'ai'` line is removed.
    - The `import { anthropicProvider } from '@/lib/anthropic'` line is replaced with `import { anthropicClient } from '@/lib/anthropic'`.
    - New imports: `import Anthropic from '@anthropic-ai/sdk'` is NOT needed (use `anthropicClient()` factory). `import type { Tool as AnthropicTool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages'` IS needed.
    - The two SCHEMA CONSTRAINT header comments (auto-injected `min`/`max` integer bounds breaking generateObject path) are obsolete after this swap — REPLACE the file header with a fresh comment block explaining the native tool-use design and why the prior generateObject path was abandoned (reference deferred-items.md item #3 + runId `IxmC5_FELINyClAEUyDmS`).
    - JSON-Schema for tool inputs MAY include `enum` constraints (`verdict: { type: 'string', enum: ['pass', 'fail'] }`) since Anthropic's native strict tool-use validator supports `enum`. AVOID `minimum`/`maximum` on integer types (rejected by Anthropic per the prior r39 SCHEMA CONSTRAINT — preserve that learning). Score fields stay as `{ type: 'number' }` and the prompt enforces 1-5 Likert.
    - `max_tokens` default for each call: `1024` (rationale max=400 chars + verdict + score + boolean fits comfortably in <800 output tokens; 1024 leaves headroom).
  </behavior>
  <action>
    1. Read `src/lib/eval/judge.ts` (current implementation), `src/lib/anthropic.ts` (anthropicClient pattern), and `src/lib/tools/design-metric-framework.ts` (the canonical native-tool-use precedent).

    2. Rewrite `src/lib/eval/judge.ts` end-to-end. Preserve all three function signatures, the three exported Zod schemas, the three exported `*VerdictT` types, and `estimateJudgeCost`.

    3. Replace the file header comment block. Drop the two SCHEMA CONSTRAINT (`.int()` auto-bounds) callouts — they're specific to the dead generateObject path. Add a fresh comment explaining: native @anthropic-ai/sdk forced tool-use; Zod schemas retained as post-extraction validators (defense-in-depth, mirrors design-metric-framework.ts); reference deferred-items.md item #3 + runId `IxmC5_FELINyClAEUyDmS` (~47% Zod-fail under generateObject) as the motivating signal; reference item #5 (cost extraction snake_case → camelCase adapter) as the secondary fix; note the JSON-Schema constraint that `minimum`/`maximum` on integer types are still rejected by Anthropic (preserve learning from r39 commits `2e6e43b` + `fe612a8`).

    4. Define three `AnthropicTool` constants at module scope, mirroring `OUTPUT_METRIC_FRAMEWORK_TOOL` in design-metric-framework.ts:
       - `OUTPUT_CAT1_VERDICT_TOOL` — name `output_cat1_verdict`; required: score, verdict, fabrication_detected, rationale; `score: { type: 'number' }` (no min/max), `verdict: { type: 'string', enum: ['pass', 'fail'] }`, `fabrication_detected: { type: 'boolean' }`, `rationale: { type: 'string', maxLength: 400 }`; `additionalProperties: false`; `strict: true`.
       - `OUTPUT_VOICE_VERDICT_TOOL` — name `output_voice_verdict`; required: diction, hedge_density, sentence_rhythm, concreteness, filler_absence, average, rationale; all 5 dim fields + `average` as `{ type: 'number' }`; `rationale: { type: 'string', maxLength: 400 }`; `additionalProperties: false`; `strict: true`.
       - `OUTPUT_PERSONA_VERDICT_TOOL` — name `output_persona_verdict`; required: score, verdict, rationale; `score: { type: 'number' }`, `verdict: { type: 'string', enum: ['pass', 'fail'] }`, `rationale: { type: 'string', maxLength: 400 }`; `additionalProperties: false`; `strict: true`.

       NOTE: Anthropic's input_schema validator accepts `maxLength` on string types and `enum` on string types (verified in the metric-framework precedent — those enum/maxLength patterns are used and pass live calls). It rejects `minimum`/`maximum` on integer types per r39 commits — keep `score` ungated at JSON-Schema layer; rely on prompt + Zod post-validation.

    5. Reuse the `judgeFactualFidelity` system prompt verbatim (it's well-tuned). Reuse the `judgeVoiceFidelity` user prompt verbatim (the 5-dimension rubric is well-tuned). Reuse the `judgePersona` system prompt verbatim. Append to the user-message body of each: a one-line "Output by calling the `<tool_name>` tool exactly once." nudge — Anthropic's `tool_choice: { type: 'tool', name: ... }` already forces the call, but the nudge keeps the prompt explicit and matches design-metric-framework.ts:31-32 phrasing ("Return ONLY the structured tool call. Do not narrate.").

    6. Each function body becomes:
       ```typescript
       const client = anthropicClient();
       const resp = await client.messages.create({
         model: JUDGE_MODEL,                          // import from @/lib/eval-models
         max_tokens: 1024,
         system: '<verbatim system prompt>',
         messages: [{ role: 'user', content: '<verbatim user prompt>' }],
         tools: [VERDICT_TOOL],
         tool_choice: { type: 'tool' as const, name: '<verdict_tool_name>' },
       }).catch((e) => {
         throw new Error(`<funcName> failed for case=${args.caseId}: ${(e as Error).message}`);
       });
       const toolUseBlock = resp.content.find(
         (c): c is ToolUseBlock => c.type === 'tool_use',
       );
       if (!toolUseBlock) {
         throw new Error(`<funcName> failed for case=${args.caseId}: no tool_use block`);
       }
       const verdict = ZodSchema.parse(toolUseBlock.input);
       const cost_cents = extractAnthropicJudgeCost({
         inputTokens: resp.usage.input_tokens,
         outputTokens: resp.usage.output_tokens,
       });
       return { verdict, cost_cents };
       ```
       Three nearly-identical blocks (one per function); the differences are: tool def, system prompt, user prompt body, Zod schema, error prefix string. Inline-duplicate (mirrors current file structure — three discrete functions, no helper extraction); a shared `runJudge<T>()` helper is over-abstraction for three call sites.

    7. Wrap-error rejection prefixes MUST be exactly `judgeFactualFidelity failed for case=`, `judgeVoiceFidelity failed for case=`, `judgePersona failed for case=` — `judge.test.ts` asserts these regex prefixes (cf. lines 109, 175 of the current test file). Do not rename.

    8. `estimateJudgeCost()` body and return value unchanged.

    9. Run `npx tsc --noEmit` to verify zero new TypeScript errors. (The pre-existing `src/components/ChatUI.tsx(46,16)` error documented in deferred-items.md is unchanged and out-of-scope — verify it's the only remaining error.)
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -v "src/components/ChatUI.tsx(46,16)" | grep "error TS" ; if [ $? -eq 0 ]; then echo "NEW TYPE ERRORS DETECTED"; exit 1; else echo "OK — only pre-existing ChatUI error remains"; fi</automated>
  </verify>
  <done>
    - `src/lib/eval/judge.ts` no longer imports `generateObject` from `ai` or `anthropicProvider` from `@/lib/anthropic`.
    - File imports `anthropicClient` from `@/lib/anthropic` and types `Tool as AnthropicTool, ToolUseBlock` from `@anthropic-ai/sdk/resources/messages`.
    - Three `AnthropicTool` constants exist at module scope with `strict: true` and `additionalProperties: false`.
    - Each judge function uses `client.messages.create({ tools, tool_choice })`, extracts the `tool_use` block, parses through the existing Zod schema, and adapts snake_case usage to camelCase before calling `extractAnthropicJudgeCost`.
    - `npx tsc --noEmit` reports zero new errors (the pre-existing ChatUI.tsx(46,16) error documented in deferred-items.md is unchanged).
    - Public exports (function names, schema names, type names) byte-identical to pre-change file (verifiable by `grep "^export" src/lib/eval/judge.ts` matching the pre-change set).
    - `cost.ts` and `tests/lib/eval/cost.test.ts` UNCHANGED.
    - Callers (`src/lib/eval/cats/cat1.ts`, `cat3.ts`, `cat4-judge.ts`, `cat5.ts`) UNCHANGED.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Update judge.test.ts to mock @anthropic-ai/sdk as constructable class</name>
  <files>tests/lib/eval/judge.test.ts</files>
  <behavior>
    After this task:
    - Test file mocks `@anthropic-ai/sdk` (the package, default export = `Anthropic` class) instead of `ai` (the `generateObject` function) and `@/lib/anthropic` (the project module).
    - The `@anthropic-ai/sdk` mock is a constructable class — `new Anthropic({ apiKey })` must succeed (Plan 03-00 STATE.md learning: arrow `vi.fn()` is not constructible; required for `anthropicClient()` `new Anthropic(...)` call).
    - Each test stages a `messages.create` resolved value of shape `{ content: [{ type: 'tool_use', input: { ... verdict object ... } }], usage: { input_tokens: N, output_tokens: M } }` (snake_case — native Anthropic shape).
    - The cost-lock test (current `judgeFactualFidelity` test "computes Haiku-priced cost_cents exactly") stages `usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 }` and asserts `result.cost_cents === 600` — proves the snake_case→camelCase adapter wires through correctly. THIS IS THE CRITICAL ITEM #5 GUARD.
    - Error tests stage rejection from `messages.create` and assert the wrapper-prefix regex (`/judgeFactualFidelity failed for case=cat1-case-fail/`, `/judgePersona failed for case=cat3-err/`).
    - Add ONE new test under `judgeFactualFidelity`: when `messages.create` resolves with `content: []` (no tool_use block), it rejects with `/judgeFactualFidelity failed for case=.*no tool_use block/`. Locks the missing-block path added in Task 1.
    - The `vi.mock('@/lib/env', ...)` block is preserved verbatim (Plan 03-00 secret-scan-bypass pattern).
    - The existing `vi.mock('ai', ...)` block is REMOVED.
    - The existing `vi.mock('@/lib/anthropic', ...)` block is REMOVED.
    - All existing assertions on `result.verdict.score`, `result.verdict.verdict`, `result.verdict.fabrication_detected`, `result.verdict.rationale`, `result.verdict.diction` etc., `result.cost_cents` continue to pass — public function contract is locked by the test.
    - `estimateJudgeCost()` test unchanged.
  </behavior>
  <action>
    1. Read current `tests/lib/eval/judge.test.ts`.

    2. Replace the two mock blocks (`vi.mock('ai', ...)` and `vi.mock('@/lib/anthropic', ...)`) with a single `@anthropic-ai/sdk` class mock. Pattern (mirrors `tests/lib/exa.test.ts` Plan 03-00 + heartbeat route test):
       ```typescript
       const messagesCreateMock = vi.fn();
       vi.mock('@anthropic-ai/sdk', () => ({
         default: class MockAnthropic {
           public messages = { create: messagesCreateMock };
           constructor(_opts: { apiKey: string }) {
             // accept and ignore apiKey
           }
         },
       }));
       ```
       Note: the project's `anthropicClient()` calls `new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })`, so the mock must be a class with a `constructor` that accepts an options object. The shared `messagesCreateMock` `vi.fn()` lives outside the class so each test can `messagesCreateMock.mockResolvedValueOnce(...)` / `mockRejectedValueOnce(...)`.

    3. Update `beforeEach` to call `messagesCreateMock.mockReset()` (was `generateObjectMock.mockReset()`).

    4. Update each test's `mockResolvedValueOnce` to the new return shape:
       - OLD: `{ object: { score: 5, verdict: 'pass', ... }, usage: { inputTokens: 1500, outputTokens: 200 } }`
       - NEW: `{ content: [{ type: 'tool_use', input: { score: 5, verdict: 'pass', fabrication_detected: false, rationale: '...' } }], usage: { input_tokens: 1500, output_tokens: 200 } }`

       Apply this transformation to the four currently-resolving test stages (one per: cat1 happy path, cat1 cost lock, cat4 voice happy path, cat3 persona happy path).

    5. Update each error test's `mockRejectedValueOnce` — no shape change needed (error is still raw `Error('...')`); mocked function is now `messagesCreateMock` not `generateObjectMock`.

    6. Add a new test inside `describe('judgeFactualFidelity (cat 1)', ...)`:
       ```typescript
       it('rejects with caseId when response contains no tool_use block', async () => {
         messagesCreateMock.mockResolvedValueOnce({
           content: [],     // no tool_use block — defensive path Task 1 added
           usage: { input_tokens: 100, output_tokens: 0 },
         });
         const { judgeFactualFidelity } = await import('@/lib/eval/judge');
         await expect(
           judgeFactualFidelity({
             prompt: 'p',
             response: 'r',
             groundedFacts: [],
             caseId: 'cat1-no-toolblock',
           }),
         ).rejects.toThrow(/judgeFactualFidelity failed for case=cat1-no-toolblock.*no tool_use block/);
       });
       ```

    7. Run the targeted test file to confirm green:
       `npx vitest run tests/lib/eval/judge.test.ts`

    8. Run `tests/lib/eval/cost.test.ts` UNCHANGED to confirm it passes (proves item #5 via the field-name lock — extractor still works against the camelCase shape Task 1 adapts to):
       `npx vitest run tests/lib/eval/cost.test.ts`

    9. Run the full suite to verify no regression elsewhere:
       `npm test`
  </action>
  <verify>
    <automated>npx vitest run tests/lib/eval/judge.test.ts tests/lib/eval/cost.test.ts</automated>
  </verify>
  <done>
    - `tests/lib/eval/judge.test.ts` mocks `@anthropic-ai/sdk` as a constructable class with `messages.create = messagesCreateMock` shared instance method.
    - No `vi.mock('ai', ...)` or `vi.mock('@/lib/anthropic', ...)` lines remain.
    - All staged `mockResolvedValueOnce` payloads return `{ content: [{ type: 'tool_use', input: {...} }], usage: { input_tokens, output_tokens } }` (snake_case).
    - New `cat1-no-toolblock` test asserts the missing-tool-use-block error path.
    - `npx vitest run tests/lib/eval/judge.test.ts` reports all tests passing (count = previous count + 1 new test).
    - `npx vitest run tests/lib/eval/cost.test.ts` passes UNCHANGED (the file itself was not edited — proves item #5 fix flows through the cost extractor without altering cost.ts or its locked tests).
  </done>
</task>

<task type="auto">
  <name>Task 3: Full-suite verification — typecheck + tests + caller stability</name>
  <files>(no edits — verification only)</files>
  <action>
    1. Run `npx tsc --noEmit`. Expect exactly one pre-existing error: `src/components/ChatUI.tsx(46,16)` (deferred-items.md item, unchanged). Any new error means caller drift — investigate and either fix forward or revert.

    2. Run `npm test` (full vitest suite). Confirm the suite passes at the same case count as STATE.md last-known-green (the r39 close-out reference is 416/416 from commit `7913596`, but post-r39 commits may have added cases; the bar is "all green at >= prior count + 1 new test added in Task 2").

    3. Confirm callers byte-stable — run a structural diff to prove no caller files were touched:
       ```bash
       git diff --name-only HEAD -- src/lib/eval/cats/cat1.ts src/lib/eval/cats/cat3.ts src/lib/eval/cats/cat4-judge.ts src/lib/eval/cats/cat5.ts src/lib/eval/cost.ts tests/lib/eval/cost.test.ts
       ```
       Expected output: empty (no modifications). If any of these files appear, public-interface stability was broken — investigate.

    4. Confirm `git diff --stat` shows ONLY `src/lib/eval/judge.ts` and `tests/lib/eval/judge.test.ts` modified.

    5. Optional (NOT required for done):
       - Run a single live cat1 case against `EVAL_TARGET_URL=http://localhost:3000` (requires the dev server running and ANTHROPIC_API_KEY set) to observe `totalCostCents > 0` on the runtime path — proves item #5 in production. Per the task brief, "Live verification is OPTIONAL — code-complete + tests-green is the bar for this quick task; live smoke is captured as a follow-up note."
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "src/components/ChatUI.tsx(46,16)" ; if [ $? -eq 0 ]; then echo "NEW TS ERRORS"; exit 1; fi ; npm test ; git diff --name-only HEAD -- src/lib/eval/cats/cat1.ts src/lib/eval/cats/cat3.ts src/lib/eval/cats/cat4-judge.ts src/lib/eval/cats/cat5.ts src/lib/eval/cost.ts tests/lib/eval/cost.test.ts | tee /tmp/caller-drift.txt ; if [ -s /tmp/caller-drift.txt ]; then echo "CALLER DRIFT DETECTED"; exit 1; fi ; echo "OK"</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` shows ONLY the pre-existing ChatUI.tsx(46,16) error (unchanged from baseline).
    - `npm test` passes — full vitest suite green at prior count + 1 (the new cat1-no-toolblock test added in Task 2).
    - `git diff --name-only HEAD` lists EXACTLY `src/lib/eval/judge.ts` and `tests/lib/eval/judge.test.ts` (no caller drift, no cost.ts drift, no cost.test.ts drift).
    - Item #3 status downgraded from MEDIUM (open) to RESOLVED (close-out note in SUMMARY).
    - Item #5 status downgraded from LOW (open) to RESOLVED-pending-live-verify (close-out note in SUMMARY; the unit-test path proves the camelCase adapter; live verify is the optional follow-up).
  </done>
</task>

</tasks>

<verification>
End-state check:
- `src/lib/eval/judge.ts` uses `@anthropic-ai/sdk` direct + native forced tool-use (`tools: [...]` + `tool_choice: { type: 'tool', name: ... }`); Zod schemas retained as post-extraction validators.
- `src/lib/eval/judge.ts` adapts snake_case `resp.usage.input_tokens` / `output_tokens` into the camelCase shape `extractAnthropicJudgeCost` expects, fixing item #5 without touching `cost.ts` or its locked tests.
- `tests/lib/eval/judge.test.ts` mocks `@anthropic-ai/sdk` as a constructable class with shared `messages.create` mock instance; all prior tests pass with the new shape; one new test locks the missing-tool-use-block defensive path.
- `tests/lib/eval/cost.test.ts` passes UNCHANGED — proves the extractor wiring is intact and item #5 is fixed end-to-end.
- Public interface of `judge.ts` byte-stable. Callers in `cat1.ts`, `cat3.ts`, `cat4-judge.ts`, `cat5.ts` require zero edits and the git diff confirms it.
- `npx tsc --noEmit` reports only the pre-existing ChatUI.tsx error (deferred-items.md, out-of-scope).
- `npm test` passes the full suite.
</verification>

<success_criteria>
- Code-complete: judge.ts on native @anthropic-ai/sdk forced tool-use; tests green for judge + cost test files; full suite green; zero new TS errors; zero caller drift.
- Item #3 (judge schema flakiness, MEDIUM): RESOLVED at the unit-test layer. Native strict tool-use schema + post-extraction Zod validation eliminates the AI-SDK generateObject failure mode that produced ~47% Zod-validation failures in cat1 smoke runId `IxmC5_FELINyClAEUyDmS`. Live verification (optional, not gating this quick task): a fresh cat1 smoke against `EVAL_TARGET_URL=http://localhost:3000` should show 0% schema-validation fail rate (down from 47%) and unblock Plan 05-04/06/07 Task 4 sign-off.
- Item #5 (cost extraction, LOW): RESOLVED at the unit-test layer. The snake_case→camelCase adapter in each judge function ensures `extractAnthropicJudgeCost` reads real token counts (not `?? 0` fallbacks). The "computes Haiku-priced cost_cents exactly" test in judge.test.ts (`1M input + 1M output → 600 cents`) is now staged through the snake_case path and locks the wiring.
</success_criteria>

<output>
After completion, append a close-out section to `.planning/quick/260509-sgn-judge-schema-flakiness-fix-swap-src-lib-/CLOSE-OUT.md` (or create it) covering:
- Items #3 + #5 status update for `.planning/phases/05-eval-gates-launch/deferred-items.md` (mark item #3 RESOLVED via Plan 260509-sgn; mark item #5 RESOLVED-pending-live-verify).
- Final test count delta (prior count → new count).
- Final commit SHA.
- Optional: live cat1 smoke runId + per-case fail count if Joe runs the verification step.

Update STATE.md "Quick Tasks Completed" table with the new row (id `260509-sgn`, description "judge schema flakiness fix — native @anthropic-ai/sdk forced tool-use", date, commit SHA, status DONE/PARTIAL).
</output>
