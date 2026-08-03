---
quick_id: 260803-k97
slug: classifier-fail-open
date: 2026-08-03
status: complete
---

# Summary: Classifier fail-OPEN on error

## What changed

`src/lib/classifier.ts`
- `classifyUserMessage` now **retries once** (250ms backoff) on any classifier
  failure, then **fails OPEN** — returns `{ label: 'normal', confidence: 1 }`
  instead of the old `{ label: 'offtopic', confidence: 1.0 }`.
- On terminal failure it emits a structured log
  `{ event: 'classifier_error', mode: 'fail_open', error_class, error_message }`.
- `classifyUserMessageOrThrow` left as a single-attempt throwing variant — the
  WR-01 heartbeat contract (detect outages, don't retry-mask) is preserved.
- `route.ts` unchanged: `{normal, 1.0}` passes both deflection gates and reaches
  the main Sonnet agent, whose HARDCODED_REFUSAL_RULES / HALLUCINATION_RULES
  remain the safety net.

`tests/lib/classifier.test.ts`
- Converted the two `fail-closed → offtopic 1.0` tests to `fail-open → normal 1.0`
  and asserted the retry (2 calls).
- Added `retry recovers: 1st errors, 2nd succeeds → real verdict`.

## Why

Production Supabase query proved 58 of 74 all-time `offtopic` deflections were
the synthetic fail-closed value (`confidence = 1.0`, which the real Haiku model
never emits). Real recruiters were told "That's outside what I can help with
here" on transient Anthropic blips — including 2026-08-03 and 2026-07-31
(amarsh@revolutiontechnologies.com). Root cause was the fail-closed default, not
mis-classification.

## Verification

- `npx vitest run` → 675 passed, 12 skipped, 0 failed
- `npx tsc --noEmit` → clean
- `npm run build` → compiles
- `npm run lint` → clean

## Observability note

Fail-open DB signature is now `normal @ confidence = 1.0` (was `offtopic @ 1.0`).
Also greppable in Vercel logs: `event: "classifier_error", mode: "fail_open"`.

## Not done (surfaced to Joe)

- Deploy to production (Vercel) — pending Joe's ship decision.
- Eval-burst 429s (concurrency during eval runs) are mitigated by the retry but
  not eliminated; a per-run classifier concurrency limit is a possible follow-up.
