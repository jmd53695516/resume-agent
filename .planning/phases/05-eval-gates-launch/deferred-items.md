# Phase 5 — Deferred Items

Pre-existing issues observed during Phase 5 execution that are out of scope
per the GSD scope-boundary rule (only auto-fix issues directly caused by
the current task's changes).

## Pre-existing TypeScript error in src/components/ChatUI.tsx

**First observed:** Plan 05-06 (cat 4 LLM-judge), 2026-05-09.

**Symptom:** `npx tsc --noEmit` reports:
```
src/components/ChatUI.tsx(46,16): error TS2739: Type '{}' is missing the following
properties from type '{ message: UI_MESSAGE; messages: UI_MESSAGE[]; isAbort: boolean;
isDisconnect: boolean; isError: boolean; finishReason?: FinishReason | undefined; }':
message, messages, isAbort, isDisconnect, isError
```

**Verification this is pre-existing:** `git stash` to drop Plan 05-06 changes
and re-running `npx tsc --noEmit` reproduces the same error against a
zero-Plan-05-06-diff working tree. Therefore the error is unrelated to
Plan 05-06's cat4-judge runner / YAML / CLI wiring.

**Probable origin:** Phase 3 (ChatUI streaming) or an AI SDK v6 type-
definition tightening on `UseChatOptions.onFinish` callback shape. The
error suggests the onFinish callback is being passed an empty-object
default where the SDK now expects the v6 finish-event payload shape.

**Why deferred:** Plan 05-06 only touches eval CLI / runners / fixtures;
fixing a streaming-UI prop type is out of scope. Tests pass at 450/450
(all eval, route, and component test suites green) so this is
type-system-only — not a runtime regression.

**Recommended next step:** Fold into a future Phase 3 or Phase 5 cleanup
plan, or address as a follow-up commit during Plan 05-NN-LAUNCH pre-flight
TypeScript audit.

---

## Live full-suite eval smoke (Plan 05-04 Task 4 + Plan 05-07 Task 4)

**First observed:** Plan 05-04, 2026-05-09. Re-confirmed: Plan 05-07, 2026-05-09.

**Symptom:** Plan 05-04 Task 4 and Plan 05-07 Task 4 are both `checkpoint:human-verify`
gates that require running `EVAL_TARGET_URL=<preview> npm run eval` against a
live preview deploy and recording per-cat pass counts + total cost + run_id.

**Blocker:** `GOOGLE_GENERATIVE_AI_API_KEY` is not yet set in `.env.local`. The
Gemini judge wrapper (`src/lib/eval/judge.ts` Plan 05-03) requires this key; cats
1, 3, 4-judge, and 5 (refusal half) all call into Gemini for grading. Without it,
the live smoke run will throw at the first judge call.

**Verification this is pre-existing:** Per Plan 05-05 + Plan 05-06 SUMMARY notes,
this dependency has been deferred at every prior plan close-out. STATE.md
"Pending Concerns" mirrors the deferral.

**Why deferred:** Code is complete — runners + YAMLs + tests all green at 475/475
locally with mocks. The live verify is a one-shot operation gated on a single
env var Joe must obtain from console.cloud.google.com. The orchestrator spawning
this executor explicitly approves deferring per `<checkpoint_handling_brief>`.

**Plan 05-07 close-out status:** code-complete; live verify deferred. Tasks 1-3
(YAML + runners + Playwright specs + CLI wire) shipped at 475/475 tests passing.
Task 4 unblocks the moment the Gemini key is set; smoke run is reproducible
end-to-end via `EVAL_TARGET_URL=<preview-url> npm run eval`.

**Recommended next step:** Joe sets `GOOGLE_GENERATIVE_AI_API_KEY` in
`.env.local` and on Vercel project settings; runs `npm run eval` against the
current preview; records the smoke-run signal per Plan 05-04 Task 4 +
Plan 05-07 Task 4 `<resume-signal>` formats. Both Task 4 gates close together.

**Update 2026-05-10 (quick task 260509-r39):** This blocker is partially
dissolved — the Gemini key is no longer required because the judge now
calls Anthropic Haiku 4.5 (already provisioned for the main agent).
Plan 05-04 + Plan 05-07 Task 4 live-verify is unblocked at the infra
level. The remaining gate to closing both Task 4 deferrals is the
schema-flakiness work (item #3 above, severity now MEDIUM) and the
silent-fail calibration (item #4 above, now achievable with runId
`IxmC5_FELINyClAEUyDmS`).

---

## Quick task 260509-q00 follow-ups (live smoke runId `WIGoVZ028DYkatKyUKnpZ` @ 2026-05-09T23:07Z)

The eval CLI session-mint fix (quick task 260509-q00) was verified end-to-end
against `http://localhost:3000`. `event:eval_session_minted` fired once with
real nanoid `5Ob3Z-dqwd4cuZLjg0eSY`; `cat1_started` threaded that sessionId;
all 15 of 15 cases reached the agent (zero "Session unknown" 404s). The
404 bug is dead.

Final result for that smoke was 0/15 passed, but for completely different
reasons — none of which block the session-mint fix from being declared
done. The four follow-ups below capture those downstream issues for
separate triage.

**Status (2026-05-10 — quick task 260509-r39):** Items #1 (snapshot pin) and
#2 (rate-limit) are RESOLVED by swapping the judge to Anthropic Haiku 4.5
(`claude-haiku-4-5-20251001`). Live cat1 smoke runId
`IxmC5_FELINyClAEUyDmS` @ 2026-05-10T00:10Z showed zero rate-limit errors
and the dated snapshot resolved correctly. Item #3 (structured-output
schema flakiness) is STILL OPEN — failure mode shifted from Gemini-specific
JSON-mode (~33%) to Anthropic generateObject schema-validation (~47% in
that smoke); severity downgraded HIGH→MEDIUM. Item #4 (silent-fail
inspection) is STILL OPEN but now achievable — 8/15 cat1 cases produce
real verdicts under the new judge, so Supabase row inspection is
meaningful. NEW Item #5 (cost extraction broken) added below.

