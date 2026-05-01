---
phase: 03-tools-resilience
plan: 01
subsystem: tools
tags: [ai-sdk-tools, anthropic-haiku, exa, prompt-injection-defense, system-prompt-extension, zod, tdd]

# Dependency graph
requires:
  - phase: 03-tools-resilience
    plan: 00
    provides: researchCompany() Exa client; getCaseStudy(slug) + listCaseStudySlugs() kb-loader helpers; childLogger + log() Pino; EXA_API_KEY env var
  - phase: 02-safe-chat-core
    provides: buildSystemPrompt() + determinism contract; anthropicClient() + MODELS.CLASSIFIER (Haiku 4.5)
provides:
  - research_company AI SDK v6 tool — Exa-backed, fetched-content-wrapped, in-character failure copy
  - get_case_study AI SDK v6 tool — menu-when-unknown (D-C-02), structured case study record
  - design_metric_framework AI SDK v6 tool — Haiku 4.5 forced-tool-output (strict:true) + zod-validated MetricFramework
  - enforceToolCallDepthCap PrepareStepFunction — TOOL-07 (3-call cap) + SAFE-15 (duplicate-arg stop) using activeTools:[] (cache-friendly)
  - wrapFetchedContent helper — TOOL-09 prompt-injection defense at the tool boundary
  - TOOL_FAILURE_COPY const — 3 in-character ≤30-word fallback strings, no apology vocabulary
  - hashArgs() helper on hash.ts — D-I-04 PII-safe tool-call logging (16-hex SHA-256 prefix)
  - FETCHED_CONTENT_RULE + ANTI_REFLEXIVE_CHAINING_RULE in system-prompt.ts — both static; determinism preserved byte-identically
  - src/lib/tools/index.ts barrel — Plan 03-02 streamText entry point
affects: [03-02-tool-trace-panel, 03-03-walkthrough-tool, 03-04-resilience-degradation, 03-05-metric-framework]

# Tech tracking
tech-stack:
  added: []  # all dependencies were pre-installed by Plan 03-00 (ai@6.0.168, zod@4.3.6, exa-js@2.12.1, @anthropic-ai/sdk@0.90, pino@10.3.1)
  patterns:
    - "AI SDK v6 tool({ description, inputSchema, execute }) — Zod schemas erased to FlexibleSchema in the public type; tests cast via asZod() helper to call .safeParse() under strict TS"
    - "@anthropic-ai/sdk@0.90.0 native typing for Tool.strict: no extension type or @ts-expect-error needed (plan's StrictAnthropicTool fallback was conservative)"
    - "ToolUseBlock type predicate (find()) imported from @anthropic-ai/sdk/resources/messages — required because the SDK's ContentBlock union has a caller field on ToolUseBlock"
    - "depth-cap pattern: prepareStep returns activeTools:[] (cache-friendly) NOT toolChoice-none (cache-invalidating) — RESEARCH §3"
    - "hashArgs pattern for PII-safe tool logging: 16-hex SHA-256 prefix; raw args never appear in JSON.stringify(logCall)"
    - "Tool boundary wrapping: wrapFetchedContent applies <fetched-content> tags to each Exa result.text; system-prompt FETCHED_CONTENT_RULE makes Sonnet treat it as data"

key-files:
  created:
    - src/lib/tools/sanitize.ts
    - src/lib/tools/failure-copy.ts
    - src/lib/tools/depth-cap.ts
    - src/lib/tools/research-company.ts
    - src/lib/tools/get-case-study.ts
    - src/lib/tools/design-metric-framework.ts
    - src/lib/tools/index.ts
    - tests/lib/tools/sanitize.test.ts
    - tests/lib/tools/depth-cap.test.ts
    - tests/lib/tools/research-company.test.ts
    - tests/lib/tools/get-case-study.test.ts
    - tests/lib/tools/design-metric-framework.test.ts
    - tests/lib/tools/index.test.ts
  modified:
    - src/lib/hash.ts                         # appended hashArgs()
    - src/lib/system-prompt.ts                # added FETCHED_CONTENT_RULE + ANTI_REFLEXIVE_CHAINING_RULE
    - tests/lib/system-prompt.test.ts         # appended Phase 3 describe block (5 tests)

