---
quick_id: 260803-k97
slug: classifier-fail-open
date: 2026-08-03
status: complete
---

> **Revision (2026-08-03, post `/code-review max`):** the initial fail-open
> commit (7d555e8) passed a max-effort review that surfaced real regressions.
> Hardened in a second pass — see the "Review hardening" section at the bottom.

# Quick Task: Classifier fail-OPEN on error (stop false off-topic deflections)

## Problem (confirmed via Supabase production query)

`src/lib/classifier.ts` `classifyUserMessage` fail-CLOSES on any error:
`return { label: 'offtopic', confidence: 1.0 }`. On a transient Anthropic
error this tells a live recruiter *"That's outside what I can help with here."*

Evidence (messages table, all-time):
- 58 of 74 `offtopic` deflections had `classifier_confidence = 1.0` — a value the
  real Haiku model never emits (every genuine verdict caps at 0.99). That spike
  is the synthetic fail-closed value.
- Real recruiters hit it, including 2026-08-03 ("Walk me through your projects",
  "What's your email") and 2026-07-31 (amarsh@revolutiontechnologies.com).
- Two error populations: eval-run bursts (429 rate-limit from concurrency) and
  human-paced real users (sporadic 529/timeout). No retry exists today.

## Decision (Joe, 2026-08-03)

Retry once, then **fail OPEN**.

## Changes (all in `src/lib/classifier.ts` + its test)

1. Leave `classifyUserMessageOrThrow` as a single-attempt throwing variant —
   preserves the WR-01 heartbeat contract (heartbeat must DETECT outages, not
   retry-mask them).
2. Rewrite `classifyUserMessage`:
   - Attempt via `classifyUserMessageOrThrow`.
   - On error: wait `RETRY_DELAY_MS` (250ms), attempt once more.
   - On second error: log `{ event: 'classifier_error', mode: 'fail_open' }` via
     `@/lib/logger` and return `FAIL_OPEN_VERDICT = { label: 'normal', confidence: 1 }`.
3. `route.ts` unchanged — `{normal, 1.0}` passes both gates → reaches main Sonnet
   agent, whose HARDCODED_REFUSAL_RULES / HALLUCINATION_RULES remain the safety net.
4. Tests (`tests/lib/classifier.test.ts`):
   - Convert the two `fail-closed → offtopic 1.0` tests to `fail-open → normal 1.0`.
   - Add: retry-then-success (1st rejects, 2nd resolves → verdict; called twice).
   - Add: retry-then-fail-open (both reject → {normal,1.0}; called twice).
   - Keep WR-01 OrThrow re-throw tests unchanged (single attempt).

## Observability note

The diagnostic signature moves from `offtopic @ 1.0` → `normal @ 1.0`.
Fail-open events are also greppable in Vercel logs via
`event: "classifier_error", mode: "fail_open"`.

## Verify

- `npm run test` (classifier suite + dependent chat tests green)
- `npx tsc --noEmit`
- `npm run build`

## Review hardening (2nd pass — addresses `/code-review max` findings)

The first commit fixed the false deflections but the max review found real
regressions. Fixed:

- **WR-01 heartbeat masking [crit]:** `route.ts` onFinish now refreshes
  `heartbeat:classifier` only when `!verdict.failOpen`, so a real Haiku outage
  correctly expires the key and turns the banner yellow (was: fail-open reached
  onFinish and kept it green all outage).
- **Observability signature [crit]:** dropped the false "normal@1.0 is unique"
  claim (SYSTEM_PROMPT explicitly allows Haiku to emit confidence 1.0). Fail-open
  now carries an explicit `failOpen` marker; `persistNormalTurn` writes
  `classifier_verdict = 'fail_open'` (confidence null).
- **Abuse-review blindspot:** `fail_open` rows now surface in the abuse dashboard
  (filter is `classifier_verdict <> 'normal'`) with a red "classifier error"
  label in `AbuseTable`.
- **Retry hardening:** retry only on retryable errors (429/5xx/timeout + JSON/zod
  variance; NOT 401/400); jittered backoff to avoid thundering-herd; `maxRetries:0`
  + `timeout:8000` on the classifier `create()` so the wrapper is the sole,
  bounded retry authority (no ~6-attempt stacking / maxDuration blowout).
- **Telemetry + safety:** first-attempt failures log `classifier_retry` (recovered
  degradation is now visible, not only total failures); fail-open catch no longer
  dereferences a possibly-null rejection (`errName`/`errMessage` helpers).
- **Cleanups:** stale "fail-closed wrapper" comment fixed; PLAN status → complete.

### Deferred (logged, not in this task)

- Metering classifier Haiku tokens into the $3/day spend cap (pre-existing gap;
  retry now bounded to ≤2 calls + SDK stacking removed, so net not worse than
  prod today).
- A user-facing graceful message when BOTH Haiku and Sonnet are down (streamText
  onError writes no copy today — pre-existing, exposed more by fail-open).
- Dedicated abuse-column instead of the `fail_open` sentinel (current sentinel is
  sufficient and needs no migration).
