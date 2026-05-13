---
phase: quick
plan: 260512-tku
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/env.ts
  - src/app/api/chat/route.ts
  - tests/api/chat-six-gate-order.test.ts
  - tests/api/chat-email-allowlist.test.ts
  - tests/api/chat-spendcap-allowlist.test.ts
  - tests/api/chat-iprl-allowlist.test.ts
  - .planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md
autonomous: true
requirements: [TKU-01, TKU-02, TKU-03, TKU-04]

must_haves:
  truths:
    - "By default (no env var set / set to anything other than literal 'true'), gates 4 (spend-cap) and 5 (rate-limits) in /api/chat are SKIPPED at runtime — the route reaches the classifier (gate 6) regardless of isOverCap() result or checkRateLimits() result"
    - "Setting SAFETY_GATES_ENABLED='true' in the Vercel environment re-activates BOTH gates with zero code changes — call sites read process.env at request time, not module load"
    - "Gates 1 (body parse), 2 (session lookup), 3 (turn cap), and 6 (classifier) continue to fire on every request regardless of flag state"
    - "Per-IP cost counter (incrementIpCost) and global spend counter (incrementSpend) continue to increment inside onFinish — observability data is preserved even when gates don't read it"
    - "SEED-001 helper code (EVAL_CLI_ALLOWLIST + isEmailSpendCapAllowlisted + isEmailRatelimitAllowlisted + isEmailIpRatelimitAllowlisted in src/lib/redis.ts) is BYTE-IDENTICAL after this change — un-skipping tomorrow restores SEED-001 protection unchanged"
    - "src/lib/redis.ts is byte-identical (no edits to Ratelimit constructors, helper functions, or counter mutators)"
    - "Tests for SEED-001 contracts (chat-spendcap-allowlist, chat-iprl-allowlist, chat-email-allowlist) are .skip-marked with a TODO referencing SEED-002 — the files exist on disk and can be un-skipped with a single line edit per file"
    - "SEED-002 exists at .planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md with trigger condition, rollback steps, and SECURITY RISK note about the exposure window"
    - "Full verification gates pass: npm test (all non-skipped tests green), npx tsc --noEmit (exit 0), npm run build (exit 0)"
  artifacts:
    - path: "src/lib/env.ts"
      provides: "Optional SAFETY_GATES_ENABLED env var validation (z.string().optional())"
      contains: "SAFETY_GATES_ENABLED"
    - path: "src/app/api/chat/route.ts"
      provides: "Conditional gate 4 + gate 5 execution wrapped by SAFETY_GATES_ENABLED feature flag"
      contains: "SAFETY_GATES_ENABLED"
    - path: ".planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md"
      provides: "Seed document with trigger, rollback steps, security risk note"
      contains: "SEED-002"
  key_links:
    - from: "src/app/api/chat/route.ts gate 4"
      to: "process.env.SAFETY_GATES_ENABLED"
      via: "in-code feature flag check at top of POST handler"
      pattern: "SAFETY_GATES_ENABLED"
    - from: "src/app/api/chat/route.ts gate 5"
      to: "process.env.SAFETY_GATES_ENABLED"
      via: "same in-code feature flag check (single switch, both gates)"
      pattern: "SAFETY_GATES_ENABLED"
    - from: ".planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md"
      to: "this quick task PLAN.md + commit"
      via: "Breadcrumbs section linking back to the disabling work"
      pattern: "260512-tku"
---

<objective>
TEMPORARILY disable gates 4 (spend-cap) and 5 (rate-limits) globally in /api/chat behind a single in-code feature flag SAFETY_GATES_ENABLED (default OFF — gates skipped unless the env var is literally 'true'). Re-enable mechanism is a Vercel env-var flip with zero code change. SEED-001 helper code stays intact. SEED-002 is planted to track re-enablement.

Purpose: Unblock PR #4 CI eval gate that has been deflecting at end of cat1 for 4+ hours despite three SEED-001 halves shipped. Root cause is structural — `incrementIpCost` accumulates classifier + tools + sub-call costs (~150¢/run server side) which hits SAFE-08 (per-IP cost cap, 150¢/day) on a SINGLE eval run. Each SEED-001 fix has revealed a deeper gate. Joe's decision (2026-05-13 01:15 UTC) is to disable the rate-limit + spend-cap concept entirely TEMPORARILY and re-enable after the dev phase stabilizes. SECURITY POSTURE: Anthropic org-level $100/mo cap is the only remaining backstop; ~$100 exposure if attacker discovers the URL.

Output:
- src/lib/env.ts — `SAFETY_GATES_ENABLED: z.string().optional()` added to EnvSchema
- src/app/api/chat/route.ts — gates 4 + 5 wrapped in `if (SAFETY_GATES_ENABLED) { ... }` block; counter increments preserved unchanged
- 3 test files marked describe.skip with SEED-002 TODO (chat-spendcap-allowlist, chat-iprl-allowlist, chat-email-allowlist)
- chat-six-gate-order.test.ts: gate-4 + gate-5 assertions adjusted to match flag-off behavior; gate-1/2/3/6 assertions preserved
- .planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md planted
- Verification: npm test green, npx tsc --noEmit clean, npm run build clean
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md

# Primary edit sites
@src/app/api/chat/route.ts
@src/lib/env.ts

# DO NOT EDIT — kept intact, helpers preserved for re-enable
@src/lib/redis.ts

# Test files to .skip / adjust
@tests/api/chat-six-gate-order.test.ts
@tests/api/chat-email-allowlist.test.ts
@tests/api/chat-spendcap-allowlist.test.ts
@tests/api/chat-iprl-allowlist.test.ts

<interfaces>
<!-- Key contracts the executor will reference. Extracted from the codebase. -->
<!-- Use these directly — no further exploration needed. -->

From src/app/api/chat/route.ts (current six-gate order, lines 109-302):
```typescript
// Gates 1-3 stay ON unconditionally:
//   1. body parse (req.json + BodySchema.safeParse)             [lines 113-123]
//   2. session lookup (supabaseAdmin.from('sessions')...)        [lines 126-153]
//   3. turn cap (60 messages in messages table)                  [lines 156-185]
//
// Gates 4-5 WRAP IN if (SAFETY_GATES_ENABLED):
//   4. spend cap (isEmailSpendCapAllowlisted + isOverCap)        [lines 187-220]
//   5. rate limits (checkRateLimits)                             [lines 222-250]
//
// Gate 6 stays ON unconditionally:
//   6. classifier (classifyUserMessage)                          [lines 252-301]
//
// onFinish increments (KEEP intact, no flag):
//   incrementSpend(costCents, { email: session.email })
//   incrementIpCost(ipKey, costCents)
```

From src/lib/redis.ts (BYTE-IDENTICAL — no edits in this plan):
```typescript
// Helpers preserved untouched — when gates re-enabled, SEED-001 protection still works:
export const EVAL_CLI_ALLOWLIST: ReadonlySet<string>
export function isEmailRatelimitAllowlisted(email: string): boolean
export function isEmailSpendCapAllowlisted(email: string): boolean
export function isEmailIpRatelimitAllowlisted(email: string): boolean
export async function checkRateLimits(ipKey, email, sessionId): Promise<RateLimitCheck>
export async function isOverCap(): Promise<boolean>
export async function incrementSpend(cents, opts?: { email?: string }): Promise<void>
export async function incrementIpCost(ipKey, cents): Promise<void>
```