key-decisions:
  - "AI SDK v6 erases Zod-specific type info from tool().inputSchema (FlexibleSchema). Tests use a small asZod() cast helper to call .safeParse() — runtime works unchanged."
  - "@anthropic-ai/sdk@0.90 already exposes strict?: boolean natively on the Tool interface (messages.d.ts:1075), so the plan's StrictAnthropicTool extension is unnecessary. Used the SDK's native AnthropicTool type directly."
  - "Imported ToolUseBlock from @anthropic-ai/sdk/resources/messages for the type predicate inside resp.content.find(). The plan's hand-rolled shape literal was missing the SDK's caller field, which caused TS2677."
  - "FETCHED_CONTENT_RULE + ANTI_REFLEXIVE_CHAINING_RULE inserted between HARDCODED_REFUSAL_RULES and TOOL_GUIDANCE_PLACEHOLDER (matches plan order); buildSystemPrompt() length increased from 84,477 (Phase 2 close) to 85,373 (Phase 3 +896 chars), still byte-identical across calls."
  - "Comment phrasings in depth-cap.ts and design-metric-framework.ts were reworded to make the strict-grep acceptance criteria clean (no `toolChoice: 'none'` or `@ts-expect-error` literals anywhere — even in comments explaining what we're avoiding)."

patterns-established:
  - "Pattern: cast inputSchema → ZodTypeAny in tests to dodge AI SDK v6's FlexibleSchema erasure (asZod helper)"
  - "Pattern: import SDK-native types (AnthropicTool, ToolUseBlock) over hand-rolling ad-hoc shapes — strict-TS friendly and version-resilient"
  - "Pattern: every tool's execute fn logs with the same shape: { event: 'tool_call', tool_name, args_hash, latency_ms, status, [error_class | mode] }"
  - "Pattern: tool failure copy returned via { error: TOOL_FAILURE_COPY[name] } structured-return — never thrown — so Sonnet can weave it in"

requirements-completed: [TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-09, TOOL-11]

# Metrics
duration: 14min
completed: 2026-05-01
---

# Phase 03 Plan 01: Three Agentic Tools Summary

**Three AI SDK v6 tools (`research_company`, `get_case_study`, `design_metric_framework`) defined as `tool({ inputSchema, execute })` instances with zod schemas, prompt-injection defense (`<fetched-content>` wrapping), in-character failure copy, depth-cap prepareStep callback, and Phase 3 system-prompt extensions — all under strict TS with zero `@ts-expect-error` suppressions. Determinism contract from Plan 01-02 still byte-identical (10/10).**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-01T02:34:45Z
- **Completed:** 2026-05-01T02:48:37Z
- **Tasks:** 5 (all TDD: RED → GREEN per task)
- **Files created:** 13 (7 source, 6 test)
- **Files modified:** 3 (hash.ts, system-prompt.ts, system-prompt.test.ts)

## Accomplishments

- **Three AI SDK v6 tool() instances** — research_company, get_case_study, design_metric_framework — each with zod-validated input schema, structured execute return shape, and PII-safe Pino logging (`event: 'tool_call'`, `args_hash` 16-hex SHA-256, `latency_ms`, `status`).
- **research_company** wraps every Exa result.text in `<fetched-content>...</fetched-content>` tags before returning to Sonnet (TOOL-09 prompt-injection defense). System-prompt `FETCHED_CONTENT_RULE` instructs Sonnet to treat tag content as data, never instructions.
- **get_case_study** returns a `MenuPayload` (kind='menu') for missing or unknown slugs (D-C-02), or a `CaseStudyPayload` (kind='case_study') for valid slugs. Title is sourced from frontmatter or slug-humanized fallback.
- **design_metric_framework** calls Haiku 4.5 with `tool_choice: { type: 'tool' as const, name: 'output_metric_framework' }` + `strict: true`. Defense-in-depth: even with strict:true on the Anthropic side, the response is zod-validated server-side via `MetricFrameworkOutput.parse(toolUseBlock.input)`.
- **enforceToolCallDepthCap** prepareStep callback caps tool calls at 3 per turn (TOOL-07) AND stops on duplicate-arg consecutive calls (SAFE-15). Returns `activeTools: []` (cache-friendly) — never the toolChoice-none pattern (cache-invalidating; RESEARCH §3).
- **Failure UX:** every tool returns a structured `{ error: TOOL_FAILURE_COPY[name] }` payload — never throws — so Sonnet can weave the in-character first-person copy directly into its reply (D-H-01..02). Word counts: research_company 26, get_case_study 28, design_metric_framework 27 (all ≤30).
- **System-prompt extension** adds `FETCHED_CONTENT_RULE` + `ANTI_REFLEXIVE_CHAINING_RULE` (with the "hit my own limit" natural opener for the depth-cap path). Both are static module-scope strings — buildSystemPrompt() is byte-identical across calls; Plan 01-02's determinism contract still passes 10/10.
- **Barrel export** at `src/lib/tools/index.ts` ready for Plan 03-02 to import into `streamText({ tools, prepareStep })`.

