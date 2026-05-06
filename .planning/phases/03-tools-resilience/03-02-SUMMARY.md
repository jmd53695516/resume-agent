---
phase: 03-tools-resilience
plan: 02
subsystem: api-route
tags: [api-route, streamtext, tool-wiring, prepare-step, persistence, onfinish, heartbeat, six-gate-order, w4-fix, w7-fix]

# Dependency graph
requires:
  - phase: 03-tools-resilience
    plan: 00
    provides: Pino childLogger / log(); redis client (.set with {ex} TTL); supabaseAdmin
  - phase: 03-tools-resilience
    plan: 01
    provides: research_company / get_case_study / design_metric_framework AI SDK v6 tools; enforceToolCallDepthCap PrepareStepCallback; tools/index.ts barrel
  - phase: 03-tools-resilience
    plan: 04
    provides: heartbeat-trust strategy in src/lib/health.ts that READS the keys this plan WRITES (heartbeat:anthropic, heartbeat:classifier @ ex:120)
  - phase: 02-safe-chat-core
    provides: six-gate prelude (body / session / 30-turn cap / spend cap / rate limits / classifier); persistNormalTurn + persistDeflectionTurn; system-prompt cacheControl shape; streamText config (stopWhen, maxOutputTokens)
provides:
  - persistToolCallTurn({session_id, steps}) — flatMaps multi-step tool calls into messages-table rows (role='tool', sdk_message_id=toolCallId, tool_args jsonb, tool_result jsonb)
  - /api/chat streamText config extended with tools + prepareStep (no regression on stopWhen / maxOutputTokens / six-gate prelude)
  - /api/chat onFinish: heartbeat:anthropic + heartbeat:classifier Redis keys written FIRST in their own try/catch (W4 — decoupled from persistence) with TTL 120s
  - /api/chat onFinish: persistToolCallTurn called AFTER persistNormalTurn and BEFORE incrementSpend/incrementIpCost
  - W7 durable-defense test (tests/api/chat-six-gate-order.test.ts) asserting canonical six-gate sequence via side-effect-recording mocks
affects: [03-03-walkthrough-tool, 03-04-resilience-degradation (heartbeat reader will now see live values), 04-admin (transcript view will surface tool rows)]

# Tech tracking
tech-stack:
  added: []  # All deps already installed by Plan 03-00 + 03-01
  patterns:
    - "W4 decoupled-onFinish pattern: heartbeat writes in their own try/catch ABOVE the persistence try/catch — neither failure path can corrupt the other"
    - "W7 side-effect-recording mock pattern: each gate's underlying call pushes a fixed identifier into a shared array; assertion is deep-equal on the canonical sequence — durable defense against silent reordering"
    - "Tool-call persistence separation: TOOL-08 lock holds — tool execute fns are read-only; messages-table writes happen ONLY in /api/chat/route.ts onFinish via persistToolCallTurn"
    - "AI SDK v6 streamText config additive pattern: tools + prepareStep added INSIDE existing config object; six-gate prelude above streamText is byte-unchanged"
    - "Schema column name correction: tool_result (matches migration); CONTEXT D-E-04's tool_response was a documentation typo — corrected at the persistence boundary"
    - "Heartbeat key short form: heartbeat:anthropic / heartbeat:classifier (single source of truth; matches Plan 03-04 reader)"

key-files:
  created:
    - tests/lib/persistence.test.ts
    - tests/api/chat-tools.test.ts
    - tests/api/chat-six-gate-order.test.ts
  modified:
    - src/lib/persistence.ts          # appended persistToolCallTurn (~45 lines)
    - src/app/api/chat/route.ts       # +55 lines: imports, tools config, prepareStep, onFinish heartbeat + persistToolCallTurn

key-decisions:
  - "Heartbeat keys use the short form (heartbeat:anthropic, heartbeat:classifier) matching Plan 03-04's heartbeat-trust reader exactly — single source of truth across both files"
  - "W4 onFinish structure: TWO separate try/catch blocks (heartbeat first, persistence second). Either failure path is logged via console.error but cannot corrupt the other. Verified structurally — onFinish body contains exactly 2 `try {` between `onFinish: async` and `onError: async`."
  - "tool_result column name (NOT tool_response) — research correction over CONTEXT D-E-04 typo; verified against supabase/migrations/0001_initial.sql; persistToolCallTurn uses tool_result everywhere; grep `tool_response src/` returns empty"
  - "W7 test uses Request.prototype.json spy to capture body_parse as the first gate identifier; supabase chain stubs differentiate sessions vs messages tables to record session_lookup vs turnRows_check; happy-path asserts toEqual deep-match of all 6 identifiers in order"
  - "console.error retained over log() for onFinish failure paths to match Phase 2 deflection-path style; Plan 03-00 Pino childLogger is available but the existing pattern uses console.error for caught-but-not-rethrown errors and we kept that consistency"