From src/lib/env.ts (current EnvSchema):
```typescript
// Add ONE optional field — does not break existing prod/dev/CI envs:
// SAFETY_GATES_ENABLED: z.string().optional(),
```

Feature flag read pattern (Phase 02-04 Turnstile precedent — STATE.md line 108):
```typescript
// process.env read at CALL-TIME inside POST (not module scope) — lets vitest
// mutate the flag per-test without resetModules ceremony; cost is one property
// read per request. Mirrors the NEXT_PUBLIC_TURNSTILE_ENABLED pattern.
const SAFETY_GATES_ENABLED = process.env.SAFETY_GATES_ENABLED === 'true';
```

Strict equality 'true' check (NOT truthy check): empty string, '0', 'false', undefined all → gates OFF. Only literal 'true' → gates ON.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wire SAFETY_GATES_ENABLED flag into env.ts + route.ts (wrap gates 4 + 5)</name>
  <files>src/lib/env.ts, src/app/api/chat/route.ts</files>
  <behavior>
    - Test 1 (chat-six-gate-order.test.ts): With SAFETY_GATES_ENABLED unset (default), happy-path request records gate order ['body_parse', 'session_lookup', 'turnRows_check', 'classifier'] — gates 'over_cap_check' and 'rate_limit_check' DO NOT appear because isOverCap() and checkRateLimits() are never called.
    - Test 2 (chat-six-gate-order.test.ts): With SAFETY_GATES_ENABLED='true', happy-path request records the original canonical order ['body_parse', 'session_lookup', 'turnRows_check', 'over_cap_check', 'rate_limit_check', 'classifier'].
    - Test 3 (chat-six-gate-order.test.ts): With flag unset, even when isOverCap mock would return true and checkRateLimits mock would return ok:false, the route DOES NOT deflect — it reaches classifier (because gates 4 + 5 are never invoked).
    - Test 4 (chat-six-gate-order.test.ts): Gates 1/2/3 still short-circuit when they trip (e.g., session-not-found stops at 'session_lookup' regardless of flag state).
    - Test 5 (chat-six-gate-order.test.ts): With flag unset, onFinish still calls incrementSpend and incrementIpCost (counter writes preserved for observability).
  </behavior>
  <action>
**Step A — env.ts:**

Edit `src/lib/env.ts`. Add a single optional field to EnvSchema (alphabetize roughly near the bottom optional block):

```typescript
// Quick task 260512-tku: temporary kill-switch wrapping gates 4 (spend-cap) and
// 5 (rate-limits) in /api/chat. Default OFF (unset / anything other than 'true'
// = gates SKIPPED). Set to 'true' in Vercel preview + prod environments to
// re-activate both gates with zero code change. See SEED-002 for re-enable
// criteria. SECURITY RISK while off: only Anthropic org-level $100/mo cap
// remains as cost backstop.
SAFETY_GATES_ENABLED: z.string().optional(),
```

Do NOT mark it required. Do NOT add a default. Do NOT validate the value (any string ok — only literal 'true' activates; everything else is OFF).

**Step B — route.ts:**

Edit `src/app/api/chat/route.ts`:

1. **Just inside the `POST` handler, after `const started = Date.now();`** (around line 110), add a single feature-flag read at request time (Phase 02-04 Turnstile pattern — STATE.md line 108: process.env read at call-time, NOT module-scope, so vitest can mutate per-test without resetModules):

```typescript
// Quick task 260512-tku: temporary kill-switch for gates 4 (spend-cap) and 5
// (rate-limits). Default OFF (unset / anything other than literal 'true' = gates
// SKIPPED). Re-enable by setting SAFETY_GATES_ENABLED='true' in Vercel envs;
// no code change required. SEED-002 tracks re-activation criteria. SECURITY:
// while OFF, only Anthropic org-level $100/mo cap is the cost backstop —
// public-facing agent at https://joe-dollinger-chat.com is exposed to ~$100
// drain if URL discovered. Joe accepted this exposure window 2026-05-13.
// SEED-001 helpers (EVAL_CLI_ALLOWLIST etc. in src/lib/redis.ts) BYTE-IDENTICAL
// — un-flagging restores SEED-001 protection unchanged.
const SAFETY_GATES_ENABLED = process.env.SAFETY_GATES_ENABLED === 'true';
```

2. **Wrap gate 4 (the existing spend-cap block, currently lines 187-220)** in a single conditional. Preserve the entire block contents verbatim — only the outer `if` is new:

```typescript
// 4. spend cap (SAFE-04 / SAFE-09) — GATED by SAFETY_GATES_ENABLED (260512-tku).
// When flag is OFF, gate is skipped entirely: isEmailSpendCapAllowlisted is
// never consulted, isOverCap() is never called, no deflection fires. Counters
// still increment in onFinish (observability preserved). SEED-001 / D-A-01
// allowlist helpers remain present in src/lib/redis.ts for un-flagging.
if (SAFETY_GATES_ENABLED) {
  if (!isEmailSpendCapAllowlisted(session.email) && (await isOverCap())) {
    try {
      await persistDeflectionTurn({
        session_id,
        user_text: lastUser,
        verdict: null,
        deflection_text: DEFLECTIONS.spendcap,
        reason: 'spendcap',
      });
    } catch (e) {
      log(
        {
          event: 'persistence_failed',
          where: 'persistDeflectionTurn(spendcap)',
          error_class: (e as Error).name ?? 'Error',
          error_message: (e as Error).message,
          session_id,
        },
        'error',
      );
    }
    log({ event: 'deflect', reason: 'spendcap', session_id });
    return deflectionResponse('spendcap');
  }
}
```

3. **Wrap gate 5 (the rate-limits block, currently lines 222-250 — `ipKey` declaration + `checkRateLimits` call + deflection)** in the SAME flag conditional:

```typescript
// 5. rate limits (SAFE-05..08) — GATED by SAFETY_GATES_ENABLED (260512-tku).
// When flag is OFF, gate is skipped entirely: ipKey is not computed for
// limiter purposes, checkRateLimits() is never called, no deflection fires.
// Note: ipKey is ALSO consumed by incrementIpCost in onFinish (per-IP cost
// observability) — keep its computation INSIDE this conditional only if it's
// not used elsewhere. INSPECT: ipKey IS referenced inside onFinish (around
// line 393: `incrementIpCost(ipKey, costCents)`). Therefore the ipKey
// computation must NOT be gated — only the limiter call + deflection branch.
const ipKey =
  ipAddress(req) ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'dev';
if (SAFETY_GATES_ENABLED) {
  const rl = await checkRateLimits(ipKey, session.email, session_id);
  if (!rl.ok) {
    try {
      await persistDeflectionTurn({
        session_id,
        user_text: lastUser,
        verdict: null,
        deflection_text: DEFLECTIONS.ratelimit,
        reason: 'ratelimit',
      });
    } catch (e) {
      log(
        {
          event: 'persistence_failed',
          where: 'persistDeflectionTurn(ratelimit)',
          error_class: (e as Error).name ?? 'Error',
          error_message: (e as Error).message,
          session_id,
        },
        'error',
      );
    }
    log({ event: 'deflect', reason: 'ratelimit', which: rl.which, session_id });
    return deflectionResponse('ratelimit');
  }
}
```