### Snapshot pin broken — Gemini judge model not found

**Severity:** CRITICAL (blocks all live judge-driven smoke runs).

**Status:** RESOLVED 2026-05-10 (quick task 260509-r39 — judge swapped to
Anthropic Haiku 4.5; dated snapshot `claude-haiku-4-5-20251001` resolves
correctly; runId `IxmC5_FELINyClAEUyDmS` confirms. r39 commit `1d51f00`).

**Surfaced during:** quick task 260509-q00 Task 3 verification, runId
`WIGoVZ028DYkatKyUKnpZ` at 2026-05-09T23:07Z.

**Symptom:** `JUDGE_MODEL_SNAPSHOT='gemini-2.5-flash-preview-09-2025'` in
`src/lib/eval-models.ts:11` is not found in the Gemini public API.
@ai-sdk/google rejects with model-not-found, every judge call dies before
producing a verdict.

**Fix options (1-line change):**
- Update the snapshot string to a known-good Gemini snapshot ID.
- Switch to the unpinned alias `gemini-2.5-flash` while a Joe-decided
  snapshot is selected (RESEARCH Pitfall 4 trade-off: alias drifts but
  unblocks the smoke).

**Recommended:** verify a live snapshot in Google AI Studio's model list,
update `src/lib/eval-models.ts:11`, ship as a one-line PR with the
snapshot's release date in the commit message for git-history audit.

### Gemini free-tier rate limit — 5 RPM cap hit on cat1

**Severity:** HIGH (blocks Plans 05-04 / 05-06 / 05-07 Task 4 live verify
even after the snapshot fix lands).

**Status:** RESOLVED 2026-05-10 (quick task 260509-r39 — judge swapped to
Anthropic Haiku 4.5; Anthropic tier-1 has no free-tier rate cap; cat1
smoke ran 15 cases serially with zero 429s; runId `IxmC5_FELINyClAEUyDmS`.
r39 commit `1d51f00`).

**Surfaced during:** quick task 260509-q00 Task 3, runId `WIGoVZ028DYkatKyUKnpZ`.
Cases 13-15 of cat1 hit the 5-requests-per-minute cap.