patterns-established:
  - "Pattern: durable-order tests via side-effect-recording mocks — module-scope array, each mock pushes its identifier, assertion is deep-equal on the canonical sequence; trip tests prove later identifiers do NOT appear when an early gate short-circuits"
  - "Pattern: heartbeat-write decoupled from persistence in onFinish — write the cheap pre-known-good signal FIRST in its own try, persist next in its own try; failure in either is logged but the other still runs"
  - "Pattern: persistToolCallTurn flatMap signature — accepts steps as Array<{toolCalls?, toolResults?}> with optional fields so AI-SDK shape variations don't crash; matches toolCalls to toolResults via toolCallId; null tool_result when no match"

requirements-completed: [TOOL-06, TOOL-07, TOOL-08, TOOL-10]

# Metrics
duration: 8min
completed: 2026-05-06
---

# Phase 03 Plan 02: Tool Wiring & Persistence Summary

**Three Phase 3 tools wired into the existing six-gate `/api/chat` streaming hot path via `tools` + `prepareStep` config keys; onFinish callback extended with W4-decoupled Redis heartbeat writes (`heartbeat:anthropic`, `heartbeat:classifier` @ TTL 120s) and a new `persistToolCallTurn({session_id, steps})` helper that flatMaps multi-step tool-call events into messages-table rows. W7 durable-defense test asserts the canonical six-gate sequence via side-effect-recording mocks.**

## Performance

- **Duration:** ~8 min (this resumption); plan partially executed in a prior session
- **Resumed:** 2026-05-06T01:00:00Z
- **Completed:** 2026-05-06T01:09:34Z
- **Tasks:** 3 (all TDD: RED → GREEN per task)
- **Files created:** 3 (all test files)
- **Files modified:** 2 (`src/lib/persistence.ts`, `src/app/api/chat/route.ts`)

## Resumption Note

This plan was executed across two sessions:

1. **Prior session** committed Tasks 1 + 2:
   - Task 1 RED `21b41d9` → GREEN `bec44be` (persistToolCallTurn + 8 tests)
   - Task 2 RED `feea454` → GREEN `77eaac7` (route wiring + 5 tests)
2. **This session** committed Task 3:
   - Task 3 (W7 six-gate-order test, untracked from prior session) → `764ac2a`
   - Two TS errors auto-fixed in the untracked file (Rule 1 — bug):
     - Implicit `this: any` on `Request.prototype.json` spy → added `this: Request` annotation
     - Type incompatibility in session-lookup-fail mock (data: null vs. expected shape) → cast via `as unknown as` with explanatory comment

All three tasks landed atomically; no gaps in the commit chain.

## Accomplishments

- **persistToolCallTurn** appended to `src/lib/persistence.ts` (~45 lines). FlatMaps `steps[].toolCalls[]` into messages-table rows with `role='tool'`, `sdk_message_id=toolCallId` for trace correlation, `tool_name`, `tool_args` (jsonb), `tool_result` (jsonb — matching the actual migration column, NOT the CONTEXT typo `tool_response`). Empty-steps short-circuits without any DB call. Insert errors logged but never thrown (D-G-05).
- **Three tools wired into streamText**: `research_company`, `get_case_study`, `design_metric_framework` from the Plan 03-01 barrel. `prepareStep: enforceToolCallDepthCap` plugged in by reference (TOOL-07 ≤3 calls/turn + SAFE-15 duplicate-arg stop). Phase 2 caps preserved unchanged: `stopWhen: stepCountIs(5)`, `maxOutputTokens: 1500`.
- **W4 fix landed clean.** onFinish body has TWO separate try/catch blocks: heartbeat writes go FIRST in their own try (line 260), persistence in its own try (line 269). Verified structurally via line-count grep — `awk '/onFinish: async/,/onError: async/' src/app/api/chat/route.ts | grep -c "try {"` returns 2. Behavior tests assert: persistence failure does NOT skip heartbeat; heartbeat failure does NOT block persistence.
- **W7 durable-defense test** asserts the canonical six-gate sequence (`body_parse`, `session_lookup`, `turnRows_check`, `over_cap_check`, `rate_limit_check`, `classifier`) via side-effect-recording mocks. 5 tests total: 1 happy-path-six-in-order + 4 short-circuit tests proving each early gate stops execution. Future executors who reorder any gate will trip CI.
- **Six-gate prelude byte-unchanged.** `git diff 02-safe-chat-core-close..03-02-close -- src/app/api/chat/route.ts` shows additions ONLY at imports + inside the streamText config + inside onFinish. Lines 86-202 (the gates) are byte-identical to Phase 2 close.
- **TOOL-08 lock holds.** `git grep -E "supabaseAdmin|redis\.set" src/lib/tools/` returns empty — tool execute fns remain read-only; persistence happens only in `/api/chat/route.ts` onFinish.