**CRITICAL — ipKey scope:** Read route.ts carefully. The existing `const ipKey = ...` (line 224-225) is consumed by `incrementIpCost(ipKey, costCents)` in onFinish (around line 393). Therefore `ipKey` MUST be declared OUTSIDE the `if (SAFETY_GATES_ENABLED)` block so onFinish can still increment per-IP cost. The conditional wraps only the limiter call + deflection, NOT the ipKey computation. Per task_context decision: counters still increment for observability.

4. **DO NOT touch onFinish** (lines 330-442). incrementSpend + incrementIpCost calls stay intact (counters keep accumulating for observability — only gate READS are bypassed, not WRITES).

5. **DO NOT remove or modify imports** of `checkRateLimits`, `isOverCap`, `isEmailSpendCapAllowlisted`, `incrementSpend`, `incrementIpCost` from `@/lib/redis`. They remain imported so the conditional code paths inside the `if (SAFETY_GATES_ENABLED)` block compile when type-checking. TS will not flag them as unused because they ARE used inside the conditional.

6. **DO NOT touch gates 1, 2, 3, 6** (body parse, session lookup, turn cap, classifier) — those stay on unconditionally.

7. **DO NOT delete or modify** the `DEFLECTIONS.spendcap` and `DEFLECTIONS.ratelimit` constants at the top of the file — they remain so when flag flips back on, deflection text is unchanged.

8. **PRESERVE the canonical six-gate header comment** (lines 1-20). Add ONE additional line of context referencing the kill-switch at the bottom of that block:

```
// QUICK TASK 260512-tku (2026-05-13): Gates 4 + 5 are wrapped behind the
// SAFETY_GATES_ENABLED env-var feature flag (default OFF). When flag is OFF
// (the current production state), gates 4 + 5 are SKIPPED at runtime — only
// the Anthropic org-level $100/mo spend cap remains as cost backstop.
// Re-enable: set SAFETY_GATES_ENABLED='true' in Vercel envs. See SEED-002.
```
  </action>
  <verify>
    <automated>npm test -- tests/api/chat-six-gate-order.test.ts</automated>
  </verify>
  <done>
- src/lib/env.ts contains `SAFETY_GATES_ENABLED: z.string().optional()` inside EnvSchema (verifiable: `grep -n "SAFETY_GATES_ENABLED" src/lib/env.ts` returns one match)
- src/app/api/chat/route.ts has exactly TWO `if (SAFETY_GATES_ENABLED)` blocks (verifiable: `grep -c "if (SAFETY_GATES_ENABLED)" src/app/api/chat/route.ts` returns 2). One wraps the gate-4 spend-cap block; one wraps the gate-5 rate-limits block. Gate-1/2/3/6 are unchanged.
- The flag read `const SAFETY_GATES_ENABLED = process.env.SAFETY_GATES_ENABLED === 'true'` lives INSIDE the POST function (call-time read, not module-scope) — verifiable: `grep -n "SAFETY_GATES_ENABLED === 'true'" src/app/api/chat/route.ts` returns one match and the line number is greater than the `export async function POST` line.
- ipKey declaration remains OUTSIDE the `if (SAFETY_GATES_ENABLED)` block so onFinish's `incrementIpCost(ipKey, costCents)` still compiles and runs — verifiable by running the test below.
- onFinish block (lines ~330-442) byte-identical: `git diff src/app/api/chat/route.ts` shows zero changes inside the onFinish callback (incrementSpend + incrementIpCost calls preserved).
- src/lib/redis.ts is BYTE-IDENTICAL: `git diff src/lib/redis.ts` returns empty.
- chat-six-gate-order.test.ts is adjusted (Task 2 below covers test edits) — verification of this task happens via Task 2 + Task 4's final test run.
  </done>
</task>

<task type="auto">
  <name>Task 2: Adjust chat-six-gate-order.test.ts for flag-off default + add flag-on coverage</name>
  <files>tests/api/chat-six-gate-order.test.ts</files>
  <action>
The existing tests in this file assert the canonical six-gate order INCLUDING gates 4 + 5. After Task 1, the default route behavior is flag-off (gates 4 + 5 skipped). We KEEP gate-1/2/3/6 assertions (those still apply) and update gate-4/5 assertions to match flag-off semantics, plus add ONE flag-on test that exercises the legacy behavior.

**Edit strategy — explicit per-test:**

1. **Add a top-level helper** near the existing `makeRequest`/`postChat` helpers (around line 192):

```typescript
// 260512-tku: gates 4 + 5 are now behind SAFETY_GATES_ENABLED env flag.
// Default OFF. Per-test enablement via process.env mutation; afterEach restores.
function withGatesEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.SAFETY_GATES_ENABLED;
  process.env.SAFETY_GATES_ENABLED = 'true';
  return fn().finally(() => {
    if (prev === undefined) delete process.env.SAFETY_GATES_ENABLED;
    else process.env.SAFETY_GATES_ENABLED = prev;
  });
}
```

2. **Add `afterEach` cleanup** to ensure flag state never leaks:

```typescript
afterEach(() => {
  Request.prototype.json = originalJson;
  delete process.env.SAFETY_GATES_ENABLED; // 260512-tku: paranoid cleanup
});
```

(Replace the existing `afterEach` block at line 188-190 with the version above — preserves originalJson restoration, adds env cleanup.)

3. **Update the first `it` block** (current line 198-208 — "fires gates in exact canonical order on a happy-path request"). With flag OFF (default), the recorder must NOT see 'over_cap_check' or 'rate_limit_check'. Replace the expected array:

```typescript
it('fires gates 1/2/3/6 in canonical order on happy-path with SAFETY_GATES_ENABLED unset (default — 260512-tku flag-off)', async () => {
  await postChat();
  expect(gateOrderRecorder).toEqual([
    'body_parse',
    'session_lookup',
    'turnRows_check',
    'classifier',
  ]);
  // Gates 4 + 5 must NOT have fired — kill-switch is off by default.
  expect(isOverCap).not.toHaveBeenCalled();
  expect(checkRateLimits).not.toHaveBeenCalled();
});
```

4. **ADD a new test immediately after** that asserts flag-on restores the full canonical six-gate order:

```typescript
it('fires ALL six gates in canonical order on happy-path when SAFETY_GATES_ENABLED=true (260512-tku flag-on)', async () => {
  await withGatesEnabled(async () => {
    await postChat();
  });
  expect(gateOrderRecorder).toEqual([
    'body_parse',
    'session_lookup',
    'turnRows_check',
    'over_cap_check',
    'rate_limit_check',
    'classifier',
  ]);
});
```

5. **Update the test "stops at session_lookup when session is missing"** (line 210-220): Unchanged behavior — session-not-found is gate 2 which is NOT flagged. Test still passes as-is.

6. **Update "stops at turnRows_check when count >= 60"** (line 222-229): Unchanged — gate 3 not flagged. Still passes as-is.

7. **DELETE or .skip the test "stops at over_cap_check when isOverCap returns true"** (line 231-243): With flag OFF (default), this test's premise (isOverCap returns true → route deflects at gate 4) is no longer accurate — gate 4 is skipped, route advances to classifier. Two options:
   - **Option A (preferred):** Replace with an explicit flag-on variant that wraps the test body in `withGatesEnabled`:

```typescript
it('stops at over_cap_check when isOverCap returns true AND SAFETY_GATES_ENABLED=true (legacy six-gate behavior; 260512-tku flag-on)', async () => {
  isOverCap.mockImplementationOnce(async () => {
    gateOrderRecorder.push('over_cap_check');
    return true;
  });
  await withGatesEnabled(async () => {
    await postChat();
  });
  expect(gateOrderRecorder).toEqual([
    'body_parse',
    'session_lookup',
    'turnRows_check',
    'over_cap_check',
  ]);
});
```

8. **DELETE or replace "stops at rate_limit_check"** (line 245-258) similarly with a flag-on variant:

```typescript
it('stops at rate_limit_check when checkRateLimits returns ok:false AND SAFETY_GATES_ENABLED=true (legacy six-gate behavior; 260512-tku flag-on)', async () => {
  checkRateLimits.mockImplementationOnce(async () => {
    gateOrderRecorder.push('rate_limit_check');
    return { ok: false, which: 'ip10m' as const };
  });
  await withGatesEnabled(async () => {
    await postChat();
  });
  expect(gateOrderRecorder).toEqual([
    'body_parse',
    'session_lookup',
    'turnRows_check',
    'over_cap_check',
    'rate_limit_check',
  ]);
});
```

9. **ADD a new test asserting that when flag is OFF and isOverCap would return true, the route DOES NOT deflect** (catches regressions where someone restores gate 4 unconditionally):

```typescript
it('SAFETY_GATES_ENABLED unset (default): isOverCap=true does NOT trigger spendcap deflection — gate 4 is fully skipped (260512-tku regression trap)', async () => {
  isOverCap.mockImplementation(async () => {
    gateOrderRecorder.push('over_cap_check'); // would record if called
    return true;
  });
  await postChat();
  // Gate 4 NEVER consulted — over_cap_check absent from recorder.
  expect(gateOrderRecorder).not.toContain('over_cap_check');
  expect(isOverCap).not.toHaveBeenCalled();
  // Route reached classifier (gate 6).
  expect(gateOrderRecorder).toContain('classifier');
});
```

10. **ADD a parallel regression trap for gate 5**:

```typescript
it('SAFETY_GATES_ENABLED unset (default): checkRateLimits returning ok:false does NOT trigger ratelimit deflection — gate 5 is fully skipped (260512-tku regression trap)', async () => {
  checkRateLimits.mockImplementation(async () => {
    gateOrderRecorder.push('rate_limit_check'); // would record if called
    return { ok: false, which: 'ip10m' as const };
  });
  await postChat();
  expect(gateOrderRecorder).not.toContain('rate_limit_check');
  expect(checkRateLimits).not.toHaveBeenCalled();
  expect(gateOrderRecorder).toContain('classifier');
});
```

**Net result:** chat-six-gate-order.test.ts has ~7 tests (down from 5, then up to 7-8 depending on whether you delete the old gate-4/5 tests or replace them in place). The describe block title can remain unchanged, but consider appending a 260512-tku note:

```typescript
describe('/api/chat six-gate canonical order (W7 — durable defense; 260512-tku flag-aware)', () => {
```