**Symptom:** rate-limit 429s from `generativelanguage.googleapis.com` partway
through a single category run. Cat1 has 15 cases — at 1 case/sec the back
half exceeds 5/min and stalls or errors.

**Fix options (Joe-decided):**
- (a) Throttle the runner to ~12s spacing between judge calls (cheapest;
  adds `await sleep(12_000)` in cat runners; full Phase 5 smoke goes from
  ~5min to ~10min).
- (b) Upgrade to paid Gemini tier (cleanest; no code change; +$/run).
- (c) Swap the judge to Claude Haiku 4.5 ($1/$5 per MTok) — `@ai-sdk/anthropic`
  is already in deps; would require a `JUDGE_PROVIDER` switch in
  `src/lib/eval/judge.ts` and re-validation of the structured-output schema
  parsing under Anthropic.

**Recommended:** decide alongside the snapshot-pin fix; option (c) also
mitigates the structured-output schema flakiness below.

### Structured-output schema mismatch — judge generateObject returns JSON that doesn't validate against Zod schema

**Severity:** MEDIUM (downgraded 2026-05-10 from HIGH after r39 swap).
Eval signal noise; can't tell pass-rate from judge flakes. Does NOT block
05-08+ plan progress; DOES block Plan 05-04/06/07 Task 4 clean-signal
smokes (need 15/15 verdicts producing for the cat-1 hard gate).

**Status:** STILL OPEN as of 2026-05-10 (quick task 260509-r39 close-out).
Severity downgraded HIGH→MEDIUM. Failure mode shifted from Gemini-specific
JSON-mode (~33% fail) to Anthropic generateObject schema-validation
(~47% fail in r39 cat1 smoke runId `IxmC5_FELINyClAEUyDmS`). Different
mode: Anthropic Haiku 4.5 returns JSON that doesn't validate against
the Zod schema, NOT the bounds-keyword issue (which r39 commit `2e6e43b`
fixed by dropping `.int()` from judge schemas).

**Surfaced during:**
- Originally: quick task 260509-q00 Task 3, runId `WIGoVZ028DYkatKyUKnpZ`.
  5/15 cases failed with `judgeFactualFidelity: No object generated:
  response did not match schema.` against `gemini-2.5-flash`.
- Re-surfaced post-swap: quick task 260509-r39 Task 3, runId
  `IxmC5_FELINyClAEUyDmS`. 7/15 cases failed with the same wrapper error
  against `claude-haiku-4-5-20251001` — different content failure (model
  output structure), not the validator-side bounds issue r39 fixed.

**Symptom:** the judge wrapper requests a structured Zod object via
`generateObject`. The model sometimes returns JSON that fails Zod parsing
— independent of any actual verdict. ~47% failure rate against Anthropic
is too high to treat as transient.

**Fix options (standard remediation patterns; pick one):**
- (a) Retry-with-fallback in `judge.ts` catch block: on Zod parse failure,
  retry once with a tightened rubric prompt; if it fails again, return a
  neutral verdict so the category run isn't aborted by judge flakes.
- (b) Switch from `generateObject` to Anthropic native tool-use API
  (`@anthropic-ai/sdk` direct, with `tools: [...]` and `tool_choice:
  {type: 'tool', name: '...'}`). Anthropic's native strict tool-use is
  materially more reliable than the AI-SDK-shaped `generateObject` JSON
  prompting path.
- (c) Loosen Zod schema to `z.string()` for verdict + post-hoc enum
  narrowing in the judge wrapper. Trade-off: weaker compile-time type
  signal, but eliminates structured-output adherence as a failure mode.

**Recommended:** option (b) — Anthropic native tool-use with
`tool_choice` forcing the verdict tool. Cleanest schema-adherence
guarantee without losing the type signal. Defer until Plan 05-04/06/07
Task 4 closure becomes the active blocker.

### Silent-fail inspection — disambiguate fabrication detections from allowlist over-strictness

**Severity:** MEDIUM (calibration; doesn't block the session-mint fix from
shipping).

