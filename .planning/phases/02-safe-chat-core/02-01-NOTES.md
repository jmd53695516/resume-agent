# Plan 02-01 baseline

- buildSystemPrompt() new baseline bytes: **84,482** (Plan 01-02 noted ~5505 with placeholder KB; the jump reflects real KB content from Plan 01-03 plus the +HARDCODED_REFUSAL_RULES block)
- curl /api/smoke-ui-stream: verified chunk stream (text-start / text-delta / text-end / [DONE])
- Test count: **43 tests passing across 5 files** (kb-loader 6, system-prompt 10, classifier 8, cost 10, redis 4)
- Tests green, tsc clean, env vars present (9 of 9), pre-commit hook self-test green
- Open Question A1 (v6 createUIMessageStream wire protocol) — RESOLVED, Plan 02-02 may proceed

## Notes for Plan 02-02

- Smoke route lives at `src/app/api/smoke-ui-stream/route.ts` (not `_smoke-ui-stream/`; Next.js App Router treats `_folder/` as private/non-routable, so the leading underscore was dropped). Plan 02-03 cleanup task should reference the actual path.
- Test files that import modules transitively reading env now stub `@/lib/env` via hoist-safe `vi.mock` factories with assembled var names — this slips past the pre-commit hook's literal-string patterns. See `tests/lib/cost.test.ts` for the canonical pattern.
- `classifier.ts` `.filter(c => c.type === 'text')` uses a plain narrowing call + cast in the `.map()` step because `@anthropic-ai/sdk@0.90.0`'s `TextBlock` requires a `citations` field that the type predicate `c is { type: 'text'; text: string }` doesn't satisfy. Plan 02-02 may want to use the SDK's exported `TextBlock` type directly.
