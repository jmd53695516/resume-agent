# Deferred Items — Quick Task 260509-q00

Out-of-scope discoveries logged during execution per GSD scope-boundary rule.

## Pre-existing TypeScript Error (NOT introduced by this task)

**File:** `src/components/ChatUI.tsx:46`
**Error:** `TS2739: Type '{}' is missing the following properties from type '{ message: UI_MESSAGE; messages: UI_MESSAGE[]; isAbort: boolean; isDisconnect: boolean; isError: boolean; finishReason?: FinishReason | undefined; }': message, messages, isAbort, isDisconnect, isError`

**Verification:** Stashed all q00 changes and re-ran `npx tsc --noEmit` against master HEAD `52a8752` — same error reported. Confirmed pre-existing.

**Likely cause:** AI SDK v6 type-tightening on the `useChat({ onFinish: ... })` callback signature; ChatUI passes a callback that takes no args / wrong shape.

**Disposition:** Out of scope for q00 (not introduced by, nor near, the eval-CLI session-mint fix path). Should be addressed by a separate Phase 6 plan or a follow-up quick task on the chat UI.
