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