**Do NOT remove the existing `vi.mock('@/lib/redis')` block** that exports `isEmailSpendCapAllowlisted` and `isEmailIpRatelimitAllowlisted` as `() => false`. These mocks remain valid (the helpers are still imported by route.ts; they're just only consulted when flag is on).
  </action>
  <verify>
    <automated>npm test -- tests/api/chat-six-gate-order.test.ts</automated>
  </verify>
  <done>
- `npm test -- tests/api/chat-six-gate-order.test.ts` passes (all tests green; expected count: 7-8 tests).
- Default (flag-off) behavior verified: happy-path recorder shows only `['body_parse', 'session_lookup', 'turnRows_check', 'classifier']`.
- Flag-on legacy behavior verified: with `SAFETY_GATES_ENABLED='true'`, recorder shows all 6 gates in canonical order.
- Regression traps in place: explicit tests assert that with flag OFF, isOverCap=true and checkRateLimits=fail BOTH NOT deflect. If a future executor accidentally restores either gate unconditionally, these tests fail noisily.
- `process.env.SAFETY_GATES_ENABLED` is cleaned up in afterEach — no flag leak between tests.
  </done>
</task>

<task type="auto">
  <name>Task 3: .skip the 3 SEED-001 contract test files with SEED-002 TODO markers</name>
  <files>tests/api/chat-spendcap-allowlist.test.ts, tests/api/chat-iprl-allowlist.test.ts, tests/api/chat-email-allowlist.test.ts</files>
  <action>
The three SEED-001 contract test files assert allowlist-bypass behavior INSIDE gates 4 and 5. With gates disabled, their premise (allowlisted email bypasses gate X; non-allowlisted email is deflected by gate X) no longer holds — gates are skipped for ALL emails. Preserve the files verbatim with a single-line `.skip` so un-skipping (when gates re-enabled) is a one-line edit per file.

**For each of the three files:**

`tests/api/chat-spendcap-allowlist.test.ts` (line 226), `tests/api/chat-iprl-allowlist.test.ts` (line 214), `tests/api/chat-email-allowlist.test.ts` (line 242):

Change the top-level `describe(...)` to `describe.skip(...)` and add a TODO comment immediately above referencing SEED-002.

**Example for chat-spendcap-allowlist.test.ts (line 226):**

BEFORE:
```typescript
describe('/api/chat — SEED-001 spend-cap allowlist contract', () => {
```

AFTER:
```typescript
// TODO(SEED-002): Un-skip when SAFETY_GATES_ENABLED='true' is set in Vercel
// envs (gates 4 + 5 re-enabled). See .planning/seeds/SEED-002-re-enable-rate-
// limits-and-spend-cap.md for re-enable criteria and the planning quick task
// .planning/quick/260512-tku-disable-rate-limit-spend-cap-gates-globa/ for
// why this was disabled. SEED-001 helper code (EVAL_CLI_ALLOWLIST in
// src/lib/redis.ts) IS PRESERVED — re-enable is .skip → skip removed, no
// implementation work.
describe.skip('/api/chat — SEED-001 spend-cap allowlist contract', () => {
```

**Apply the analogous edit to the other two files**, matching the describe text:

`tests/api/chat-iprl-allowlist.test.ts` line 214:
```typescript
describe('/api/chat — SEED-001 ip-rate-limit allowlist contract', () => {
```
→ prepend SEED-002 TODO comment + change to `describe.skip(...)`.

`tests/api/chat-email-allowlist.test.ts` line 242:
```typescript
describe('/api/chat — SEED-001 email allowlist contract', () => {
```
→ prepend SEED-002 TODO comment + change to `describe.skip(...)`.

**DO NOT delete any test bodies. DO NOT modify any mocks. DO NOT change vi.mock factories.** The files must be one-line-edit reversible. `describe.skip` is supported by vitest natively and emits skipped-test counts in CI output without erroring.

**Rationale per file:**

- `chat-spendcap-allowlist.test.ts`: Asserts gate 4 short-circuits for allowlisted email (Test 1), deflects for pattern-adjacent (Test 2), gate 5 ipcost still trips for allowlisted (Test 3), incrementSpend wired with email opts (Test 4). When gate 4 is OFF, Tests 1-3 premises are wrong (gate 4 never runs); Test 4 is correct but isolated — easier to .skip the whole describe than cherry-pick.

- `chat-iprl-allowlist.test.ts`: Five tests all premised on checkRateLimits internal behavior (gate 5). When gate 5 is OFF, ALL five premises are wrong.

- `chat-email-allowlist.test.ts`: Three tests premised on gate 5 internal behavior (per-email window bypass, pattern-adjacent deflection, per-IP backstop for allowlisted email). All three premises are wrong when gate 5 is OFF.

**NOTE on tests/lib/redis.test.ts** (unit tests for the helpers themselves): These are NOT in scope for .skip. The helpers (EVAL_CLI_ALLOWLIST, isEmailSpendCapAllowlisted, isEmailRatelimitAllowlisted, isEmailIpRatelimitAllowlisted, checkRateLimits, isOverCap, incrementSpend, incrementIpCost) are still imported by route.ts and the helper code is byte-identical. The unit tests for those helpers continue to pass unchanged. Quick task scope: only the three /api/chat integration test files get .skip'd.
  </action>
  <verify>
    <automated>npm test -- tests/api/chat-spendcap-allowlist.test.ts tests/api/chat-iprl-allowlist.test.ts tests/api/chat-email-allowlist.test.ts</automated>
  </verify>
  <done>
- All three files contain `describe.skip(...)` instead of `describe(...)` — verifiable: `grep -c "describe.skip" tests/api/chat-spendcap-allowlist.test.ts tests/api/chat-iprl-allowlist.test.ts tests/api/chat-email-allowlist.test.ts` returns one match per file.
- Each file has a TODO(SEED-002) comment immediately above the describe.skip line — verifiable: `grep -n "TODO(SEED-002)" tests/api/chat-*-allowlist.test.ts` returns 3 matches.
- Test bodies are unchanged — `git diff --stat tests/api/chat-spendcap-allowlist.test.ts tests/api/chat-iprl-allowlist.test.ts tests/api/chat-email-allowlist.test.ts` shows only a few lines changed per file (the describe → describe.skip + TODO comment lines).
- Vitest reports the tests as SKIPPED in output (not failures, not errors). The verify command exits 0.
- Un-skipping path documented in each file's TODO: remove the `.skip` (and optionally the TODO comment) — single-line edit per file.
  </done>
</task>

<task type="auto">
  <name>Task 4: Plant SEED-002 at .planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md</name>
  <files>.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md</files>
  <action>
Create a new file `.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md` following the SEED-001 structure. The seed must capture: trigger condition, rollback steps, SECURITY RISK note about the exposure window, and breadcrumbs back to this quick task. Use the exact YAML frontmatter shape from SEED-001 for tooling parity (id, status, planted, planted_during, trigger_when, scope).

**File contents (write verbatim):**

```markdown
---
id: SEED-002
status: planted
planted: 2026-05-13
planted_during: v1.0 / Phase 6 prep (post-Plan-05-12 LAUNCH; pre-Phase-6 execution)
planted_in_quick_task: 260512-tku-disable-rate-limit-spend-cap-gates-globa
trigger_when: Phase 6 verification working end-to-end OR before broad distribution (QR paper print / LinkedIn push) — whichever comes first
scope: Small
---

# SEED-002: Re-enable rate-limit (gate 5) and spend-cap (gate 4) in /api/chat

## Why This Matters

On 2026-05-13 ~01:15 UTC, after 4+ hours of debugging PR #4 CI eval-gate failures, gates 4 + 5 in /api/chat were globally disabled behind the `SAFETY_GATES_ENABLED` feature flag (default OFF). The structural root cause: `incrementIpCost` accumulates classifier + tool + sub-call costs (~150¢ per eval run server side), which trips SAFE-08 (per-IP cost cap, 150¢/day per IP) on a SINGLE eval run from the GH Actions runner IP. Each prior SEED-001 fix (260512-r4s rate-limit half, 260512-ro4 spend-cap half, 260512-sne ip-rate-limit half) bypassed a specific limiter, but SAFE-08 remained as a last-line backstop that the eval CLI structurally cannot avoid in a single run.

Joe's decision (2026-05-13 01:15 UTC): rather than ship a fourth SEED-001 half exempting SAFE-08 (which would leave eval-cli traffic completely uncapped at the cost layer and make the gate trivially defeatable by anyone who spoofs the email), DISABLE gates 4 + 5 globally and TEMPORARILY rely on the Anthropic org-level $100/mo cap as the sole cost backstop. The trade is: short-term development velocity (eval CLI runs reliably from CI) in exchange for an exposure window where a malicious user discovering the URL can drain ~$100 of Anthropic credits before the org cap halts the API.

## Current State (as of 2026-05-13)

- `SAFETY_GATES_ENABLED` env var is OPTIONAL in `src/lib/env.ts` (zod schema)
- Default OFF in all environments (Vercel preview, Vercel prod, local dev, CI) — none of them set the var, so the literal-'true' check evaluates false
- Gates 1 (body), 2 (session), 3 (turn cap), 6 (classifier) STILL FIRE on every request
- Gates 4 (spend cap) + 5 (rate limits) are SKIPPED at runtime
- Counters (`incrementSpend`, `incrementIpCost`) STILL INCREMENT in onFinish — observability data preserved
- SEED-001 helper code in `src/lib/redis.ts` is BYTE-IDENTICAL (`EVAL_CLI_ALLOWLIST`, `isEmailSpendCapAllowlisted`, `isEmailRatelimitAllowlisted`, `isEmailIpRatelimitAllowlisted`, `checkRateLimits`, `isOverCap`, `incrementSpend`, `incrementIpCost` all preserved)
- Three /api/chat integration test files are `describe.skip`'d with TODO(SEED-002) markers:
  - `tests/api/chat-spendcap-allowlist.test.ts`
  - `tests/api/chat-iprl-allowlist.test.ts`
  - `tests/api/chat-email-allowlist.test.ts`
- `tests/api/chat-six-gate-order.test.ts` was updated with flag-aware tests (default-off assertions + explicit flag-on legacy tests + regression traps)

## SECURITY RISK While Gates Are OFF

**Exposure surface:**
- Anyone who discovers `https://joe-dollinger-chat.com` can send unlimited requests within Anthropic org-level constraints
- Anthropic org-level cap is **$100/month** (per `.planning/STATE.md` Blockers/Concerns and project memory `project_spend_cap_incident_2026-05-12.md`)
- Per-message cost ranges ~3-10¢ for a normal chat reply with prompt-cached system prompt
- Attacker could drain $100 in ~1,000-3,000 messages (~10-30 minutes of sustained attack with no auth)
- Session limiter (200 msg / 7d per session) still applies — attacker must rotate session IDs
- Email gate still applies — attacker must supply a syntactically valid email per session (no email validation, but each session-mint costs an extra `/api/session` call)

**Acceptable because:**
1. Joe is in active development; URL is not yet broadly distributed (no QR print, no LinkedIn push)
2. Anthropic org cap halts the API at $100 — financial loss is bounded
3. Re-enable is a Vercel env-var flip (zero code change, ~30 seconds)
4. Friend-test (Plan 05-12) and Phase 6 KB enrichment can run from CI without rate-limit deflections
5. The five-month-prior Phase 5 deferred-item history shows this gate has been "structurally unreliable" since launch — disabling and rebuilding with cleaner policy is sound

**Mitigations active during the OFF window:**
- Heartbeat alarms (Phase 04-06) STILL fire — abnormal traffic patterns surface in admin dashboard
- Cron-job.org daily digest STILL sends — Joe sees daily spend in email
- Anthropic email alerts at $50 / $75 / $90 of org cap (per Anthropic console default thresholds)
- Counter writes (incrementSpend / incrementIpCost) are preserved, so when gates re-enable, no observability gap

## When to Surface (Trigger Conditions)

**Surface this seed when ANY of the following is true:**

1. **Phase 6 (KB enrichment: about-me hardening) verification is working end-to-end** — verifyEval cat1=15/15 + cat4>=4.0 reliably from CI without deflections. At that point the eval CLI is stable and gates can return.

2. **Before broad distribution** (any of):
   - QR-code resume paper print job is queued
   - LinkedIn push announcing the agent is being drafted
   - Joe shares the URL publicly outside the small friend-test cohort
   - Public-facing portfolio site links to the agent

3. **Anthropic spend pattern shifts toward red** — sustained daily spend >$3/day from non-test traffic for 3+ consecutive days, OR a single-day spike >$10 from non-test traffic

4. **A milestone close-out** — `/gsd-new-milestone` should present this seed when scope includes "production hardening," "abuse controls," "rate-limit policy," or "pre-distribution hygiene"

## Rollback Steps (Re-enable Path)

**Estimated effort: 10-20 minutes including verification.**

1. **Set the Vercel env var** in BOTH Preview and Production environments:
   - `SAFETY_GATES_ENABLED=true`
   - Apply via Vercel dashboard OR `vercel env add SAFETY_GATES_ENABLED production` then paste `true`

2. **Trigger a fresh deploy** so the new env var takes effect:
   - `git commit --allow-empty -m "chore: re-enable safety gates via SAFETY_GATES_ENABLED=true"`
   - `git push origin main`
   - Wait for Vercel deploy → preview-eval check passes → prod alias flips

3. **Un-skip the three integration test files** (single-line edit per file):
   - `tests/api/chat-spendcap-allowlist.test.ts`: change `describe.skip(...)` → `describe(...)` (remove `.skip`)
   - `tests/api/chat-iprl-allowlist.test.ts`: same
   - `tests/api/chat-email-allowlist.test.ts`: same
   - Optionally remove the TODO(SEED-002) comments above each describe

4. **Verify locally**:
   - `SAFETY_GATES_ENABLED=true npm test` — full suite green, including the 3 un-skipped files
   - `npx tsc --noEmit` — exit 0
   - `npm run build` — exit 0

5. **Verify in production** post-deploy:
   - Send a chat request via the prod URL — confirm normal response (gates 4 + 5 active but allowlist exempts eval-cli; recruiter traffic well under limiter thresholds)
   - Check `/admin/abuse` for any new ratelimit / spendcap deflections
   - Confirm SEED-001 protection: eval CLI from CI continues to pass (D-A-01 wiring intact)

6. **Optional cleanup** (decoupled from re-enable):
   - Remove the `SAFETY_GATES_ENABLED` env-var read and `if (SAFETY_GATES_ENABLED)` wrappers from `src/app/api/chat/route.ts` — gates 4 + 5 become unconditional again, mirroring the pre-260512-tku state
   - Remove the optional `SAFETY_GATES_ENABLED` field from `src/lib/env.ts` EnvSchema
   - Remove `SAFETY_GATES_ENABLED` from Vercel envs
   - Remove the regression-trap "flag-off" tests from `tests/api/chat-six-gate-order.test.ts` (keep only the canonical six-gate order tests, restored to the pre-260512-tku state)
   - Mark this seed `status: resolved` and add `resolved_on` / `resolved_by` to the YAML frontmatter
   - **Trade-off:** keeping the flag in place gives a kill-switch for future incidents (e.g., another structural eval-gate problem); removing it simplifies the route. Decision deferred to re-enable time.

## Acceptance Criteria (For Marking This Seed Resolved)

- `SAFETY_GATES_ENABLED='true'` is set in Vercel preview + prod environments
- Production fresh-deploy has run with the new env var
- All three SEED-001 integration test files are un-`.skip`'d and passing
- `npm test` passes locally (full suite green)
- `npx tsc --noEmit` passes (exit 0)
- `npm run build` passes (exit 0)
- A live request to `https://joe-dollinger-chat.com/api/chat` with a normal-traffic email confirms gate 4 + 5 are active (e.g., synthetic spend-cap test deflects with `reason: 'spendcap'` after forcing `isOverCap=true` via admin tools)
- SEED-001 (EVAL_CLI_ALLOWLIST exemption) continues to protect eval-cli@joedollinger.dev from rate-limit / spend-cap deflections — verifiable via a CI eval-gate run that passes after re-enable

## Out of Scope

- **Building a NEW rate-limit policy** (different thresholds, different keying strategy, etc.) — that's a Phase 6+ design conversation; SEED-002 is JUST re-enabling the existing pre-260512-tku gates with the SEED-001 allowlist intact. New policy is a separate seed.
- **Removing SAFE-08 (per-IP cost cap) from the eval-cli allowlist scope** — this is what would close the structural gap that triggered 260512-tku. If Phase 6 decides eval-cli@ should also bypass SAFE-08, that's a fourth SEED-001 half (call it `260513-XXX-exempt-eval-cli-from-safe-08`) tracked separately. SEED-002 leaves SAFE-08 alone.
- **Adding Turnstile or CAPTCHA as an additional gate** — pre-existing CONTEXT pattern (Phase 02-04 wired Turnstile feature-flagged OFF); flipping that flag is a separate operational call, not part of re-enable.
- **Anthropic org-cap adjustment from $100/mo** — that's an external dashboard action; not in this seed's scope.

## Breadcrumbs

- `.planning/quick/260512-tku-disable-rate-limit-spend-cap-gates-globa/260512-tku-PLAN.md` — the disabling plan (this seed was planted by Task 4 of that plan)
- `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` — predecessor seed; SEED-001 helpers are preserved and continue to work when SEED-002 re-enables gates
- `src/app/api/chat/route.ts` — primary edit site (two `if (SAFETY_GATES_ENABLED)` blocks to either remove or leave in place)
- `src/lib/env.ts` — `SAFETY_GATES_ENABLED: z.string().optional()` field
- `src/lib/redis.ts` — BYTE-IDENTICAL across 260512-tku; helpers ready for re-use
- `tests/api/chat-six-gate-order.test.ts` — flag-aware tests added 260512-tku Task 2; revert or keep based on cleanup decision
- `tests/api/chat-spendcap-allowlist.test.ts`, `tests/api/chat-iprl-allowlist.test.ts`, `tests/api/chat-email-allowlist.test.ts` — `describe.skip`'d with TODO(SEED-002)
- `.planning/STATE.md` Quick Tasks Completed table — 260512-tku entry documents the disabling
- Project memory `project_spend_cap_incident_2026-05-12.md` — the 24h silent-lockout incident that informed this trade-off

## Notes from Planting Session

- Planted on the night PR #4 stayed red after three SEED-001 halves shipped. The structural finding: SAFE-08 accumulates classifier + tool + sub-call costs per onFinish, hitting 150¢ in a single eval run.
- Joe explicitly rejected adding a fourth SEED-001 half to exempt SAFE-08 — that would leave eval-cli traffic uncapped and trivially exploitable by email-spoofing attackers.
- The decision to disable gates 4 + 5 GLOBALLY (not just for eval-cli) was made because (a) the eval-cli exemption was already eating most of the gate's value, (b) the cleanest "kill-switch" pattern is binary and global, (c) re-enabling with cleaner policy is sound future work, and (d) Anthropic org-cap of $100/mo bounds the exposure.
- The kill-switch was implemented as an env-var feature flag rather than code deletion because (1) the helpers in `src/lib/redis.ts` are byte-identical (re-enable is mechanical), (2) the call-time `process.env` read pattern (Phase 02-04 Turnstile precedent) enables per-test env mutation without resetModules, and (3) re-enabling is a Vercel env-var flip rather than a code-review-required PR.
- Estimated re-enable trigger: after Phase 6 verification works end-to-end. Phase 6 expected to start tomorrow (2026-05-13) after this quick task ships, with eval-cli CI working again.
```

**Final check:** The file must NOT contain any backticks-escape sequences that break markdown rendering. Use literal markdown — code blocks with triple-backticks, headings with `##`, etc. The Resolution Notes section will be added when this seed is marked resolved (analogous to SEED-001 post-resolution amendments).
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const p = '.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md'; const c = fs.readFileSync(p, 'utf8'); const checks = [['SEED-002', c.includes('SEED-002')], ['status: planted', c.includes('status: planted')], ['SAFETY_GATES_ENABLED', c.includes('SAFETY_GATES_ENABLED')], ['SECURITY RISK', c.toUpperCase().includes('SECURITY RISK')], ['Rollback', c.toLowerCase().includes('rollback')], ['260512-tku', c.includes('260512-tku')]]; let fail = false; for (const [name, ok] of checks) { console.log(ok ? 'OK ' : 'FAIL', name); if (!ok) fail = true; } process.exit(fail ? 1 : 0);"</automated>
  </verify>
  <done>
- File `.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md` exists.
- Frontmatter contains `id: SEED-002`, `status: planted`, `planted: 2026-05-13`, `scope: Small`.
- File contains a SECURITY RISK section calling out the $100/mo Anthropic org cap exposure window.
- File contains a Rollback Steps section with the 6 numbered steps (env var → deploy → un-skip tests → verify locally → verify prod → optional cleanup).
- File contains a Trigger When section listing the four surface conditions (Phase 6 verification working / broad distribution prep / spend pattern shift / milestone close-out).
- File contains Breadcrumbs linking back to 260512-tku quick-task path + SEED-001 + the three .skip'd test files + src/app/api/chat/route.ts + src/lib/env.ts.
- The verify command exits 0 (all 6 grep checks pass).
  </done>
</task>

<task type="auto">
  <name>Task 5: Run full verification gates — npm test, npx tsc --noEmit, npm run build</name>
  <files>(verification only — no edits)</files>
  <action>
Run the three full verification gates in sequence and confirm each exits 0. These are project-wide checks (NOT scoped to specific files) — local feedback memory `feedback_local_vs_vercel_build.md` requires running `npx tsc --noEmit` + `npm run build` before declaring TS/build work done, because vitest passes do not catch what Vercel's `next build` strict tsc catches.

**Sequence:**

1. **Full test suite:**
   ```
   npm test
   ```
   Expected output: all non-skipped tests green; 3 describe.skip blocks reported as skipped (chat-spendcap-allowlist, chat-iprl-allowlist, chat-email-allowlist); chat-six-gate-order tests pass (7-8 tests); tests/lib/redis.test.ts continues to pass unchanged (helpers byte-identical); all other test files unaffected. Exit 0.

2. **TypeScript strict-check:**
   ```
   npx tsc --noEmit
   ```
   Expected: zero errors, exit 0. This catches the AI SDK v6 onFinish destructure issue and similar strict-mode pitfalls that `next dev` and `vitest` do not flag (memory: feedback_local_vs_vercel_build).

3. **Production build:**
   ```
   npm run build
   ```
   Expected: build succeeds, exit 0. Confirms route.ts compiles cleanly with the new feature-flag block; env.ts's optional `SAFETY_GATES_ENABLED` does not break the Zod parse at module load (since it's optional, absent envs continue to work).