## Tool File Inventory

| File | Lines | Purpose |
|---|---|---|
| `src/lib/tools/research-company.ts` | 71 | TOOL-01/02/09/11 — Exa research + fetched-content wrap |
| `src/lib/tools/get-case-study.ts` | 117 | TOOL-03/04/11 — menu-when-unknown + structured record |
| `src/lib/tools/design-metric-framework.ts` | 133 | TOOL-05/11 — Haiku forced-output + zod post-validation |
| `src/lib/tools/depth-cap.ts` | 40 | TOOL-07 + SAFE-15 prepareStep callback (activeTools:[]) |
| `src/lib/tools/sanitize.ts` | 20 | TOOL-09 wrapFetchedContent — text wrapping in `<fetched-content>` tags |
| `src/lib/tools/failure-copy.ts` | 17 | D-H-01..02 in-character ≤30-word strings |
| `src/lib/tools/index.ts` | 10 | Barrel export for streamText wiring |

## Task Commits

Each task TDD-cycled (RED test commit → GREEN implementation commit):

| Task | RED commit | GREEN commit | Description |
|---|---|---|---|
| 1 | `c0188c0` | `e68ee2a` | sanitize + failure-copy + depth-cap + hashArgs |
| 2 | `148128f` | `bc77e03` | research_company tool |
| 3 | `1f9fcd9` | `3909239` | get_case_study tool |
| 4 | `23b00f4` | `69d9f51` | design_metric_framework tool |
| 5 | `d625563` | `5216461` | system-prompt extensions + tools barrel |

## Decisions Made