## Task Commits

| Task | RED commit | GREEN commit | Description |
|---|---|---|---|
| 1 | `21b41d9` | `bec44be` | persistToolCallTurn helper for tool-call rows + 8 tests |
| 2 | `feea454` | `77eaac7` | /api/chat tools wiring + W4 decoupled onFinish + 5 integration tests |
| 3 | — | `764ac2a` | W7 six-gate canonical order assertion test (5 tests; spans happy-path + 4 trip-points) |

Task 3 had no separate RED commit because it ships AS the canonical-order assertion against ALREADY-shipped route.ts — there was no failing-state to commit; the test was authored to pass against the current six-gate flow and fail only on future regression.

## Heartbeat-Key Coordination Confirmation

Plan 03-04 reads these keys; Plan 03-02 writes them. Both files use the IDENTICAL short-form key strings:

```
$ git grep "heartbeat:anthropic" src/app/api/chat/route.ts src/lib/health.ts
src/app/api/chat/route.ts:          redis.set('heartbeat:anthropic', Date.now(), { ex: 120 }),
src/lib/health.ts://   heartbeat:anthropic    (ex: 120)
src/lib/health.ts:      redis.get<string | number | null>('heartbeat:anthropic'),

$ git grep "heartbeat:classifier" src/app/api/chat/route.ts src/lib/health.ts
src/app/api/chat/route.ts:          redis.set('heartbeat:classifier', Date.now(), { ex: 120 }),
src/lib/health.ts://   heartbeat:classifier   (ex: 120)
src/lib/health.ts:      redis.get<string | number | null>('heartbeat:classifier'),
```

After this plan ships, the next live `/api/chat` call will write fresh heartbeat values. The StatusBanner SC on `/` and `/chat/*` will then read those fresh values via `pingAnthropic()` / `pingClassifier()` and classify them as `'ok'` (within 60s). Until then (or after 120s of inactivity), classification is `'degraded'` for the anthropic dep — but `STATUS_COPY.classifier.degraded` is intentionally empty so only the anthropic banner renders.

## W4 Confirmation: onFinish Source Block

The two-separate-try/catch structure is verifiable in `src/app/api/chat/route.ts` lines 260-291:

```ts
// W4 fix: heartbeat writes go FIRST in their OWN try/catch.
// By the time onFinish fires, Anthropic + classifier have already
// succeeded (we got tokens back). Heartbeat freshness must NOT depend
// on persistence succeeding. Conversely, a heartbeat failure must NOT
// block persistence. The two concerns are decoupled.
// Plan 03-04 reads these short-form keys via heartbeat-trust strategy.
try {
  await Promise.all([
    redis.set('heartbeat:anthropic', Date.now(), { ex: 120 }),
    redis.set('heartbeat:classifier', Date.now(), { ex: 120 }),
  ]);
} catch (err) {
  console.error('heartbeat_write_failed', err);
}

try {
  await persistNormalTurn({ ... });
  // Phase 3 / TOOL-08 / D-E-04 — append tool-call rows after assistant
  // row lands. event.steps is the AI SDK v6 multi-step shape with
  // toolCalls + toolResults per step.
  await persistToolCallTurn({
    session_id,
    steps: event.steps as Parameters<typeof persistToolCallTurn>[0]['steps'],
  });
  await Promise.all([incrementSpend(costCents), incrementIpCost(ipKey, costCents)]);
} catch (err) {
  console.error('onFinish persistence failed', err);
}
```

## W7 Confirmation: gateOrderRecorder Happy-Path Assertion

```ts
describe('/api/chat six-gate canonical order (W7 — durable defense)', () => {
  it('fires gates in exact canonical order on a happy-path request', async () => {
    await postChat();
    expect(gateOrderRecorder).toEqual([
      'body_parse',
      'session_lookup',
      'turnRows_check',
      'over_cap_check',
      'rate_limit_check',
      'classifier',
    ]);
  });
  // ... + 4 short-circuit tests proving early gates stop execution
});
```

All 5 tests pass against the current route.ts (5/5 in 663ms vitest wall-clock).

## AI SDK v6 onFinish event.steps Shape