**If any step fails:**
- Read the error output carefully.
- Most likely failure modes:
  a. TypeScript: `ipKey` declared inside `if (SAFETY_GATES_ENABLED)` block but referenced in onFinish — FIX: move `ipKey` declaration OUTSIDE the conditional (per Task 1 critical note).
  b. TypeScript: unused-import warning for `checkRateLimits`, `isOverCap`, `isEmailSpendCapAllowlisted` — FIX: confirm they're used INSIDE the `if (SAFETY_GATES_ENABLED)` blocks (TS doesn't flag conditionally-used imports as unused).
  c. Test failure: chat-six-gate-order recorder shows unexpected gate — FIX: re-verify Task 2 edits; check `withGatesEnabled` helper is in scope of each test.
  d. Test failure: process.env.SAFETY_GATES_ENABLED leaks between tests — FIX: `afterEach` cleanup is present and the `withGatesEnabled` helper restores the prior value.

**Do NOT proceed to commit until all three gates exit 0.**
  </action>
  <verify>
    <automated>npm test && npx tsc --noEmit && npm run build</automated>
  </verify>
  <done>
- `npm test` exits 0 — full suite green except the 3 describe.skip blocks (chat-spendcap-allowlist, chat-iprl-allowlist, chat-email-allowlist) which report as skipped.
- `npx tsc --noEmit` exits 0 — zero TypeScript errors.
- `npm run build` exits 0 — production build succeeds.
- Manual eyeball confirms: no surprise test count drops (e.g., redis.test.ts count unchanged; chat-six-gate-order.test.ts has 7-8 tests up from 5).
- Ready for git commit.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Public internet → /api/chat | Untrusted request hits the six-gate prelude; gates 4 + 5 are now SKIPPED in default config |
| Anthropic org-level $100/mo cap | Final cost backstop — the ONLY remaining cost cap when SAFETY_GATES_ENABLED is OFF |
| Vercel env-var configuration | The kill-switch is controlled by SAFETY_GATES_ENABLED — anyone with Vercel project access can flip gates back on |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-tku-01 | T (Tampering) | The feature flag itself (`process.env.SAFETY_GATES_ENABLED`) | mitigate | Strict equality check `=== 'true'` (not truthy) — empty string / '0' / 'false' / undefined all → OFF. Eliminates "developer sets var to '1' or 'yes' thinking it's enabled" footgun. |
| T-tku-02 | D (Denial of service / cost-DoS) | /api/chat now lacks gates 4 + 5 — public-facing agent at joe-dollinger-chat.com | accept | $100/mo Anthropic org cap bounds financial loss. Session limiter (200 msg/7d per session) still applies. Recruiter URL not yet broadly distributed (no QR print, no LinkedIn). Daily digest + Anthropic email alerts at $50/$75/$90 of cap surface attack early. SEED-002 trigger conditions force re-enable before broad distribution. Joe accepted exposure window 2026-05-13 01:15 UTC. |
| T-tku-03 | I (Information disclosure) | onFinish increments still write counters even when gates don't read them | mitigate | Intentional — observability data preserved so admin dashboard + alarms can still detect abnormal traffic during the OFF window. No threat — counters are write-only, never returned in response bodies. |
| T-tku-04 | E (Elevation of privilege) | Future executor restores gate 4 or gate 5 unconditionally, accidentally breaking the kill-switch contract | mitigate | Regression-trap tests in chat-six-gate-order.test.ts: explicit "with flag OFF, isOverCap=true does NOT deflect" and "with flag OFF, checkRateLimits=fail does NOT deflect" — if a future executor removes the `if (SAFETY_GATES_ENABLED)` wrapper, these tests fail noisily. SEED-002 documents the kill-switch contract for traceability. |
| T-tku-05 | R (Repudiation) | When this is reverted later, no trace of why gates were off | mitigate | SEED-002 file documents trigger, rollback, security risk note, decision context. CLAUDE.md memory `project_spend_cap_incident_2026-05-12.md` already captures the upstream incident. STATE.md Quick Tasks Completed table will get a 260512-tku entry on commit. Three test files have inline TODO(SEED-002) comments pointing back to the seed. |
| T-tku-06 | S (Spoofing) | Attacker spoofs eval-cli email to abuse the now-disabled gates | accept | Moot — gates are OFF for ALL emails, not just allowlisted ones. Spoofing eval-cli@joedollinger.dev gives no additional bypass over what's already available. When gates re-enable (SEED-002), SEED-001 allowlist's exact-match contract (not regex, not suffix, not case-insensitive) preserved unchanged. |
| T-tku-07 | T (Tampering) | Test file `describe.skip` accidentally leaves a `.skip` in place after re-enable | mitigate | TODO(SEED-002) comments in each .skip'd file. SEED-002 Rollback Step 3 explicitly enumerates which files to un-skip. Single-line edit per file. Build does NOT fail on .skip — but SEED-002 acceptance criteria require un-skip before marking resolved. |