- **AI SDK v6 inputSchema erasure → asZod() cast in tests**: `tool({ inputSchema: z.object(...) })` returns a `Tool<INPUT>` whose `inputSchema` field is typed as `FlexibleSchema<INPUT>` (a generic provider-utils type that doesn't expose Zod's `.safeParse()`). Runtime is unchanged — the field IS the Zod schema we passed. Tests use a one-line `asZod(s: unknown): z.ZodTypeAny` cast helper to call `.safeParse()` under strict TS without `@ts-expect-error`. This pattern is reusable across all three tool test files.
- **No StrictAnthropicTool extension needed**: The plan's example used `type StrictAnthropicTool = AnthropicTool & { strict?: boolean }` because older SDK versions might not have surfaced the field. `@anthropic-ai/sdk@0.90.0` already declares `strict?: boolean` directly on the `Tool` interface (`messages.d.ts:1075`). Used the native type — simpler and version-resilient.
- **ToolUseBlock for the find() type predicate**: The plan's hand-rolled shape literal `{ type: 'tool_use'; input: unknown; id: string; name: string }` was missing the SDK's `caller` field on ToolUseBlock, which caused TS2677 ("type predicate's type must be assignable to its parameter's type"). Imported `ToolUseBlock` directly from `@anthropic-ai/sdk/resources/messages`. The runtime narrowing is identical; the type is just complete.
- **System-prompt determinism preserved byte-identically**: Phase 2 close measured 84,477 chars (recorded in Plan 02-01 SUMMARY); Phase 3 close measures 85,373 chars (+896 chars from FETCHED_CONTENT_RULE + ANTI_REFLEXIVE_CHAINING_RULE + their `\n\n` join separators). `buildSystemPrompt() === buildSystemPrompt()` still holds — verified by 5 new Phase 3 tests + the existing Phase 2 determinism test.
- **Comment phrasings reworded for strict-grep**: The acceptance criteria use `git grep "toolChoice: 'none'"` and `git grep "@ts-expect-error"` to verify absence in src/lib/tools/. Both literals briefly appeared in explanatory comments saying "we don't use this". Reworded those comments ("the toolChoice-none pattern", "no TS suppressions either") so the strict-grep tests are clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] AI SDK v6 erases Zod type from inputSchema**
- **Found during:** Task 2 typecheck after GREEN
- **Issue:** `npx tsc --noEmit` fails with `TS2339: Property 'safeParse' does not exist on type 'FlexibleSchema<...>'`. AI SDK v6's `tool()` returns a `Tool` whose `inputSchema` field is typed via the provider-utils `FlexibleSchema` generic, not Zod-specific. Vitest tests pass at runtime (the value IS the Zod schema) but TS rejects.
- **Fix:** Added a one-line `asZod(s: unknown): z.ZodTypeAny` cast helper in each tool test file. Reusable pattern (Tasks 2, 3, 4 all use it).
- **Files modified:** `tests/lib/tools/research-company.test.ts`, `get-case-study.test.ts`, `design-metric-framework.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0; all tool tests pass.
- **Committed in:** `bc77e03` (Task 2 GREEN), `3909239` (Task 3 GREEN), `69d9f51` (Task 4 GREEN)

**2. [Rule 1 — Bug] ToolUseBlock type predicate failure**
- **Found during:** Task 4 typecheck after GREEN
- **Issue:** `tsc` rejects `(c): c is { type: 'tool_use'; input: unknown; id: string; name: string } => c.type === 'tool_use'` because the actual SDK `ToolUseBlock` interface includes a required `caller` field (DirectCaller | ServerToolCaller etc.) — the plan's hand-rolled shape was incomplete. TS2677.
- **Fix:** Imported `ToolUseBlock` from `@anthropic-ai/sdk/resources/messages` and used `(c): c is ToolUseBlock => c.type === 'tool_use'`. Runtime narrowing is identical; the type is now complete.
- **Files modified:** `src/lib/tools/design-metric-framework.ts`
- **Verification:** `npx tsc --noEmit` exits 0; all 10 tests pass.
- **Committed in:** `69d9f51` (folded into Task 4 GREEN)

**3. [Rule 2 — Missing critical correctness — strict-grep cleanliness] Comment text leaked literal acceptance-criteria patterns**
- **Found during:** Task 1 grep verification (depth-cap), Task 4 grep verification (design-metric-framework)
- **Issue:** depth-cap.ts had a comment containing the literal `` `toolChoice: 'none'` `` (in backticks, explaining what to NOT do). design-metric-framework.ts had a comment ending "No extension type or @ts-expect-error needed." Both comments would cause the plan's strict-grep acceptance criteria (`git grep "toolChoice: 'none'" src/lib/tools/depth-cap.ts` returns empty; `git grep "@ts-expect-error" src/lib/tools/` returns empty) to register false positives.
- **Fix:** Reworded both comments to convey the same meaning without the exact literal: "the toolChoice-none pattern" and "no TS suppressions either".
- **Files modified:** `src/lib/tools/depth-cap.ts`, `src/lib/tools/design-metric-framework.ts`
- **Verification:** `git grep "toolChoice: 'none'" src/lib/tools/` and `git grep "@ts-expect-error" src/lib/tools/` both return empty.
- **Committed in:** `e68ee2a` (Task 1 GREEN), `69d9f51` (Task 4 GREEN)

---

**Total deviations:** 3 auto-fixed (2 type-bugs, 1 strict-grep alignment).
**Impact on plan:** All three were necessary for correctness or to satisfy acceptance criteria. No scope creep. No architectural changes (Rule 4) needed. The plan's instruction to use a `StrictAnthropicTool` extension was conservative for older SDKs; we correctly chose the native typing path which the plan's `<action>` block authorized as a fallback ("If the SDK type later includes `strict` natively, this extension still compiles").

## Issues Encountered

None blocking. Three small auto-fixed type/grep issues documented above. The plan's example code shape was generally accurate; the deviations were narrow type-correctness fixes against the live SDK type definitions.

## Verification Output

- **Full test suite:** **125/125 passed** across 14 test files
- **System-prompt determinism (regression):** Phase 2 + Phase 3 tests pass; `buildSystemPrompt() === buildSystemPrompt()` holds (byte-identical)
- **Typecheck (`npx tsc --noEmit`):** clean (exit 0)
- **Build (`npm run build`):** clean (exit 0); all 7 routes compile (`/`, `/_not-found`, `/api/chat`, `/api/session`, `/chat`)
- **System-prompt length:** 85,373 chars (Phase 2 close: 84,477 → +896 from FETCHED_CONTENT_RULE + ANTI_REFLEXIVE_CHAINING_RULE)
- **Failure-copy word counts:** research_company=26, get_case_study=28, design_metric_framework=27 (all ≤30 ✓)
- **Forbidden imports check:** `git grep "@supabase/auth-helpers-nextjs" src/` returns empty
- **Tool-layer console.log check:** `git grep "console.log" src/lib/tools/` returns empty
- **tool_response naming check:** `git grep "tool_response" src/` returns empty (column is `tool_result`)
- **toolChoice-none avoidance:** `git grep "toolChoice: 'none'" src/lib/tools/` returns empty
- **TS suppression avoidance:** `git grep "@ts-expect-error" src/lib/tools/` returns empty (W8 success criterion)
- **Plan 01-02 determinism contract:** still 10/10 byte-identical (the 5 existing tests in tests/lib/system-prompt.test.ts continue to pass)

## Next Phase Readiness

- **Plan 03-02 (tool-trace panel + persistence + route wiring):** ready — barrel exports `{ research_company, get_case_study, design_metric_framework, enforceToolCallDepthCap, TOOL_FAILURE_COPY }`. Plan 03-02 imports these into `streamText({ tools, prepareStep })`.
- **Plan 03-03 (walkthrough tool):** the `get_case_study` tool already returns the structured record — Plan 03-03 layers the trace-panel rendering and the ~400-word narration prompt on top.
- **Plan 03-04 (resilience/degradation):** unblocked — health.ts skeleton from Plan 03-00 is still the surface; this plan didn't touch it.
- **Plan 03-05 (metric framework UX):** the `design_metric_framework` tool already returns a zod-validated `MetricFramework` — Plan 03-05 layers the card rendering and Joe's commentary on top.
- **Real Exa key required**: When Plan 03-02 wires the route and Joe pilots research_company live, `.env.local` must have a real EXA_API_KEY (placeholder won't authenticate). Tracked from Plan 03-00 SUMMARY.

## Self-Check

- File `src/lib/tools/sanitize.ts`: FOUND
- File `src/lib/tools/failure-copy.ts`: FOUND
- File `src/lib/tools/depth-cap.ts`: FOUND
- File `src/lib/tools/research-company.ts`: FOUND
- File `src/lib/tools/get-case-study.ts`: FOUND
- File `src/lib/tools/design-metric-framework.ts`: FOUND
- File `src/lib/tools/index.ts`: FOUND
- File `tests/lib/tools/sanitize.test.ts`: FOUND
- File `tests/lib/tools/depth-cap.test.ts`: FOUND
- File `tests/lib/tools/research-company.test.ts`: FOUND
- File `tests/lib/tools/get-case-study.test.ts`: FOUND
- File `tests/lib/tools/design-metric-framework.test.ts`: FOUND
- File `tests/lib/tools/index.test.ts`: FOUND
- Commit `c0188c0` (RED Task 1): FOUND
- Commit `e68ee2a` (GREEN Task 1): FOUND
- Commit `148128f` (RED Task 2): FOUND
- Commit `bc77e03` (GREEN Task 2): FOUND
- Commit `1f9fcd9` (RED Task 3): FOUND
- Commit `3909239` (GREEN Task 3): FOUND
- Commit `23b00f4` (RED Task 4): FOUND
- Commit `69d9f51` (GREEN Task 4): FOUND
- Commit `d625563` (RED Task 5): FOUND
- Commit `5216461` (GREEN Task 5): FOUND

## Self-Check: PASSED

---
*Phase: 03-tools-resilience*
*Plan: 01*
*Completed: 2026-05-01*