`event.steps` matched the documented shape from RESEARCH §12 — `Array<{ toolCalls: [...], toolResults: [...], text, finishReason, usage }>`. No shape adjustment was needed; the route.ts cast is `event.steps as Parameters<typeof persistToolCallTurn>[0]['steps']`. The persistToolCallTurn signature accepts both fields as optional (`toolCalls?`, `toolResults?`) for defensive forward-compat across minor AI SDK v6 patches.

## Decisions Made

- **Resumption strategy: audit-then-extend, not redo.** Tasks 1 + 2 already had RED + GREEN commits from the prior session. Re-running the TDD cycle would have created empty-diff commits that pollute history. Instead, this session verified the prior commits' tests pass (`npm test -- tests/lib/persistence.test.ts tests/api/chat-tools.test.ts` → 13/13 pass), then focused on Task 3 (the untracked test file).
- **Auto-fixed two TS errors in Task 3 untracked file (Rule 1 — bug).** The untracked `chat-six-gate-order.test.ts` had two strict-TS errors:
  1. Implicit `this: any` on `Request.prototype.json` spy (TS2683) — fixed by adding explicit `this: Request` parameter annotation. Runtime unchanged.
  2. Mock signature inferred from happy-path implementation rejected `data: null` in the session-lookup-fail trip test (TS2345) — fixed by `data: null as unknown as { ... }` with comment explaining the deliberate test-only cast. The runtime behavior still asserts the route's null-data short-circuit path.
- **Task 3 has no separate RED commit.** The canonical-order test was authored to pass against the ALREADY-SHIPPED Task 2 route. There was no meaningful "RED" state — the test's purpose is durable defense going forward, not driving the implementation. This deviates from the per-task TDD pattern but matches the intent: shipping a regression guard. Documented inline in the Task Commits table.
- **`console.error` retained for onFinish failure paths.** The existing route uses `console.error` (not Pino's `log()`) for caught-but-not-rethrown errors. Plan 03-00's Pino `childLogger` is available, but switching it here would expand Plan 03-02's footprint and break the consistency with Phase 2's deflection-path error handling. Migration to `log()` is a separate concern for a future cleanup pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] TS2683 implicit `this: any` on Request.prototype.json spy**
- **Found during:** Task 3 typecheck verification
- **Issue:** The untracked test file's `Request.prototype.json = async function () { ... return originalJson.call(this); }` triggered TS2683 because the function expression had no `this` annotation, but `originalJson.call(this)` requires the function's `this` type to match `Request`.
- **Fix:** Added `this: Request` parameter annotation: `async function (this: Request) { ... }`. No runtime impact.
- **Files modified:** `tests/api/chat-six-gate-order.test.ts`
- **Verification:** `npx tsc --noEmit` clean.
- **Committed in:** `764ac2a` (Task 3 — folded with the test commit)

**2. [Rule 1 — Bug] TS2345 mock signature mismatch in session-not-found trip test**
- **Found during:** Task 3 typecheck verification
- **Issue:** `sessionsSingle` mock's inferred return type was the happy-path shape `{ data: { email, email_domain, ended_at }; error: null }`. The trip-test wanted to return `{ data: null, error: null }` to exercise the route's null-data short-circuit, but TS rejected `null` for the `data` field.
- **Fix:** Cast via `data: null as unknown as { email: string; email_domain: string; ended_at: null }` with inline comment explaining this is a deliberate test-only narrowing. Runtime behavior unchanged — the route still receives a null data field and short-circuits at the gate.
- **Files modified:** `tests/api/chat-six-gate-order.test.ts`
- **Verification:** `npx tsc --noEmit` clean; the trip test still asserts the route returns 404 + only `body_parse` + `session_lookup` appear in `gateOrderRecorder`.
- **Committed in:** `764ac2a` (Task 3)

---

**Total deviations:** 2 auto-fixed (both type-strict-TS bugs in the untracked test file). No scope creep. No architectural changes (Rule 4) needed. Both fixes are minor TS annotations / casts that don't change runtime behavior — they exist purely to satisfy strict-TS in a test file authored against a recorder-mock pattern that the original test author hadn't typed precisely.

## Issues Encountered

- **Untracked test file from prior session (Task 3) had two TS errors.** Neither was caught when the test file was first authored because `npx vitest run` does not run `tsc --noEmit` — vitest's strip-types loader is more permissive. Documented above as deviation #1 + #2. Going forward, the test file passes both vitest and `tsc --noEmit`.
- **Plan template assumed fresh start; this was a resumption.** Tasks 1 + 2 already had commits. Documented in "Resumption Note" above. No work was redone; the resumption focused on Task 3 + verification.

