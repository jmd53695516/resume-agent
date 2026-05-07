---
phase: 04
plan: 06
subsystem: alarms
tags: [alarms, cron, redis, suppression, dispatcher, cron-auth, observability]
requirements_addressed: [OBSV-09]
dependency-graph:
  requires:
    - "Plan 04-01 — env.CRON_SECRET (.min(32)) + alarms_fired table + sessions schema"
    - "Plan 04-05 — sendAlarm() in src/lib/email.ts (plain-text alarm primitive)"
    - "Plan 03-04 — health.ts ping helpers (pingAnthropic/Classifier/Supabase/Upstash/Exa)"
  provides:
    - "src/lib/cron-auth.ts validateCronAuth(req) — POST + Bearer-token + constant-time compare; reusable by Plan 04-07 /api/cron/heartbeat + /api/cron/archive"
    - "src/lib/alarms.ts — AlarmCondition type + claimAlarmSuppression + 4 condition checks + runAllAlarms dispatcher (consumed by /api/cron/check-alarms; alarms_fired rows feed Plan 04-04 /admin/health Recent alarms widget)"
    - "src/app/api/cron/check-alarms/route.ts — POST endpoint that cron-job.org hits every 5 min"
    - "src/lib/id.ts newAlarmId() — alm_-prefixed nanoid for alarms_fired.id text PK"
  affects: []
tech-stack:
  added: []
  patterns:
    - "Per-condition Redis NX suppression — SET key '1' EX 3600 NX; 'OK' === claim succeeded, null === blocked (RESEARCH §6 / Pitfall 6)"
    - "Constant-time string compare in validateCronAuth (length check + XOR loop) to dodge timing oracles on the Bearer token compare"
    - "vi.hoisted() for multi-mock test files — refines Plan 04-02 / 04-05 pattern (TDZ-safe state container shared across hoisted vi.mock factories)"
    - "Fail-open suppression on Redis throw — better to over-fire under partial outage than silently drop alarms (T-04-06-07 disposition: accept)"
    - "Promise.all on the 4 alarm checks (no shared state across checks; serialising would 5x the latency for nothing)"
key-files:
  created:
    - "src/lib/cron-auth.ts"
    - "src/lib/alarms.ts"
    - "src/app/api/cron/check-alarms/route.ts"
    - "tests/lib/cron-auth.test.ts"
    - "tests/lib/alarms.test.ts"
    - "tests/cron/check-alarms.test.ts"
  modified:
    - "src/lib/id.ts"
decisions:
  - "newAlarmId returns alm_${nanoid(21)} — 21-char body matches newMessageId convention; alm_ prefix keeps alarm ids distinguishable in logs/SQL"
  - "Constant-time Bearer compare in validateCronAuth — overkill at this scale (the 401 fast path is the same speed regardless), but cheap to implement and removes a class of timing-oracle risk"
  - "claimAlarmSuppression fails OPEN on Redis throw — returns true. T-04-06-07: an alarm storm caused by a Redis blip is preferable to silently dropping legitimate alarms during a partial outage; Plan 04-07 heartbeat will detect Redis down separately"
  - "checkErrorRate minSample default = 10 (Claude's discretion per CONTEXT) — 1 error in 5 turns would be 20%; need sample size to suppress false positives in low-traffic windows"
  - "checkErrorRate trips on ratio > 2% strictly (NOT >=) — exactly-2% (1/50) is the boundary case the plan must-have specifies as 'over 2%'; keeps the math defensive against off-by-one alarm storms"
  - "alarms_fired.body_summary truncated to slice(0, 1000) — bounds payload size if the summary ever grows (T-04-06-03 mitigation)"
  - "INSERT alarms_fired wrapped in try/catch; failure logged but does NOT block the alarm fire — the email is the primary signal, the row is for the /admin/health Last 5 widget"
  - "Promise.all for the 4 alarm checks instead of sequential await — they share no state and run on different deps (Redis spend, Supabase rows, health pings); parallelism cuts cron-route latency to the slowest single check"
  - "vi.hoisted() container pattern for multi-mock test files — Plan 04-02 introduced it for callback page tests; reusing it here avoids the TDZ error on FAKE_SECRET I hit on first run of cron-auth.test.ts"
metrics:
  duration: "~6 min"
  tasks_completed: 4
  files_changed: 7
  commits: 4
  completed_date: "2026-05-07"
---