</threat_model>

<verification>
**Verification gates (all three MUST exit 0 — Task 5):**

1. `npm test` — full suite green; 3 describe.skip blocks reported as skipped; chat-six-gate-order has 7-8 tests passing; redis.test.ts unchanged
2. `npx tsc --noEmit` — zero TS errors
3. `npm run build` — production build succeeds

**Manual eyeball verification (post-Task-5):**

- `git diff src/lib/redis.ts` returns EMPTY (byte-identical confirmation)
- `git diff src/app/api/chat/route.ts | grep -c "SAFETY_GATES_ENABLED"` returns >= 3 matches (one flag read, two if-block wraps; potentially more in comments)
- `grep -c "^if (SAFETY_GATES_ENABLED)" src/app/api/chat/route.ts` returns 2 (one for gate 4, one for gate 5)
- `grep -c "describe.skip" tests/api/chat-{spendcap,iprl,email}-allowlist.test.ts` returns 1 per file (3 total)
- `grep -c "TODO(SEED-002)" tests/api/chat-{spendcap,iprl,email}-allowlist.test.ts` returns 1 per file (3 total)
- `ls .planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md` succeeds
- `grep -l "SAFETY_GATES_ENABLED" src/lib/env.ts` returns the file path

**Goal-backward checks (truths → must-haves):**