## Verification Output

- **Full test suite:** **175/175 passed** across 20 test files (was 157/157 before this plan; +18 new tests across 3 new files: 8 persistence + 5 chat-tools + 5 six-gate-order — a couple of pre-existing tests not part of this plan also got new behavior coverage)
- **Plan 03-02 specific tests:** 18/18 passed (8 persistence + 5 chat-tools + 5 six-gate-order)
- **Typecheck (`npx tsc --noEmit`):** clean (exit 0)
- **System-prompt determinism (Plan 01-02 contract):** still 10/10 byte-identical (no regression — Plan 03-02 did not touch system-prompt.ts)
- **Forbidden imports check:** `git grep "@supabase/auth-helpers-nextjs" src/` returns empty
- **`tool_response` naming check:** `git grep "tool_response" src/` returns EMPTY (column-name correction landed)
- **`toolChoice: 'none'` avoidance:** `git grep "toolChoice: 'none'" src/` returns EMPTY
- **`stopWhen: stepCountIs(5)` preservation:** `git grep "stopWhen: stepCountIs(5)" src/app/api/chat/route.ts` returns 1 match
- **`maxOutputTokens: 1500` preservation:** `git grep "maxOutputTokens: 1500" src/app/api/chat/route.ts` returns 1 match
- **`heartbeat:anthropic` write:** `git grep "heartbeat:anthropic" src/app/api/chat/route.ts` returns 1 match (line 262)
- **`heartbeat:classifier` write:** `git grep "heartbeat:classifier" src/app/api/chat/route.ts` returns 1 match (line 263)
- **W4 structural check:** `awk '/onFinish: async/,/onError: async/' src/app/api/chat/route.ts | grep -c "try {"` returns **2** (heartbeat try at line 260 + persistence try at line 269 — exactly the W4 fix shape)
- **Tool-layer DB write check:** `git grep -E "supabaseAdmin|redis\.set" src/lib/tools/` returns empty (TOOL-08 lock holds)
- **Six-gate identifiers preserved:** all 6 still grep-detectable in route.ts (body parse, session select, messages count >= 60, isOverCap, checkRateLimits, classifyUserMessage)

## Coordination Note for Plan 03-04

Heartbeat key names are confirmed identical across both plans:

- Writer (this plan, `src/app/api/chat/route.ts`): `redis.set('heartbeat:anthropic', Date.now(), { ex: 120 })` and same for `classifier`
- Reader (Plan 03-04, `src/lib/health.ts`): `redis.get<string | number | null>('heartbeat:anthropic')` and same for `classifier`

Cross-file grep `git grep "heartbeat:anthropic" src/lib/health.ts src/app/api/chat/route.ts` now returns matches in BOTH files. Plan 03-04's "writer hasn't shipped yet, banner shows degraded" note is now resolved — the writer has shipped.

## Next Phase Readiness

- **Plan 03-03 (walkthrough tool — case-study trace panel rendering):** ready — `get_case_study` tool already returns the `MenuPayload` / `CaseStudyPayload` structured record (Plan 03-01); persistence rows now appear in messages table with `role='tool'` so admin transcripts (Phase 4) can surface them.
- **Plan 03-05 (metric framework UX):** ready — `design_metric_framework` tool returns zod-validated MetricFramework (Plan 03-01); persistence path is now live.
- **Phase 4 admin dashboard:** ready — tool-call rows are persisted under `role='tool'` with `sdk_message_id=toolCallId` for trace correlation. Admin transcript view can filter by role and reconstruct the tool call via `tool_name` + `tool_args` + `tool_result`.
- **Phase 5 deploy gate:** still gated on SAFE-12 (Anthropic org-level $20/mo cap) — unchanged from prior phases.

## Self-Check

- File `tests/lib/persistence.test.ts`: FOUND
- File `tests/api/chat-tools.test.ts`: FOUND
- File `tests/api/chat-six-gate-order.test.ts`: FOUND
- File `src/lib/persistence.ts` (modified — contains `persistToolCallTurn`): FOUND
- File `src/app/api/chat/route.ts` (modified — contains tool wiring + W4 onFinish): FOUND
- Commit `21b41d9` (RED Task 1): FOUND
- Commit `bec44be` (GREEN Task 1): FOUND
- Commit `feea454` (RED Task 2): FOUND
- Commit `77eaac7` (GREEN Task 2): FOUND
- Commit `764ac2a` (Task 3 — W7 test + TS auto-fixes): FOUND

## Self-Check: PASSED

---
*Phase: 03-tools-resilience*
*Plan: 02*
*Completed: 2026-05-06*
