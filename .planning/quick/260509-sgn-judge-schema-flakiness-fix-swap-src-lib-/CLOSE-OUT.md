# Quick Task 260509-sgn — Close-Out

**Status:** DONE
**Date:** 2026-05-10
**Duration:** ~4 minutes
**Final commits:** `92b89eb` (Task 1 — judge.ts), `70bfa48` (Task 2 — judge.test.ts)
**Test count delta:** 475 → 486 (suite-wide; +1 from this task: cat1-no-toolblock; remainder is unrelated growth since r39 close-out)

## Items #3 + #5 Status Update for `.planning/phases/05-eval-gates-launch/deferred-items.md`

### Item #3 — Structured-output schema mismatch

- **Pre:** OPEN, severity MEDIUM. ~47% Zod-validation failure rate in cat1 smoke runId `IxmC5_FELINyClAEUyDmS` against `claude-haiku-4-5-20251001` under the AI-SDK `generateObject` path.
- **Post:** RESOLVED at the unit-test layer. judge.ts now uses Anthropic native forced tool-use (`tools: [...]` + `tool_choice: { type: 'tool', name: ... }`) with `strict: true` + `additionalProperties: false` + post-extraction Zod parse (defense-in-depth). Live verification (optional, not gating): a fresh cat1 smoke should show 0% schema-validation fail rate.

### Item #5 — Cost extraction broken

- **Pre:** OPEN, severity LOW. `totalCostCents: 0` in r39 cat1 smoke runId `IxmC5_FELINyClAEUyDmS`.
- **Post:** RESOLVED-pending-live-verify. Each judge function adapts `resp.usage.input_tokens` / `output_tokens` (snake_case) → `inputTokens` / `outputTokens` (camelCase) before calling `extractAnthropicJudgeCost`. The cost-lock test (`tests/lib/eval/judge.test.ts` — 1M+1M → 600¢) exercises the adapter end-to-end. `cost.ts` and `cost.test.ts` byte-stable.

## Live Cat1 Smoke (optional follow-up)

Not run as part of this quick task per the plan brief: "Live verification is OPTIONAL — code-complete + tests-green is the bar for this quick task; live smoke is captured as a follow-up note."

When Joe runs it (`EVAL_TARGET_URL=http://localhost:3000 npm run eval` against a dev server with `ANTHROPIC_API_KEY` set), record here: `runId`, per-case fail count for cat1, observed `totalCostCents > 0` confirmation. Closes Plan 05-04 + Plan 05-07 Task 4 hard-gate sign-offs alongside item #4 silent-fail calibration.
