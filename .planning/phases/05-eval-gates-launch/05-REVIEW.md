---
phase: 05-eval-gates-launch
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/health.ts
  - src/app/api/cron/heartbeat/route.ts
  - src/lib/tools/research-company.ts
  - tests/lib/health.test.ts
  - tests/cron/heartbeat.test.ts
  - tests/lib/tools/research-company.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 05 Plan 05-12: Code Review Report (Launch-Night Banner Fix)

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found (1 warning, 4 info — all minor; production already verified green)

## Summary

Targeted review of the launch-night banner fix (PR #2 / commits c7b80fe + ecbcf09 / merged as 296ad6c). The two underlying bugs are correctly diagnosed and fixed:

1. **`pingExa` permanent-degraded fix.** Switched from a broken `HEAD https://api.exa.ai/` (Exa has no root endpoint, returned 404) to the heartbeat-trust pattern already used by `pingAnthropic` / `pingClassifier`. Refresh paths are well-architected: real traffic refreshes via `tools/research-company.ts` on success, and the cron writes unconditionally every 5 min. Real outages still surface via the deflection log + Plan 04-06 alarm path, so the loss of a live ping does not regress detection.

2. **`pingClassifier` chicken-and-egg fix.** The previous WR-04 logic used `if (classifierPing.value === 'ok')` to gate the heartbeat-key refresh — but `pingClassifier` only reads the key it was supposed to refresh. On a low-traffic day the key was perpetually stale and the gate never opened. Replaced with a real `classifyUserMessage('health check ping')` Haiku call (~$0.0001/fire), with an unconditional cron-write on success.

Both fixes are verified by tests. The test files cleanly mock all dependencies, including new `redis.set` and `classifyUserMessage` mocks. Zero-fabrication, security, and PII contracts are unchanged. No source files were modified.

The single warning is a dead-code/correctness oddity worth noting: the `try/catch` around `classifyUserMessage` in the cron route is functionally unreachable under the current classifier implementation (which fails-closed internally and never throws). The four info items are minor cleanups around an unused parameter, the now-unused-in-status-output `pingClassifier`/`pingExa` calls, and an over-broad `(err as Error)` cast.

## Warnings

### WR-01: `try/catch` around `classifyUserMessage` is dead under current classifier semantics

**File:** `src/app/api/cron/heartbeat/route.ts:123-133`
**Issue:** `classifyUserMessage` in `src/lib/classifier.ts:71-97` already wraps the entire body in a `try/catch` and returns `{ label: 'offtopic', confidence: 1.0 }` (fail-closed) on any error — it never throws. As a result, the `catch` block in the heartbeat route (lines 128-133) is unreachable: a real classifier outage will return a successful-looking verdict, `classifierLiveOk` will be set to `true`, `heartbeat:classifier` will be refreshed with a stale "OK" timestamp, and the banner will continue to show green even when the Anthropic API is down for Haiku.

This is the same class of bug as the one being fixed (false-green heartbeat from a non-discriminating health check). It does not regress current behavior — banner state is no worse than before — but the fix as shipped does not deliver the discrimination promised by the comment "covers low/no-traffic windows."

**Fix:** Either:
1. Make `classifyUserMessage` distinguish "API call failed" from "model returned offtopic" (e.g., a `health()` variant that re-throws on transport error and only swallows for the fail-closed user-facing path), or
2. Inspect the response — a verdict of `{ label: 'offtopic', confidence: 1.0 }` is the fail-closed sentinel. If the heartbeat probe returns it, treat the call as a failure for heartbeat purposes:
```ts
const v = await classifyUserMessage('health check ping');
const looksHealthy = !(v.label === 'offtopic' && v.confidence === 1.0);
if (looksHealthy) {
  classifierLiveOk = true;
  await redis.set('heartbeat:classifier', Date.now(), { ex: 120 });
} else {
  log({ event: 'heartbeat_classifier_failed', error_message: 'fail-closed verdict' }, 'warn');
}
```
Note: the prompt 'health check ping' could legitimately classify as offtopic with high confidence under the current classifier logic, so option 2 needs a probe string the classifier reliably classifies as `allow`/`onsite` — or use option 1.

Given production is already verified green and this is a launch-night patch, deferring this to a follow-up issue (with tracking) is reasonable; flagging here so it does not get lost.

## Info

### IN-01: Unused `label` parameter in `timed()` helper

**File:** `src/app/api/cron/heartbeat/route.ts:45-52`
**Issue:** `timed(label: string, fn: () => Promise<T>)` accepts a `label` argument but never uses it. All five callers (lines 103-107) pass a string label, suggesting it was intended for logging, but the result object only contains `{ value, ms }` — the label is dropped.
**Fix:** Either include the label in the returned object and the heartbeat log payload (so `latencies_ms` could be auto-derived), or drop the parameter:
```ts
async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}
// callers: timed(pingSupabase) etc.
```

### IN-02: `pingClassifier` and `pingExa` results no longer drive any status — only latency telemetry

**File:** `src/app/api/cron/heartbeat/route.ts:101-108, 184-195`
**Issue:** After the launch fix, `classifierPing.value` and `exaPing.value` are not read anywhere — the heartbeat log unconditionally reports `exa: 'ok'` (post-write) and `classifier: classifierLiveOk ? 'ok' : 'degraded'` (post-live-call). The two ping calls now only contribute `.ms` latency numbers for the `latencies_ms` log field. For `pingExa` and `pingClassifier`, both pings are just `redis.get` round-trips, which are also captured by `pingUpstash`. This is mild duplication of the same Upstash latency signal across three ping fields.

The comment at line 187-189 ("Prefer 'ok' (we just wrote the key) over the pre-write ping read") correctly documents the override but doesn't address whether the pre-write ping is worth running at all.
**Fix:** Decide whether the latency telemetry is useful (it tells ops "this Upstash region was slow at heartbeat fire" — arguably yes for one ping, redundant for three). If keeping all three, leave a comment noting the duplication is intentional. If trimming, drop `pingExa` and `pingClassifier` from the parallel block and report only the post-write/post-call status:
```ts
const [supabasePing, upstashPing, anthropicPing] =
  await Promise.all([
    timed('supabase', pingSupabase),
    timed('upstash', pingUpstash),
    timed('anthropic', pingAnthropic),
  ]);
// drop classifier/exa entries from latencies_ms
```

### IN-03: Test mocks `classifyUserMessage` as throwing, but production code-path can't observe a throw

**File:** `tests/cron/heartbeat.test.ts:241`
**Issue:** The test `'does not write heartbeat:classifier when live classifier call throws'` mocks `classifyUserMessage` to reject. This test passes because the production `classifyUserMessage` is being mocked entirely — but in production, the real `classifyUserMessage` swallows all errors internally (see WR-01). The test gives false confidence that the heartbeat route correctly handles classifier failures, when in reality the route can never observe one through the current API.

If WR-01 is fixed (option 1: a re-throwing variant), this test correctly covers the behavior. If WR-01 is fixed via option 2 (sentinel inspection), this test should be supplemented with a sentinel-returning case:
```ts
mocks.classifyUserMessage.mockResolvedValue({ label: 'offtopic', confidence: 1.0 });
// expect heartbeat_classifier_failed log + no heartbeat:classifier write
```
**Fix:** Add a sentinel-resolved test case once WR-01 is addressed, or document in the test description that this case is contingent on a future classifier API change.

### IN-04: Generic `(err as Error)` casts could lose context

**File:** `src/app/api/cron/heartbeat/route.ts:84, 130, 145, 157`
**File:** `src/lib/tools/research-company.ts:67`
**Issue:** The pattern `(err as Error).message` / `(err as Error).name` assumes the thrown value is an `Error` instance. Anthropic SDK errors, Upstash Redis errors, and `fetch` failures all subclass `Error` so this is mostly safe, but a non-Error throw (e.g., `throw 'string literal'`) would surface as `undefined` in logs without any context. Low risk because the upstream libraries are well-behaved.
**Fix:** Use a small helper, e.g.:
```ts
function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}
// log({ ..., error_message: errMessage(err) }, 'warn');
```
Apply to all four heartbeat sites and the research-company error log. Optional cleanup; no immediate impact.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Scope: Plan 05-12 launch-night banner fix only (6 files, PR #2 diff vs. 9d014a8)_