# Phase 4 Plan 06: Alarm Dispatcher Summary

Wave 3 plan C — wired the 4-condition alarm sweep behind the bearer-authed `/api/cron/check-alarms` POST route. `validateCronAuth` rejects on non-POST or wrong/missing token via a constant-time compare; on auth success the route invokes `runAllAlarms`, which evaluates `spend-cap`, `error-rate`, `dep-down`, and `rate-limit-abuse` in parallel, claims a per-condition Redis NX suppression key (`resume-agent:alarms:fired:<condition>`, EX 3600) for each tripped condition, and on a successful claim dispatches via the existing `sendAlarm()` (Plan 04-05) and writes a row to `public.alarms_fired` for the /admin/health Recent alarms widget (Plan 04-04). Per-condition keys mean firing `spend-cap` does NOT suppress `dep-down`. Fail-open on Redis throw (T-04-06-07: better over-fire than drop). 34 plan-scoped tests pass; full repo holds at 305/305. Operationally, Joe still needs to add the cron-job.org schedule post-deploy (see Operational Notes).

## What Was Built

### Task 1 — newAlarmId() in src/lib/id.ts (commit `829011e`)

Appended a sibling export to the existing `newMessageId`:

```ts
export function newAlarmId(): string {
  return `alm_${nanoid(21)}`;
}
```

21-char body matches `newMessageId` (same collision profile); `alm_` prefix keeps alarm ids visually distinct from message ids in logs and SQL queries against `public.alarms_fired`. `newMessageId` and the `nanoid` import are unchanged — the diff is +12 insertions on a file that was 8 lines.

### Task 2 — src/lib/cron-auth.ts + tests (commit `916dad7`)

`validateCronAuth(req)` rejects unless ALL of:
1. `req.method === 'POST'` (D-C-09 belt-and-suspenders against accidental browser GETs)
2. `Authorization` header starts with `Bearer ` (case-sensitive scheme)
3. Token is non-empty after trim
4. Token equals `env.CRON_SECRET` under a constant-time XOR compare (length check first, then per-char XOR accumulator).

7 test cases: correct accept, GET reject, missing header, wrong scheme (`Token`), empty bearer value, same-length token mismatch (exercises the XOR loop), length-mismatch token (exercises the length-shortcut).

### Task 3 — src/lib/alarms.ts + tests (commit `18c2877`)

Six exports:

- **`AlarmCondition`** — `'spend-cap' | 'error-rate' | 'dep-down' | 'rate-limit-abuse'`
- **`claimAlarmSuppression(condition)`** — `redis.set('resume-agent:alarms:fired:<condition>', '1', { ex: 3600, nx: true })`. Returns `true` iff result is `'OK'` (claim succeeded). Returns `false` on `null` (NX blocked — already fired). Returns `true` on Redis throw (fail-open per T-04-06-07).
- **`checkSpendCap()`** — reads `getSpendToday()` from existing redis.ts; trips at `>= 300` cents.
- **`checkErrorRate(windowMinutes=10, minSample=10)`** — counts assistant turns in window; classifies as error if `stop_reason === 'error'` OR (empty `content` AND `stop_reason` does NOT start with `deflection:`). Trips iff `total >= minSample` AND `errors/total > 0.02` (strict).
- **`checkDependencies()`** — `Promise.all` of 5 health pings; trips iff any returns `'degraded'` or `'down'`. Summary lists which deps and their status (e.g. `Dependencies non-ok: anthropic=down, exa=degraded.`).
- **`checkRateLimitAbuse(windowHours=1, threshold=5)`** — Supabase query for messages with `stop_reason='deflection:ratelimit'` joined to `sessions(ip_hash)`; counts DISTINCT `ip_hash` via `Set`. Trips iff `>= 5`. Handles both supabase-js join shapes (object or array) for robustness against schema-cache variation.
- **`runAllAlarms()`** — runs the 4 checks in parallel (Promise.all), then iterates: tripped → `claimAlarmSuppression` → on claim, `sendAlarm()` + INSERT `alarms_fired` row (id from `newAlarmId`, `body_summary` truncated to 1000 chars per T-04-06-03). Returns `AlarmDispatchResult[]` shaped `{ condition, tripped, fired, resend_send_id }`. Suppressed conditions log `event: 'alarm_suppressed'`; fired conditions log `event: 'alarm_fired'` with `suppression_until_ts`.

