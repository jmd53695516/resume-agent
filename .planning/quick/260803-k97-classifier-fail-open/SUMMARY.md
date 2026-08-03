---
quick_id: 260803-k97
slug: classifier-fail-open
date: 2026-08-03
status: complete
---

# Summary: Classifier fail-NEUTRAL on error (final)

> The task started as "fail-open" and pivoted to **fail-neutral** after two rounds
> of `/code-review max` showed fail-open's terminal path (routing unscreened,
> unthrottled input to Sonnet during an outage, with prod cost gates off) was the
> source of the worst findings. The slug/dir keep the original name.

## Final behavior

On a classifier call failure, `classifyUserMessage`:
1. **Retries once** (jittered ~250–500ms backoff) — but only for *retryable*
   errors (429 / 5xx / 408 / SDK connection+timeout / JSON+zod output variance);
   structural errors (401/400/403/404) fail immediately.
2. If it still fails, returns an **`error` marker** (`{label:'normal',
   confidence:0, error:true}`) — NOT a routed-to-agent verdict.
3. The route sees `verdict.error` and **deflects neutrally**:
   *"Hit a snag on my end just now — mind sending that again?"* — persisted as a
   `deflection:classifier_error` turn.

The old fail-closed default (`offtopic@1.0`) that falsely told real recruiters
they were off-topic on a transient blip is gone. The common case (a single
transient blip) now recovers on the retry and the recruiter gets a real answer.

## Key implementation points

- `src/lib/classifier.ts`: retryable-error detection via **`constructor.name`**
  (Anthropic SDK error subclasses inherit `name==='Error'`, so `.name`/`.status`
  sniffing was dead code — a re-review finding); `errName` uses `constructor.name`
  too so logs distinguish `RateLimitError` vs `APIConnectionTimeoutError`.
  `maxRetries` is caller-controlled: chat wrapper passes 0 (its own jittered retry
  is the sole authority, no SDK stacking / maxDuration blowout); heartbeat keeps
  the SDK default 2.
- `src/lib/classifier.ts` `classifyUserMessageOrThrow` unchanged in contract
  (single-attempt, throws) — preserves the WR-01 heartbeat outage-detection.
- `src/app/api/chat/route.ts`: new `verdict.error` gate before the borderline
  gate → `deflectionResponse('classifier_error')`. Heartbeat writes reverted to
  unconditional (error turns deflect before `onFinish`, so `onFinish` only runs
  on success — heartbeat is legitimately fresh; a real outage never refreshes it
  → banner degrades, WR-01 intact).
- `src/lib/persistence.ts`: `'classifier_error'` added to `persistDeflectionTurn`
  reasons; `persistNormalTurn` reverted to plain verdict (only success reaches it).
- `src/app/admin/components/AbuseTable.tsx`: `deflection:classifier_error` renders
  a red "classifier error" row (surfaces via the existing `deflection:%` query).

## Why fail-neutral (vs fail-open)

Fail-neutral dissolved re-review findings #1 (cost drain), #3 (heartbeat
conflation), #5/#6 (marker not threaded to email/onAbort), #8 (abuse pollution),
#9 (SAFE-01/02/03 bypass) — because an errored turn deflects cleanly and never
reaches Sonnet / `onFinish` / the email / abort paths. Tradeoff: during a *rare
sustained Haiku-only outage* the agent shows the retry message instead of still
answering — acceptable given prod spend/rate gates are currently off.

## Observability

- DB / abuse log: `deflection:classifier_error` rows (red "classifier error").
- Vercel logs: `event:"classifier_error", mode:"fail_neutral"` (terminal),
  `event:"classifier_retry"` (recovered first-attempt), `event:"deflect",
  reason:"classifier_error"` (route). `error_class` now shows the real SDK class.

## Verification

- `npx vitest run` → 679 passed, 12 skipped, 0 failed
- `npx tsc --noEmit` → clean · `npm run build` → compiles · `npm run lint` → clean

## Deferred (logged, not silently dropped)

- Metering classifier Haiku tokens into the $3/day spend cap (pre-existing gap).
- Graceful user-facing copy when `streamText` itself errors mid-stream
  (pre-existing `onError` gap; unrelated to the classifier path now).
- The prod safety gates (`SAFETY_GATES_ENABLED=false`) remain a separate decision.
