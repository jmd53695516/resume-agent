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