21 test cases across 6 describe blocks: claimAlarmSuppression (3 cases — claim/blocked/throw + per-condition key independence), checkSpendCap (3 — boundary, below, above), checkDependencies (3 — all-ok, degraded, down), checkErrorRate (5 — under-sample, trip, exact-2%-no-trip, deflection-doesn't-count, query-error), checkRateLimitAbuse (3 — distinct counting, threshold trip, array-shape join), runAllAlarms (3 — no-trip, trip+fire+insert, trip+suppressed).

### Task 4 — /api/cron/check-alarms route + tests (commit `4f5987e`)

```ts
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!validateCronAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const started = Date.now();
  try {
    const results = await runAllAlarms();
    const fired_count = results.filter((r) => r.fired).length;
    log({ event: 'cron_run', cron_name: 'check-alarms', duration_ms: ..., status: 'ok', items_processed: fired_count });
    return Response.json({ ok: true, results, fired_count });
  } catch (err) {
    log({ event: 'cron_run', ..., status: 'error', error_message: ... }, 'error');
    return Response.json({ error: 'internal' }, { status: 500 });
  }
}
```

6 test cases: 401 with no header, 401 with wrong token, 401 with GET method + correct token (belt-and-suspenders), 200 happy path with `fired_count` and `results` shape, 500 with internal error (verifies error log shape), success log with `items_processed = 2` when 2 conditions fire.

## Test Results

| File | Tests | Status |
|---|---|---|
| `tests/lib/cron-auth.test.ts` | 7 | PASS |
| `tests/lib/alarms.test.ts` | 21 | PASS |
| `tests/cron/check-alarms.test.ts` | 6 | PASS |
| **Plan-scoped total** | **34** | **PASS** |
| Full repo suite | 305 | PASS (38 files) |

`npx tsc --noEmit` clean.

## Deviations from Plan

### [Rule 3 — Blocking issue] vi.hoisted() container in cron-auth.test.ts

**Found during:** Task 2 first test run
**Issue:** Plan template used a top-level `const FAKE_SECRET = ...` referenced by the hoisted `vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: FAKE_SECRET } }))` factory. Vitest hoists `vi.mock()` calls above all imports/declarations, so `FAKE_SECRET` was in TDZ at factory-evaluation time:
```
ReferenceError: Cannot access 'FAKE_SECRET' before initialization
```
**Fix:** Wrapped the secret in `vi.hoisted(() => ({ CRON_SECRET: ... }))` so the value is constructed during the hoisted phase. Same pattern Plan 04-05's `email.test.ts` uses (`mocks = vi.hoisted(() => ({ ... }))`).
**Files modified:** `tests/lib/cron-auth.test.ts`
**Commit:** included in `916dad7` (Task 2)

### [Rule 1 - Bug] checkRateLimitAbuse type narrowing for join shape

**Found during:** Task 3 implementation (TS strict mode)
**Issue:** Plan template iterated `for (const row of data as Array<{ sessions: { ip_hash: string } | { ip_hash: string }[] | null }>)` and accessed `sess?.ip_hash` — fine at runtime, but `sess` could be `null` after `Array.isArray` resolves the array case to `arr[0]` (which is `undefined` for empty arrays). TS strict didn't catch this directly, but the type narrowing was sloppy and the optional-chain hid a real edge case (empty join array → `undefined.ip_hash` would throw at runtime, never reaching `Set.add`).
**Fix:** Added explicit narrowing with `'ip_hash' in sess` type guard after the array unwrap; only add to the Set if both the object exists AND has the field. Wrote a dedicated test for the array-shape join path to lock the behavior.
**Files modified:** `src/lib/alarms.ts`, `tests/lib/alarms.test.ts`
**Commit:** included in `18c2877` (Task 3)

### [Rule 2 - Critical functionality] Promise.all on the 4 alarm checks

**Found during:** Task 3 implementation
**Issue:** Plan template's runAllAlarms used `await checkSpendCap()` then `await checkErrorRate()` etc. — sequential. The 4 checks share no state (Redis read, Supabase rows, health pings hit different backends), so serialising them adds ~5x latency for no benefit. On Vercel Hobby's 60s function budget this still fits, but the cron route should return as fast as it can — long-running cron functions queue up against the 1M monthly invocation limit.
**Fix:** Wrapped the 4 checks in `Promise.all`. The for-loop afterwards runs sequentially (suppression-claim + sendAlarm + INSERT), but that's per-tripped-condition work and can't be parallelised cleanly without complicating error handling. Plan acceptance criteria do not specify ordering, only that the dispatcher "runs all 4 checks in parallel" — which is exactly what Promise.all does.
**Files modified:** `src/lib/alarms.ts`
**Commit:** included in `18c2877` (Task 3)

## Manual Smoke (deferred to deploy preview)

Plan §verification specifies three manual smokes that require a live Supabase + Redis + Resend stack:

1. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/check-alarms` → 200 with `{ ok: true, results: [...], fired_count: 0 }` (assuming nothing tripped)
2. Same curl WITHOUT auth → 401 `{ error: 'unauthorized' }`
3. Force-trip: `redis-cli SET resume-agent:spend:<current-hour> 350` then run cron once → email arrives in `JOE_NOTIFICATION_EMAIL` + `alarms_fired` row written; second run within 1h → no duplicate email; `/admin/health` Recent alarms widget shows the entry.

These are **deferred** until Joe runs them on a deploy preview before Phase 4 closes (or as part of LAUNCH-* in Phase 5).

## Operational Notes (Joe's post-deploy checklist)

- Sign in to cron-job.org (free tier)
- Create job: title "resume-agent: check-alarms"
- URL: `https://<production-domain>/api/cron/check-alarms`
- Method: POST
- Schedule: every 5 min (`*/5 * * * *`)
- Headers: `Authorization: Bearer <CRON_SECRET>` (paste exact value from `.env.local`)
- Save + Enable
- Verify by hitting "Test run" once and checking Vercel logs for `event: 'cron_run', cron_name: 'check-alarms', status: 'ok'`

## Plan 04-07 Coupling Note

The plan output spec asked about a possible interaction with Plan 04-07's heartbeat: `pingAnthropic` and `pingClassifier` use heartbeat-trust (Plan 03-02) — they read `heartbeat:anthropic` / `heartbeat:classifier` Redis keys with TTL=120s. The keys are written by `/api/chat`'s `onFinish`, so any session in the last ~2 minutes keeps them fresh. **Plan 04-07's heartbeat cron is NOT a precondition for the heartbeat keys to exist** — those are written by the chat route already in production. Plan 04-07 will add a separate cron that LLM-prewarms the cache + ensures the heartbeat is written even during traffic lulls. Result: `dep-down` will NOT noisy-fire on Anthropic/Classifier just because 04-07 hasn't shipped, **provided** there's been at least one chat session in the last ~2 minutes when the cron runs. During quiet hours (e.g. overnight, weekends, before public deploy), `dep-down` could fire; this is the noise Plan 04-07 is designed to mute by writing heartbeats from cron-job.org during business hours.

**Recommendation:** deploy 04-07 in the same wave as 04-06, OR set the cron-job.org check-alarms job to business-hours-only (`*/5 9-18 * * 1-5`) until 04-07 ships. The 1-hour suppression keeps even a noisy `dep-down` to ≤24 emails/day worst case, but it'd still be annoying.

## Self-Check

- src/lib/id.ts contains `newAlarmId` — VERIFIED
- src/lib/cron-auth.ts — FOUND
- src/lib/alarms.ts — FOUND
- src/app/api/cron/check-alarms/route.ts — FOUND
- tests/lib/cron-auth.test.ts — FOUND
- tests/lib/alarms.test.ts — FOUND
- tests/cron/check-alarms.test.ts — FOUND
- src/lib/alarms.ts contains literal `redis.set(key, '1', { ex: 3600, nx: true })` — VERIFIED
- src/lib/alarms.ts uses `resume-agent:alarms:fired:` Redis key prefix — VERIFIED
- src/lib/alarms.ts exports AlarmCondition, claimAlarmSuppression, checkSpendCap, checkErrorRate, checkDependencies, checkRateLimitAbuse, runAllAlarms — VERIFIED
- src/app/api/cron/check-alarms/route.ts uses `runtime = 'nodejs'` and `maxDuration = 60` — VERIFIED
- Commit 829011e (Task 1) — FOUND in git log
- Commit 916dad7 (Task 2) — FOUND in git log
- Commit 18c2877 (Task 3) — FOUND in git log
- Commit 4f5987e (Task 4) — FOUND in git log
- 34/34 plan-scoped tests passing
- 305/305 full-repo tests passing
- npx tsc --noEmit clean

## Self-Check: PASSED