**Status:** STILL OPEN as of 2026-05-10 (quick task 260509-r39 close-out).
Now ACHIEVABLE — was blocked when 0/15 cases produced verdicts under the
broken Gemini judge. Post-swap, 8/15 cat1 cases produce real verdicts
under Anthropic Haiku 4.5 (runId `IxmC5_FELINyClAEUyDmS`), so Supabase
row inspection now yields signal-vs-allowlist disambiguation.

**Surfaced during:** quick task 260509-q00 Task 3, runId `WIGoVZ028DYkatKyUKnpZ`.
7/15 cases failed with `passed:false` but no error in the log — the judge
returned a verdict and that verdict was "fail."

**Symptom:** could be either (a) the eval is working as intended and the
agent fabricated under those prompts (real signal), OR (b) the
`name_token_allowlist` in `kb/agent-knowledge/voice.md` (Plan 05-04) is
too strict and the judge is flagging legitimate-but-paraphrased responses
as fabrication.

**Investigation steps (updated 2026-05-10 — use post-swap runId):**
- Query Supabase for `eval_cases` rows where `runId='IxmC5_FELINyClAEUyDmS'`
  AND `category='cat1'` AND `passed=false`. (Original runId
  `WIGoVZ028DYkatKyUKnpZ` is also valid for cross-comparison but the
  underlying judge has been swapped.)
- For each, read `judge_rationale` and the actual `assistant_response`.
- Bucket into: real fabrication (eval signal — ship the gate as-is) vs
  allowlist over-rejection (calibration — broaden the allowlist OR
  loosen the rubric in `cat1.ts` Plan 05-04 Task 3).
- Decision unblocks Plan 05-04 Task 4 final 15/15 hard gate sign-off
  (alongside item #3 schema-flakiness resolution).

**Recommended:** schedule alongside the schema-flakiness fix (item #3).
Running a clean 15/15 smoke depends on item #3 landing first; this
inspection then closes the calibration gap.

### Cost extraction broken — totalCostCents:0 across r39 smoke run

**Severity:** LOW (doesn't affect signal; affects spend tracking accuracy
and the WARN_THRESHOLD_CENTS budget alarm in `src/lib/eval/cost.ts`).

**Status:** OPEN — first observed 2026-05-10 in quick task 260509-r39
Task 3 smoke (runId `IxmC5_FELINyClAEUyDmS`).

**Symptom:** `totalCostCents: 0` reported across the cat1 smoke run.
Anthropic Haiku at 1500 input + 200 output per case × 15 cases should
produce ~4¢ aggregate cost, not 0. Test-suite cases for
`extractAnthropicJudgeCost` pass (1M+1M → 600 cents, locked in
`tests/lib/eval/cost.test.ts`), so the math is right; the runtime
extraction path is reading the wrong field from the AI SDK v6 usage
object.

**Probable cause:** field-name mismatch between
`extractAnthropicJudgeCost` (expects `inputTokens` / `outputTokens` —
camelCase per the `@ai-sdk/anthropic` provider docs) and the actual
shape returned by `generateObject({ model: anthropicProvider(...) })`.
Possibilities:
- AI SDK v6's `generateObject` returns `usage.input_tokens` /
  `usage.output_tokens` (snake_case, native Anthropic shape) when the
  provider passes through unchanged.
- AI SDK v6 Anthropic-provider usage object has a different field set
  (e.g. `promptTokens` / `completionTokens` from the older AI SDK
  abstraction).
- Usage object is undefined for some reason and the `?? 0` fallbacks are
  silently zeroing.

**Investigation steps:**
- Add a `console.log(JSON.stringify(usage, null, 2))` inside
  `judgeFactualFidelity` BEFORE the cost extraction; re-run a single
  cat1 case; inspect the actual shape.
- Compare against `@ai-sdk/anthropic`'s TypeScript types for the
  `generateObject` return — `LanguageModelV2Usage` shape per AI SDK v6.
- Fix is likely a 1-line field-name correction in
  `extractAnthropicJudgeCost`.

**Recommended:** address as a follow-up quick task. Low priority —
spend-cap mechanism (Plan 04-06 Redis-counter alarm) is an independent
backstop; this only affects per-run-cost reporting accuracy.