- TRUTH: "Default OFF — gates 4 + 5 skipped at runtime"
  - PROOF: chat-six-gate-order.test.ts "happy-path with SAFETY_GATES_ENABLED unset" test asserts recorder DOES NOT contain `over_cap_check` or `rate_limit_check`
- TRUTH: "Setting env to 'true' re-activates both gates with zero code change"
  - PROOF: chat-six-gate-order.test.ts "happy-path with SAFETY_GATES_ENABLED=true" test asserts full canonical six-gate order including gates 4 + 5
- TRUTH: "Counters still increment for observability"
  - PROOF: Task 1 explicitly preserves onFinish; `git diff` of the onFinish block shows zero changes; chat-six-gate-order.test.ts incrementSpend/incrementIpCost mocks remain wired
- TRUTH: "SEED-001 helpers byte-identical"
  - PROOF: `git diff src/lib/redis.ts` returns empty
- TRUTH: "Test files .skip'd cleanly — un-skip is a one-line edit"
  - PROOF: Each .skip'd file has exactly one `describe.skip` and zero other body changes (mocks, test functions, imports all unchanged)
- TRUTH: "SEED-002 exists with all required sections"
  - PROOF: Task 4 verify command exits 0 (6 section/keyword checks pass)
</verification>

<success_criteria>
1. **Code changes minimal and reversible:**
   - 1 line added to `src/lib/env.ts` (optional zod field)
   - 1 in-function feature-flag read added to `src/app/api/chat/route.ts`
   - 2 `if (SAFETY_GATES_ENABLED) { ... }` wrappers around existing gate-4 and gate-5 code blocks (no inner-block edits)
   - `ipKey` declaration stays OUTSIDE the conditional so onFinish's `incrementIpCost(ipKey, costCents)` still resolves
   - Zero changes to `src/lib/redis.ts`
   - Zero changes to onFinish callback (counters preserved)
   - Zero changes to imports list in route.ts

2. **Test coverage adapted, NOT deleted:**
   - 3 SEED-001 contract test files describe.skip'd with TODO(SEED-002) markers
   - chat-six-gate-order.test.ts updated: default tests assert flag-off behavior; new flag-on tests assert legacy six-gate behavior; new regression traps assert flag-off truly skips gates 4 + 5
   - Existing unit tests (tests/lib/redis.test.ts etc.) untouched

3. **SEED-002 planted:**
   - File `.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md` exists with all required sections (trigger, rollback, security risk, breadcrumbs, acceptance criteria)
   - YAML frontmatter follows SEED-001 convention

4. **All verification gates pass:**
   - `npm test` exit 0 (3 describe blocks skipped as expected)
   - `npx tsc --noEmit` exit 0
   - `npm run build` exit 0

5. **Operational readiness:**
   - To DEACTIVATE gates (current state): no action — default OFF
   - To REACTIVATE gates: set `SAFETY_GATES_ENABLED=true` in Vercel preview + prod envs, trigger fresh deploy
   - Total re-enable time: <30 seconds (env var) + ~2 min Vercel deploy + ~5 min un-skip tests locally
</success_criteria>

<output>
After completion:
1. Confirm all five tasks done
2. Update `.planning/STATE.md` Quick Tasks Completed table with a row:
   - `260512-tku | Globally disable rate-limit (gate 5) + spend-cap (gate 4) gates in /api/chat behind SAFETY_GATES_ENABLED env-var feature flag (default OFF). SEED-001 helpers + counter increments preserved. 3 SEED-001 contract test files .skip'd with TODO(SEED-002); chat-six-gate-order updated with flag-aware tests + regression traps. SEED-002 planted with trigger/rollback/SECURITY-RISK note. Anthropic $100/mo org cap is now sole cost backstop — exposure window accepted by Joe (2026-05-13 01:15 UTC) in exchange for unblocking PR #4 CI eval gate. | 2026-05-13 | <commit-sha> | .planning/quick/260512-tku-disable-rate-limit-spend-cap-gates-globa/`
3. Commit the changes with message: `feat(safety): kill-switch gates 4+5 in /api/chat via SAFETY_GATES_ENABLED flag; plant SEED-002`

Single commit. Include all modified files + the new SEED-002 file + STATE.md update.
</output>
