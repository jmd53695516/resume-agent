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

### Snapshot pin broken — Gemini judge model not found

**Severity:** CRITICAL (blocks all live judge-driven smoke runs).

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

### Structured-output schema mismatch — Gemini 2.5 Flash returns malformed JSON ~33% of the time

**Severity:** HIGH (eval signal noise; can't tell pass-rate from judge
flakes).

**Surfaced during:** quick task 260509-q00 Task 3, runId `WIGoVZ028DYkatKyUKnpZ`.
5/15 cases failed with `judgeFactualFidelity: No object generated:
response did not match schema.` against `gemini-2.5-flash`.

**Symptom:** the judge wrapper requests a structured Zod object and Gemini
sometimes returns a shape that fails parsing — independent of any actual
verdict. ~33% failure rate is too high to treat as transient.

**Fix options:**
- Retry-with-fallback: on parse failure, retry once with a tightened
  rubric prompt; if it fails again, return a neutral verdict so the
  category run isn't aborted by judge flakes.
- Rubric tightening: shorten and harden the schema (fewer optional fields,
  stricter enums) — Gemini 2.5 Flash drifts more on long structured outputs.
- Provider swap: see option (c) under the rate-limit follow-up — Anthropic
  Haiku 4.5 has materially better structured-output adherence.

**Recommended:** if option (c) is chosen above, this resolves itself; if
sticking with Gemini, add a single-shot retry layer in
`src/lib/eval/judge.ts`.

### Silent-fail inspection — disambiguate fabrication detections from allowlist over-strictness

**Severity:** MEDIUM (calibration; doesn't block the session-mint fix from
shipping).

**Surfaced during:** quick task 260509-q00 Task 3, runId `WIGoVZ028DYkatKyUKnpZ`.
7/15 cases failed with `passed:false` but no error in the log — the judge
returned a verdict and that verdict was "fail."

**Symptom:** could be either (a) the eval is working as intended and the
agent fabricated under those prompts (real signal), OR (b) the
`name_token_allowlist` in `kb/agent-knowledge/voice.md` (Plan 05-04) is
too strict and the judge is flagging legitimate-but-paraphrased responses
as fabrication.

**Investigation steps:**
- Query Supabase for `eval_cases` rows where `runId='WIGoVZ028DYkatKyUKnpZ'`
  AND `category='cat1'` AND `passed=false`.
- For each, read `judge_rationale` and the actual `assistant_response`.
- Bucket into: real fabrication (eval signal — ship the gate as-is) vs
  allowlist over-rejection (calibration — broaden the allowlist OR
  loosen the rubric in `cat1.ts` Plan 05-04 Task 3).
- Decision unblocks Plan 05-04 Task 4 final 15/15 hard gate sign-off.

**Recommended:** schedule alongside the snapshot/rate-limit/schema fixes —
running the smoke clean depends on those landing first, then this
inspection becomes meaningful.
