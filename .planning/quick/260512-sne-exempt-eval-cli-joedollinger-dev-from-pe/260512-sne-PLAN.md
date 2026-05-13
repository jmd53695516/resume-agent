---
phase: quick
plan: 260512-sne
type: execute
wave: 1
depends_on:
  - 260512-r4s  # rate-limit half (per-email window) — landed e3dbfae
  - 260512-ro4  # spend-cap half (SAFE-04 global counter) — landed 5c19fa1 + 423c984
  - SEED-001    # original seed — already `status: resolved` after r4s + ro4; this task extends to all three halves
files_modified:
  - src/lib/redis.ts
  - tests/lib/redis.test.ts
  - tests/api/chat-iprl-allowlist.test.ts                # NEW
  - tests/api/chat-email-allowlist.test.ts               # 1-line mock surface addition
  - tests/api/chat-spendcap-allowlist.test.ts            # 1-line mock surface addition
  - tests/api/chat-six-gate-order.test.ts                # 1-line mock surface addition
  - tests/api/chat-tools.test.ts                         # 1-line mock surface addition
  - .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md
autonomous: true
requirements: [SEED-001]
tags: [seed-001, ip-rate-limit, eval-cli, ci-reliability, abuse-controls, safe-05, safe-06, safe-08]

must_haves:
  truths:
    - "Eval-cli email (`eval-cli@joedollinger.dev`) bypasses the per-IP 10-minute sliding-window rate limiter (`ipLimiter10m`, 20/10min) — request 21 from one source IP within 10 minutes still reaches the classifier"
    - "Eval-cli email bypasses the per-IP daily sliding-window rate limiter (`ipLimiterDay`, 60/day) — request 61 from one source IP within a day still reaches the classifier"
    - "All other emails (including pattern-adjacent `eval-cli-test@`, `EVAL-CLI@`, `eval-cli@joedollinger.dev.attacker.com`) STILL hit both ip10m and ipday (exact-match Set, no .toLowerCase/.endsWith/regex)"
    - "Per-IP cost cap (SAFE-08, 150¢/day per IP at `resume-agent:ipcost:YYYY-MM-DD:<ipKey>`) STILL applies to eval-cli email — security-critical last backstop preserved (T-sne-04 mitigation; mirrors T-ro4-07 assertion in chat-spendcap-allowlist Test 4)"
    - "Session limiter (`sessionLimiter`, 200/7d) STILL applies to eval-cli email — D-A-01 explicit scope boundary; safety net preserved"
    - "Per-email rate limit STILL exempt (already shipped at e3dbfae; preserved via unified `EVAL_CLI_ALLOWLIST` Set)"
    - "SAFE-04 global spend cap STILL exempt for eval-cli (already shipped at 5c19fa1/423c984; preserved via unified `EVAL_CLI_ALLOWLIST` Set)"
    - "Six-gate order in /api/chat unchanged — `chat-six-gate-order.test.ts` passes byte-identical (rate-limit check still fires 5th in canonical sequence; happy-path uses non-allowlisted r@x.com so gate 5 still records `rate_limit_check`)"
    - "Unified `EVAL_CLI_ALLOWLIST` Set remains the single source of truth — three helpers (`isEmailRatelimitAllowlisted`, `isEmailSpendCapAllowlisted`, `isEmailIpRatelimitAllowlisted`) all consult it; drift between any helper and the others is caught by one test"
    - "src/app/api/chat/route.ts is BYTE-IDENTICAL after this change — the exemption logic lives entirely inside `checkRateLimits` in src/lib/redis.ts (mirrors r4s approach)"
  artifacts:
    - path: "src/lib/redis.ts"
      provides: "New `isEmailIpRatelimitAllowlisted(email)` helper (third sibling alongside `isEmailRatelimitAllowlisted` + `isEmailSpendCapAllowlisted`); extended `checkRateLimits` short-circuits `ipLimiter10m.limit()` and `ipLimiterDay.limit()` with synthetic `Promise.resolve({ success: true } as const)` when email is allowlisted; updated comment header at EVAL_CLI_ALLOWLIST declaration to mention ip10m/ipday exemption alongside rate-limit + spend-cap"
      contains: "isEmailIpRatelimitAllowlisted"
    - path: "src/app/api/chat/route.ts"
      provides: "ZERO diff — all logic lives inside checkRateLimits; the six-gate sequence and call signature at line 226 (`checkRateLimits(ipKey, session.email, session_id)`) are byte-identical"
    - path: "tests/lib/redis.test.ts"
      provides: "6 new direct-unit tests on `isEmailIpRatelimitAllowlisted` (mirrors existing isEmailRatelimitAllowlisted + isEmailSpendCapAllowlisted 6-case suite); extended drift-detection describe block to cover all THREE helpers iterating the unified Set; 1 new test asserting `checkRateLimits` SKIPS ip10m + ipday for allowlisted emails while still firing email + session (D-A-01 scope boundary); 1 new test (`it.each`) asserting pattern-adjacent emails STILL trigger ip10m"
    - path: "tests/api/chat-iprl-allowlist.test.ts"
      provides: "5 end-to-end /api/chat integration tests covering: (1) eval-cli bypasses ip10m (cap synthetic at 20, eval-cli reaches classifier on request 21); (2) eval-cli bypasses ipday (cap synthetic at 60, eval-cli reaches classifier on request 61); (3) pattern-adjacent `eval-cli-test@` STILL deflects with reason=ratelimit at ip10m (exact-match contract); (4) per-IP cost cap (SAFE-08) STILL trips for eval-cli when ipcost >= 150¢ (T-sne-04 last-line backstop — mirrors chat-spendcap-allowlist Test 3); (5) session limiter STILL trips for eval-cli (D-A-01 scope boundary)"
    - path: "tests/api/chat-email-allowlist.test.ts"
      provides: "1-line addition to the `@/lib/redis` mock factory: `isEmailIpRatelimitAllowlisted: () => false` so the route's new import resolves; no behavioral change to the 3 existing rate-limit-half tests"
    - path: "tests/api/chat-spendcap-allowlist.test.ts"
      provides: "1-line addition to the `@/lib/redis` mock factory: `isEmailIpRatelimitAllowlisted: () => false` so the route's new import resolves (NOTE: route.ts does NOT change in this plan — but the import surface in src/lib/redis.ts grows; some test mocks reflect the @/lib/redis surface, others reflect what route.ts imports — this mock addition is for surface completeness)"
    - path: "tests/api/chat-six-gate-order.test.ts"
      provides: "1-line addition to the `@/lib/redis` mock factory: `isEmailIpRatelimitAllowlisted: () => false`; happy-path uses non-allowlisted r@x.com so gate 5 still records `rate_limit_check` (canonical six-gate order preserved)"
    - path: "tests/api/chat-tools.test.ts"
      provides: "1-line addition to the `@/lib/redis` mock factory: `isEmailIpRatelimitAllowlisted: () => false`; Rule 3 deviation precedent from ro4 — pre-existing test file that mocks @/lib/redis must export every name redis.ts exports"
    - path: ".planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md"
      provides: "Frontmatter `resolved_by` extended from `[260512-r4s, 260512-ro4]` to `[260512-r4s, 260512-ro4, 260512-sne]`; Resolution Notes section extended with a third paragraph covering the ip-rate-limit half"
  key_links:
    - from: "src/lib/redis.ts checkRateLimits"
      to: "src/lib/redis.ts isEmailIpRatelimitAllowlisted"
      via: "inline `const ipExempt = isEmailIpRatelimitAllowlisted(email);` guard above Promise.all; ip10m + ipday calls become `ipExempt ? Promise.resolve({ success: true } as const) : ipLimiterXm.limit(ipKey)`"
      pattern: "isEmailIpRatelimitAllowlisted\\(email\\)"
    - from: "src/lib/redis.ts isEmailIpRatelimitAllowlisted"
      to: "src/lib/redis.ts EVAL_CLI_ALLOWLIST"
      via: "all three helpers consult the same unified Set — single source of truth (D-A-02)"
      pattern: "EVAL_CLI_ALLOWLIST\\.has"
    - from: "src/lib/redis.ts EVAL_CLI_ALLOWLIST"
      to: "src/lib/eval/agent-client.ts mintEvalSession `eval-cli@joedollinger.dev` literal"
      via: "shared Set membership — three-helper drift-detection test in tests/lib/redis.test.ts now iterates the Set across ALL three helpers"
      pattern: "eval-cli@joedollinger\\.dev"
    - from: "src/app/api/chat/route.ts line 226"
      to: "src/lib/redis.ts checkRateLimits"
      via: "BYTE-IDENTICAL call: `checkRateLimits(ipKey, session.email, session_id)` — signature unchanged, behavior change is internal"
      pattern: "checkRateLimits\\(ipKey, session\\.email, session_id\\)"
---

<objective>
Exempt the eval CLI's synthetic email (`eval-cli@joedollinger.dev`) from the per-IP rate limiters `ipLimiter10m` (20 msg/10min) and `ipLimiterDay` (60 msg/day) so CI eval runs from a single GitHub Actions runner IP (~20 reqs in ~2 minutes) stop tripping the ip10m sliding window mid-run. Closes the ip-rate-limit half of SEED-001 (rate-limit + spend-cap halves landed earlier today; this plan completes the third and final half).

Per D-A-01: bypass `ipLimiter10m.limit(ipKey)` and `ipLimiterDay.limit(ipKey)` for allowlisted emails inside `checkRateLimits`. Same `Promise.resolve({ success: true } as const)` synthetic pattern used for the email-limiter exemption in the rate-limit half (e3dbfae). Session limiter (`sessionLimiter`, 200 msg/7d) STILL fires for eval-cli traffic — D-A-01 explicit scope boundary; 200/7d is generous enough that it's a free safety net.

Per D-A-02: add `isEmailIpRatelimitAllowlisted(email)` as the third sibling helper alongside existing `isEmailRatelimitAllowlisted` + `isEmailSpendCapAllowlisted`. All three consult the unified `EVAL_CLI_ALLOWLIST` Set — single source of truth, drift caught by one test that iterates the Set across all three helpers.

Per D-A-03: SAFE-08 per-IP cost cap (150¢/day/IP at `resume-agent:ipcost:YYYY-MM-DD:<ipKey>`) is the ONLY remaining cost-based last-line backstop for eval-cli traffic after this lands. Joe explicitly accepted the tradeoff. Numbers:
- $1.50/day max per IP (150¢)
- An attacker who spoofs the eval-cli email can burn 150¢/day per source IP in a tight loop (per-IP rate limits no longer throttle once email is allowlisted)
- Distributed attack: 150¢ × N IPs/day; each IP throttled independently by SAFE-08
- Org-level Anthropic spend cap is $100/mo per project memory, so sustained attack is bounded

Purpose: Resolves the structural root cause of the 2026-05-13T00:29:20Z PR #4 CI eval run failure — `runId HYxSxtSM_8f782_NdJ7kr` deflected cat1-fab-013/014/015 with `deflectionReason: "ratelimit"` because the eval CLI's 20 requests (15 cat1 + 5 cat4-judge) in ~2 minutes from one GH Actions runner IP tripped ip10m=20/10min at request 21. With this fix, the Vercel Deployment Checks gate becomes reliably passable from CI from a single-IP runner.

Output:
- New `isEmailIpRatelimitAllowlisted(email)` helper in `src/lib/redis.ts`
- `checkRateLimits` skips `ipLimiter10m.limit()` AND `ipLimiterDay.limit()` for allowlisted emails (keeping email + session + ipcost intact); session + ipcost still fire — Promise.all shape and precedence ordering (ip10m → ipday → email → session → ipcost) unchanged
- 8+ regression tests in `tests/lib/redis.test.ts` (6 direct-unit cases + 1 checkRateLimits-skip + 1 it.each pattern-adjacency + extended 3-helper drift-detection)
- 5 integration tests in new `tests/api/chat-iprl-allowlist.test.ts`
- 1-line mock additions in 4 existing test files (chat-email-allowlist, chat-spendcap-allowlist, chat-six-gate-order, chat-tools)
- SEED-001 seed doc extended with `resolved_by` third entry + Resolution Notes third paragraph
- Updated comment header at `EVAL_CLI_ALLOWLIST` declaration mentioning ip10m/ipday exemption alongside existing rate-limit + spend-cap mentions
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md
@.planning/quick/260512-sne-exempt-eval-cli-joedollinger-dev-from-pe/260512-sne-CONTEXT.md
@.planning/quick/260512-r4s-exempt-eval-cli-email-from-per-email-rat/260512-r4s-PLAN.md
@.planning/quick/260512-ro4-exempt-eval-cli-joedollinger-dev-from-sa/260512-ro4-PLAN.md
@.planning/quick/260512-ro4-exempt-eval-cli-joedollinger-dev-from-sa/260512-ro4-SUMMARY.md
@src/lib/redis.ts
@src/app/api/chat/route.ts
@src/lib/eval/agent-client.ts
@tests/lib/redis.test.ts
@tests/api/chat-email-allowlist.test.ts
@tests/api/chat-spendcap-allowlist.test.ts
@tests/api/chat-six-gate-order.test.ts
@tests/api/chat-tools.test.ts

<interfaces>
<!-- Key types / contracts the executor needs. Extracted from the live codebase
     post-ro4 merge (HEAD has both r4s + ro4 landed). Executor uses these
     directly — no codebase exploration needed. -->

From src/lib/redis.ts (CURRENT shape — what we're modifying):

```typescript
// Already-shipped — unchanged in this plan:
export const EVAL_CLI_ALLOWLIST: ReadonlySet<string> = new Set([
  'eval-cli@joedollinger.dev',
]);

// Already-shipped helpers — unchanged in this plan:
export function isEmailRatelimitAllowlisted(email: string): boolean {
  return EVAL_CLI_ALLOWLIST.has(email);
}
export function isEmailSpendCapAllowlisted(email: string): boolean {
  return EVAL_CLI_ALLOWLIST.has(email);
}

// NEW in this plan — third sibling helper:
export function isEmailIpRatelimitAllowlisted(email: string): boolean {
  return EVAL_CLI_ALLOWLIST.has(email);
}

// Signature UNCHANGED — internal behavior change is conditional skips on ip10m + ipday:
export type RateLimitCheck =
  | { ok: true }
  | { ok: false; which: 'ip10m' | 'ipday' | 'email' | 'session' | 'ipcost' };

export async function checkRateLimits(
  ipKey: string,
  email: string,
  sessionId: string,
): Promise<RateLimitCheck>;
```

From src/lib/redis.ts checkRateLimits CURRENT shape (lines 102-129 — what we're modifying):

```typescript
export async function checkRateLimits(
  ipKey: string,
  email: string,
  sessionId: string,
): Promise<RateLimitCheck> {
  const emailExempt = isEmailRatelimitAllowlisted(email);

  const [ip10, ipDay, emailRes, sessionRes, ipCostCents] = await Promise.all([
    ipLimiter10m.limit(ipKey),
    ipLimiterDay.limit(ipKey),
    emailExempt
      ? Promise.resolve({ success: true } as const)
      : emailLimiterDay.limit(email),
    sessionLimiter.limit(sessionId),
    getIpCostToday(ipKey),
  ]);

  if (!ip10.success) return { ok: false, which: 'ip10m' };
  if (!ipDay.success) return { ok: false, which: 'ipday' };
  if (!emailRes.success) return { ok: false, which: 'email' };
  if (!sessionRes.success) return { ok: false, which: 'session' };
  if (ipCostCents >= 150) return { ok: false, which: 'ipcost' }; // D-D-05

  return { ok: true };
}
```

The contract we MUST preserve:
- Return shape unchanged (`{ ok: true }` or `{ ok: false; which: ... }`)
- Order-of-precedence on failure unchanged: ip10m → ipday → email → session → ipcost
- `email` argument still accepted (no signature change — keeps /api/chat call site byte-identical)
- Session limiter STILL fires for eval-cli (D-A-01 scope boundary)
- ipcost check STILL fires for eval-cli (SAFE-08 last-line backstop — D-A-03)

From src/app/api/chat/route.ts line 226 (call site we must NOT change):
```typescript
const rl = await checkRateLimits(ipKey, session.email, session_id);
```

From src/lib/eval/agent-client.ts (canonical source of the identity — drift target):
```typescript
// mintEvalSession() POSTs to /api/session with this exact email:
body: JSON.stringify({ email: 'eval-cli@joedollinger.dev' })
```

From tests/api/chat-six-gate-order.test.ts canonical order (line 194-203):
```typescript
expect(gateOrderRecorder).toEqual([
  'body_parse',
  'session_lookup',
  'turnRows_check',
  'over_cap_check',
  'rate_limit_check',  // ← gate 5 — MUST still fire 5th after this plan
  'classifier',
]);
```

This contract MUST continue to pass byte-identically. The ip-rate-limit short-
circuit lives INSIDE `checkRateLimits` (which the test mocks at the module
boundary), so gate 5's position is structurally unaffected. For the happy-path
test (non-allowlisted `r@x.com` email), `checkRateLimits` still pushes
`rate_limit_check` onto the recorder and returns `{ ok: true }`. No test
modification needed beyond the 1-line mock surface addition (the route does NOT
change in this plan, but tests that mock `@/lib/redis` need to export every name
redis.ts exports — same Rule 3 deviation precedent from ro4 chat-tools.test.ts).
</interfaces>

<security_constraints>
CONTEXT.md `<task_context>` mandates a STRIDE threat model. Six mitigations the implementation MUST preserve (full register in `<threat_model>` below):

1. **Per-IP cost cap (SAFE-08, 150¢/day per IP)** is the ONLY remaining cost backstop for eval-cli traffic after this lands. SAFE-08 operates on `ipKey`, not on `email` — allowlisting the email cannot affect this gate. Test 4 in chat-iprl-allowlist verifies this directly (mirrors T-ro4-07 assertion in chat-spendcap-allowlist Test 4).

2. **Session limiter (200/7d)** still throttles per-session volume. Generous enough to not bottleneck legitimate eval traffic (CI runs ~20 reqs each, against a fresh-minted session per run) but caps a sustained attack against one session. D-A-01 explicit scope boundary.

3. **Exact-match allowlist** — `EVAL_CLI_ALLOWLIST.has(email)` (a Set), NOT regex or .endsWith() or .toLowerCase(). Pattern-adjacent emails (`EVAL-CLI@`, `eval-cli-test@`, `eval-cli@joedollinger.dev.attacker.com`) MUST hit both ip10m AND ipday. Test 3 in chat-iprl-allowlist + the `it.each` test in tests/lib/redis.test.ts enforce this.

4. **Three-helper unified Set** — `isEmailRatelimitAllowlisted`, `isEmailSpendCapAllowlisted`, `isEmailIpRatelimitAllowlisted` all consult the SAME `EVAL_CLI_ALLOWLIST` Set. Drift-detection test iterates the Set and asserts all three helpers return identical results for every member AND identical false-results for every pattern-adjacent email — future executor cannot diverge any one helper to a suffix/regex/case-insensitive check without that test failing.

5. **Six-gate order preserved** — `chat-six-gate-order.test.ts` continues to pass; gate 5 fires 5th in the canonical sequence. The internal short-circuit lives inside `checkRateLimits` and the test mocks `checkRateLimits` at the module boundary, so gate ordering is structurally unaffected. The happy-path uses `r@x.com` (not allowlisted), and the test's mocked checkRateLimits records `rate_limit_check` unconditionally.

6. **Route.ts byte-identical** — no code change in `src/app/api/chat/route.ts`. All logic lives inside `checkRateLimits` in `src/lib/redis.ts`, preserving the Phase 2 D-G-01..05 byte-identical-route guarantees. Mirrors the r4s approach exactly.
</security_constraints>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add isEmailIpRatelimitAllowlisted helper + checkRateLimits ip10m/ipday skip in src/lib/redis.ts; extend tests/lib/redis.test.ts with unit + drift-detection coverage</name>
  <files>src/lib/redis.ts, tests/lib/redis.test.ts</files>
  <behavior>
    Tests to ADD to tests/lib/redis.test.ts (the existing file already has 19+ tests across two SEED-001 halves; extend it):

    Test L — `isEmailIpRatelimitAllowlisted` direct unit (6 cases, exact mirror of isEmailRatelimitAllowlisted and isEmailSpendCapAllowlisted suites):
      - isEmailIpRatelimitAllowlisted('eval-cli@joedollinger.dev') → true
      - isEmailIpRatelimitAllowlisted('eval-cli-test@joedollinger.dev') → false
      - isEmailIpRatelimitAllowlisted('') → false
      - isEmailIpRatelimitAllowlisted('recruiter@google.com') → false
      - isEmailIpRatelimitAllowlisted('EVAL-CLI@joedollinger.dev') → false (case-sensitive)
      - isEmailIpRatelimitAllowlisted('eval-cli@joedollinger.dev.attacker.com') → false (subdomain trick)

    Test M — extend the existing drift-detection describe block (currently at tests/lib/redis.test.ts lines 220-241 covering 2 helpers) to cover THREE helpers:
      - For every email IN `EVAL_CLI_ALLOWLIST` (iterate via `for (const e of EVAL_CLI_ALLOWLIST)`):
        - Assert isEmailRatelimitAllowlisted(e) === true
        - Assert isEmailSpendCapAllowlisted(e) === true
        - Assert isEmailIpRatelimitAllowlisted(e) === true
      - For pattern-adjacent emails (`eval-cli-test@joedollinger.dev`, `eval-cli2@joedollinger.dev`, `EVAL-CLI@joedollinger.dev`, `eval-cli@joedollinger.dev.attacker.com`, `recruiter@google.com`, `''`):
        - Assert isEmailRatelimitAllowlisted(e) === false
        - Assert isEmailSpendCapAllowlisted(e) === false
        - Assert isEmailIpRatelimitAllowlisted(e) === false
      - This test now catches drift if ANY of the three helpers diverges to a different membership policy.

    Test N — `checkRateLimits` SKIPS ip10m + ipday for allowlisted email (D-A-01 ip-half full bypass):
      - Reset all four limiter spies (ipLimiter10m, ipLimiterDay, emailLimiterDay, sessionLimiter) via `.mockClear()` in beforeEach.
      - Call: `checkRateLimits('1.2.3.4', 'eval-cli@joedollinger.dev', 'sess-iprl')`
      - Assert: `ipLimiter10m.limit` spy was called 0 times
      - Assert: `ipLimiterDay.limit` spy was called 0 times
      - Assert: `emailLimiterDay.limit` spy was called 0 times (already-shipped r4s exemption preserved — allowlisted email also bypasses email window)
      - Assert: `sessionLimiter.limit` spy WAS called 1 time with `'sess-iprl'` (D-A-01 scope boundary: session limiter STILL fires)
      - Assert: return value === `{ ok: true }`

    Test O — `checkRateLimits` DOES call ip10m + ipday for a real recruiter email (back-compat):
      - Reset spies.
      - Call: `checkRateLimits('1.2.3.4', 'recruiter@google.com', 'sess-r')`
      - Assert: `ipLimiter10m.limit` spy was called 1 time with `'1.2.3.4'`
      - Assert: `ipLimiterDay.limit` spy was called 1 time with `'1.2.3.4'`
      - Assert: `emailLimiterDay.limit` spy was called 1 time with `'recruiter@google.com'`
      - Assert: `sessionLimiter.limit` spy was called 1 time with `'sess-r'`
      - Assert: return value === `{ ok: true }`

    Test P — pattern-adjacent emails DO hit ip10m + ipday (exact-match contract, `it.each` style):
      - For each of: `'eval-cli-test@joedollinger.dev'`, `'eval-cli2@joedollinger.dev'`, `'eval-cli@joedollinger.dev.attacker.com'`, `'EVAL-CLI@joedollinger.dev'`:
        - Reset spies.
        - Call: `checkRateLimits('1.2.3.4', evilEmail, 'sess-evil')`
        - Assert: `ipLimiter10m.limit` spy was called 1 time with `'1.2.3.4'`
        - Assert: `ipLimiterDay.limit` spy was called 1 time with `'1.2.3.4'`
      - This is the security-critical exact-match guard for the IP layer (mirrors Test C from r4s and Test G from ro4).

    Test Q — `checkRateLimits` returns `{ ok: false, which: 'ipcost' }` for allowlisted email when getIpCostToday >= 150 (T-sne-04 SAFE-08 last-line backstop at the unit layer):
      - This is the critical regression-trap. Future executor reading "we bypass ip10m + ipday for eval-cli — why not also bypass ipcost?" must hit this test failing.
      - Setup: pre-populate the FakeRedis store directly so getIpCostToday returns 150 for the test ipKey. Use the same pattern from the existing `per-IP cost` describe block (line 97-106). Specifically:
        - Compute the ipcost key with the same shape redis.ts uses: `resume-agent:ipcost:<YYYY-MM-DD>:<ipKey>`. The test can `await incrementIpCost('safe-08-ip', 150)` to populate it without hardcoding the date.
      - Call: `checkRateLimits('safe-08-ip', 'eval-cli@joedollinger.dev', 'sess-safe-08')`
      - Assert: return value === `{ ok: false, which: 'ipcost' }`
      - Assert: `ipLimiter10m.limit` spy was called 0 times (still allowlist-exempt at the IP rate-limit layer)
      - Assert: `ipLimiterDay.limit` spy was called 0 times
      - This asserts SAFE-08 is INTENTIONALLY NOT gated by email — the load-bearing last-line cost backstop is preserved at the unit layer.

    Existing tests that MUST stay green (no behavior change):
      - All 19+ existing SEED-001 tests in tests/lib/redis.test.ts (constant shape, helper-direct, allowlisted-bypass, real-email-doesn't-bypass, it.each pattern-adjacency, spend-cap unit, incrementSpend skip, drift-detection 2-helper). The drift-detection block updates from 2-helper to 3-helper assertion-by-assertion; no test deletions.
      - The existing `checkRateLimits happy path` test (line 108-115). The default ipKey 'fresh-ip-key' is unique per test instance (FakeRedis Map persists across describe blocks since module is singleton) — verify no collision with Test Q's `'safe-08-ip'`. Plan recommendation: use distinct ipKeys to avoid cross-test contamination.

    Update to the import block (lines 67-82): add `isEmailIpRatelimitAllowlisted` to the destructured import from `@/lib/redis`.
  </behavior>
  <action>
    Two coordinated edits. Both in one task because the new helper and its tests must land together — splitting would leave the import block referencing a not-yet-exported name.

    **Edit 1 — src/lib/redis.ts:**

    1. Update the header comment block at lines 47-72 — extend the SECURITY section to mention ip10m/ipday alongside the existing rate-limit + spend-cap mentions. Specifically rewrite the comment block to:

    ```typescript
    // --- Eval-cli allowlist (SEED-001 unified, D-A-02) ----------------------
    //
    // Exact-match Set of emails that BYPASS three gates:
    //   - the per-email 150/day rate limiter (consumed by isEmailRatelimitAllowlisted)
    //   - the SAFE-04 300¢/24h global spend cap (consumed by isEmailSpendCapAllowlisted)
    //   - the per-IP rate limiters: ip10m=20/10min + ipday=60/day (consumed by
    //     isEmailIpRatelimitAllowlisted; ADDED in quick task 260512-sne)
    //
    // Designed to unblock the eval CLI from CI without creating a blanket bypass.
    //
    // SECURITY (SEED-001 threat-model — STRIDE registers in
    // .planning/quick/260512-r4s-.../260512-r4s-PLAN.md (rate-limit half),
    // .planning/quick/260512-ro4-.../260512-ro4-PLAN.md (spend-cap half),
    // .planning/quick/260512-sne-.../260512-sne-PLAN.md (ip-rate-limit half)):
    //   - Exact match only. NOT suffix, NOT regex, NOT case-insensitive.
    //     `eval-cli-test@joedollinger.dev` does NOT bypass.
    //     `EVAL-CLI@joedollinger.dev` does NOT bypass.
    //   - Per-IP cost cap (SAFE-08, 150¢/day per IP at `resume-agent:ipcost:
    //     YYYY-MM-DD:<ipKey>`) STILL applies — this is the ONLY remaining
    //     cost-based last-line backstop for eval-cli traffic after sne lands.
    //   - Session limiter (sessionLimiter, 200 msg/7d) STILL applies (D-A-01
    //     explicit scope boundary; safety net preserved).
    //   - The canonical eval-cli email literal is duplicated in
    //     src/lib/eval/agent-client.ts mintEvalSession(); drift between the
    //     two is caught by tests/lib/redis.test.ts (3-helper drift-detection).
    //
    // To extend: prefer adding a new exact email here. If a use case ever
    // needs env-var-driven flexibility, add a second Set built from
    // `process.env.EVAL_CLI_ALLOWLIST_EXTRA` (comma-separated) and union them
    // — but DO NOT replace the hardcoded baseline (the drift detection test
    // would no longer catch updates to the eval CLI literal).
    ```

    2. Add the third sibling helper directly below `isEmailSpendCapAllowlisted` (after line 96, before the `RateLimitCheck` type on line 98):

    ```typescript
    /**
     * Returns true if the given email is exempt from the per-IP rate limiters
     * `ipLimiter10m` (20/10min per IP) and `ipLimiterDay` (60/day per IP).
     *
     * Session limiter (`sessionLimiter`, 200/7d) and per-IP cost cap
     * (SAFE-08, 150¢/day per IP) are NOT affected — those are the last-line
     * backstops for eval-cli traffic after all three SEED-001 halves land.
     * SAFE-08 in particular is INTENTIONALLY NOT gated by email and is the
     * regression-trap target for tests/lib/redis.test.ts Test Q.
     */
    export function isEmailIpRatelimitAllowlisted(email: string): boolean {
      return EVAL_CLI_ALLOWLIST.has(email);
    }
    ```

    3. Modify `checkRateLimits` (lines 102-129) to skip ip10m + ipday when allowlisted. The diff is surgical — add a const above the Promise.all, replace the two ip limiter calls with conditional expressions matching the existing email-exempt pattern. Preserve Promise.all shape, preserve precedence ordering, preserve return shape:

    ```typescript
    export async function checkRateLimits(
      ipKey: string,
      email: string,
      sessionId: string,
    ): Promise<RateLimitCheck> {
      const emailExempt = isEmailRatelimitAllowlisted(email);
      // SEED-001 / D-A-01 / quick task 260512-sne: allowlisted emails skip the
      // per-IP rate limiters (ip10m + ipday) entirely. Session limiter still
      // fires (D-A-01 scope boundary) and per-IP cost cap (SAFE-08, 150¢/day
      // per IP) still applies via `getIpCostToday` below — that's the last-
      // line cost backstop for eval-cli traffic and is INTENTIONALLY NOT
      // gated by email. Future executor noticing the asymmetry "we bypass
      // ip10m + ipday but not ipcost" — read the SECURITY comment above.
      const ipRlExempt = isEmailIpRatelimitAllowlisted(email);

      const [ip10, ipDay, emailRes, sessionRes, ipCostCents] = await Promise.all([
        ipRlExempt
          ? Promise.resolve({ success: true } as const)
          : ipLimiter10m.limit(ipKey),
        ipRlExempt
          ? Promise.resolve({ success: true } as const)
          : ipLimiterDay.limit(ipKey),
        emailExempt
          ? Promise.resolve({ success: true } as const)
          : emailLimiterDay.limit(email),
        sessionLimiter.limit(sessionId),
        getIpCostToday(ipKey),
      ]);

      if (!ip10.success) return { ok: false, which: 'ip10m' };
      if (!ipDay.success) return { ok: false, which: 'ipday' };
      if (!emailRes.success) return { ok: false, which: 'email' };
      if (!sessionRes.success) return { ok: false, which: 'session' };
      if (ipCostCents >= 150) return { ok: false, which: 'ipcost' }; // D-D-05

      return { ok: true };
    }
    ```

    DO NOT change:
    - `RateLimitCheck` type
    - `checkRateLimits` signature
    - `isOverCap`, `incrementSpend`, `incrementIpCost`, `getIpCostToday`, `getSpendToday` — none touched
    - `isEmailRatelimitAllowlisted`, `isEmailSpendCapAllowlisted`, `EVAL_CLI_ALLOWLIST` — already-shipped surfaces, no edits beyond the comment-block rewrite above
    - The ordering of failure checks below the Promise.all — ip10m → ipday → email → session → ipcost is the canonical precedence and the six-gate-order test depends on the route's gate 5 producing `which='ip10m'` first when both ip10m and ipday would have failed for non-allowlisted traffic

    DO NOT use `email.endsWith('@joedollinger.dev')`, regex, `.toLowerCase()`, or any policy other than exact-match Set membership.

    DO NOT gate `getIpCostToday` or the `ipCostCents >= 150` check by email — SAFE-08 is the last-line cost backstop per D-A-03 and Test Q is the regression-trap.

    **Edit 2 — tests/lib/redis.test.ts:**

    1. Update the import block (lines 67-82) to add `isEmailIpRatelimitAllowlisted`:

    ```typescript
    import {
      incrementSpend,
      getSpendToday,
      isOverCap,
      incrementIpCost,
      getIpCostToday,
      checkRateLimits,
      ipLimiter10m,
      ipLimiterDay,
      emailLimiterDay,
      sessionLimiter,
      EVAL_CLI_ALLOWLIST,
      isEmailRatelimitAllowlisted,
      isEmailSpendCapAllowlisted,
      isEmailIpRatelimitAllowlisted,  // ← NEW (quick task 260512-sne)
      redis,
    } from '@/lib/redis';
    ```

    2. APPEND a new describe block at the end of the file (after line 279) for the ip-rate-limit half. Title and structure mirror the existing two halves:

    ```typescript
    // --- SEED-001 ip-rate-limit half (quick task 260512-sne, D-A-01 + D-A-02) -
    // Mirrors the rate-limit half and spend-cap half above. Both prior halves
    // share the same unified EVAL_CLI_ALLOWLIST Set — this half adds the third
    // sibling helper isEmailIpRatelimitAllowlisted and the ip10m/ipday skip in
    // checkRateLimits. Per-IP cost cap (SAFE-08) is INTENTIONALLY NOT gated by
    // email and serves as the last-line cost backstop (Test Q regression-trap).

    describe('SEED-001 isEmailIpRatelimitAllowlisted', () => {
      it('returns true for the canonical eval-cli email', () => {
        expect(isEmailIpRatelimitAllowlisted('eval-cli@joedollinger.dev')).toBe(true);
      });
      it('returns false for pattern-adjacent eval-cli-test email', () => {
        expect(isEmailIpRatelimitAllowlisted('eval-cli-test@joedollinger.dev')).toBe(false);
      });
      it('returns false for empty string', () => {
        expect(isEmailIpRatelimitAllowlisted('')).toBe(false);
      });
      it('returns false for an unrelated recruiter email', () => {
        expect(isEmailIpRatelimitAllowlisted('recruiter@google.com')).toBe(false);
      });
      it('returns false for case-variant (case-sensitive contract)', () => {
        expect(isEmailIpRatelimitAllowlisted('EVAL-CLI@joedollinger.dev')).toBe(false);
      });
      it('returns false for subdomain-trick email', () => {
        expect(isEmailIpRatelimitAllowlisted('eval-cli@joedollinger.dev.attacker.com')).toBe(false);
      });
    });

    describe('SEED-001 checkRateLimits — allowlisted email (ip-rate-limit half)', () => {
      beforeEach(() => {
        (ipLimiter10m.limit as ReturnType<typeof vi.fn>).mockClear();
        (ipLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
        (emailLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
        (sessionLimiter.limit as ReturnType<typeof vi.fn>).mockClear();
      });

      it('SKIPS ipLimiter10m.limit() AND ipLimiterDay.limit() for canonical eval-cli email (D-A-01 ip-half bypass; session limiter STILL fires)', async () => {
        const res = await checkRateLimits('1.2.3.4', 'eval-cli@joedollinger.dev', 'sess-iprl');
        expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
        expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
        // Email window also exempt (already-shipped r4s) — confirms unified policy:
        expect((emailLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
        // Session limiter STILL fires (D-A-01 scope boundary):
        expect((sessionLimiter.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
        expect((sessionLimiter.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('sess-iprl');
        expect(res).toEqual({ ok: true });
      });

      it('DOES call ipLimiter10m + ipLimiterDay for a real recruiter email (back-compat)', async () => {
        const res = await checkRateLimits('1.2.3.4', 'recruiter@google.com', 'sess-r');
        expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
        expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
        expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
        expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
        expect(res).toEqual({ ok: true });
      });

      it.each([
        'eval-cli-test@joedollinger.dev',
        'eval-cli2@joedollinger.dev',
        'eval-cli@joedollinger.dev.attacker.com',
        'EVAL-CLI@joedollinger.dev',
      ])('pattern-adjacent email %s DOES hit ip10m + ipday (exact-match contract)', async (evilEmail) => {
        (ipLimiter10m.limit as ReturnType<typeof vi.fn>).mockClear();
        (ipLimiterDay.limit as ReturnType<typeof vi.fn>).mockClear();
        await checkRateLimits('1.2.3.4', evilEmail, 'sess-evil');
        expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
        expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
        expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
        expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('1.2.3.4');
      });

      it('SAFE-08 last-line backstop STILL trips for allowlisted email when ipcost >= 150¢ (T-sne-04 regression-trap)', async () => {
        // Pre-populate the FakeRedis store with 150¢ for a distinct ipKey so
        // getIpCostToday returns 150 inside checkRateLimits. The existing
        // per-IP cost test (line 97-106) demonstrates the pattern.
        await incrementIpCost('safe-08-ip', 150);
        const res = await checkRateLimits('safe-08-ip', 'eval-cli@joedollinger.dev', 'sess-safe-08');
        expect(res).toEqual({ ok: false, which: 'ipcost' });
        // ip10m + ipday were STILL bypassed for the allowlisted email — the
        // backstop firing is purely the SAFE-08 ipcost check, not a per-IP
        // rate-limit failure leaking through.
        expect((ipLimiter10m.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
        expect((ipLimiterDay.limit as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
      });
    });
    ```

    3. EXTEND the existing drift-detection describe block (currently at lines 220-241, currently asserting two helpers) to cover ALL THREE helpers. Edit in-place:

    ```typescript
    describe('SEED-001 unified EVAL_CLI_ALLOWLIST drift detection (D-A-02)', () => {
      it('all three helpers consult the same Set for allowlisted emails', () => {
        for (const e of EVAL_CLI_ALLOWLIST) {
          expect(isEmailRatelimitAllowlisted(e)).toBe(true);
          expect(isEmailSpendCapAllowlisted(e)).toBe(true);
          expect(isEmailIpRatelimitAllowlisted(e)).toBe(true);
        }
      });
      it('all three helpers reject pattern-adjacent emails identically', () => {
        const adjacents = [
          'eval-cli-test@joedollinger.dev',
          'eval-cli2@joedollinger.dev',
          'EVAL-CLI@joedollinger.dev',
          'eval-cli@joedollinger.dev.attacker.com',
          'recruiter@google.com',
          '',
        ];
        for (const e of adjacents) {
          expect(isEmailRatelimitAllowlisted(e)).toBe(false);
          expect(isEmailSpendCapAllowlisted(e)).toBe(false);
          expect(isEmailIpRatelimitAllowlisted(e)).toBe(false);
        }
      });
    });
    ```

    DO NOT delete or modify any other existing test. The two SEED-001 halves above (r4s + ro4) must remain green; their assertions are not affected by this plan's changes.

    DO NOT introduce new test files — extend the existing tests/lib/redis.test.ts. The new `chat-iprl-allowlist.test.ts` file is for integration-layer assertions and lives in Task 2.

    Verification of Task 1: `npm test -- tests/lib/redis.test.ts` runs all existing 27+ tests plus the 13 added in this task (6 direct-unit + 4 checkRateLimits + extended drift), all green.
  </action>
  <verify>
    <automated>npm test -- tests/lib/redis.test.ts</automated>
  </verify>
  <done>
    - `tests/lib/redis.test.ts` has 13+ new tests covering L-Q above; all pass
    - Extended drift-detection block iterates all three helpers; passes
    - `src/lib/redis.ts` exports `isEmailIpRatelimitAllowlisted` (new function); other exports unchanged
    - `checkRateLimits` signature unchanged; internal Promise.all shape preserved; precedence ordering preserved
    - `npx tsc --noEmit` exits 0
    - All existing SEED-001 r4s + ro4 tests still pass (no regression)
    - `npm run build` exits 0 (catches strict tsc-only issues vitest misses — Plan 05-10 lesson)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add tests/api/chat-iprl-allowlist.test.ts integration tests; add 1-line mock additions to 4 existing /api/chat test files</name>
  <files>tests/api/chat-iprl-allowlist.test.ts, tests/api/chat-email-allowlist.test.ts, tests/api/chat-spendcap-allowlist.test.ts, tests/api/chat-six-gate-order.test.ts, tests/api/chat-tools.test.ts</files>
  <behavior>
    Create a new test file `tests/api/chat-iprl-allowlist.test.ts` that exercises the /api/chat route end-to-end with the ip-rate-limit allowlist in play. Mirror the env stub + mock structure from `tests/api/chat-spendcap-allowlist.test.ts` (the closest existing reference — same six-gate route, same mock surface, same parameterized-session-email pattern).

    Five tests:

    Test 1 — allowlisted eval-cli email bypasses ip10m (cap synthetic at 20, eval-cli reaches classifier on req 21):
      - Mock session with `email: 'eval-cli@joedollinger.dev'`.
      - The route handler calls `checkRateLimits(ipKey, session.email, session_id)` at line 226. The mock for `checkRateLimits` is shared across all integration tests; it returns `{ ok: true }` by default. For this test, the assertion is structural — proves the route did not deflect at the rate-limit gate.
      - More precisely: assert that `checkRateLimits` was called with the eval-cli email, and the route reached `classifyUserMessage` (the next gate). Use the `chat-spendcap-allowlist.test.ts` Test 1 pattern.
      - POST a valid body. Assert: `classifyUserMessage` was called 1 time, `persistDeflectionTurn` was NOT called with `reason: 'ratelimit'`, response status 200.

    Test 2 — allowlisted eval-cli email bypasses ipday (separate test for behavioral coverage of both gates):
      - Same setup as Test 1 — both gates use the same allowlist guard inside `checkRateLimits`, so the integration assertion at this layer is identical to Test 1. We split into two tests for documentation clarity: Test 1 names ip10m in its title, Test 2 names ipday. Both pass by virtue of the unit-layer assertions in Task 1 Test N.
      - Alternatively (planner's discretion at implementation time): consolidate into one test if the executor judges the structural duplication is wasteful. Recommendation: keep both for traceability against SEED-001 Acceptance Criteria.

    Test 3 — pattern-adjacent email DOES hit ip10m and DOES deflect with reason=ratelimit (exact-match contract, security-critical):
      - Mock session with `email: 'eval-cli-test@joedollinger.dev'`.
      - Stub `checkRateLimits` to return `{ ok: false, which: 'ip10m' as const }` (simulating the pattern-adjacent email tripping ip10m because it was NOT allowlisted).
      - POST a valid body.
      - Assert: `persistDeflectionTurn` was called with `reason: 'ratelimit'`.
      - Assert: `classifyUserMessage` was NOT called.
      - This is the SECURITY-CRITICAL pattern-adjacency test at the integration layer. The unit-layer assertion lives in Task 1 Test P.

    Test 4 — allowlisted eval-cli email STILL deflects when SAFE-08 per-IP cost cap trips (T-sne-04 last-line backstop, mirrors chat-spendcap-allowlist Test 3):
      - Mock session with `email: 'eval-cli@joedollinger.dev'`.
      - Stub `checkRateLimits` to return `{ ok: false, which: 'ipcost' as const }` (simulating SAFE-08 firing for the allowlisted email).
      - POST a valid body.
      - Assert: route maps `which: 'ipcost'` → `reason: 'ratelimit'` per route.ts line 248 — `persistDeflectionTurn` called with `reason: 'ratelimit'`.
      - Assert: `classifyUserMessage` was NOT called.
      - This is the load-bearing assertion that SAFE-08 is the last-line cost backstop and is preserved after sne. Mirror the comment from chat-spendcap-allowlist Test 3 (line 261-279) verbatim with `T-sne-04` in place of `T-ro4-04`.

    Test 5 — session limiter STILL applies to allowlisted eval-cli email (D-A-01 scope boundary):
      - Mock session with `email: 'eval-cli@joedollinger.dev'`.
      - Stub `checkRateLimits` to return `{ ok: false, which: 'session' as const }` (simulating sessionLimiter firing for the allowlisted email — possible if a single session somehow accumulates >200 turns in 7d).
      - POST a valid body.
      - Assert: `persistDeflectionTurn` was called with `reason: 'ratelimit'` (session failure maps to ratelimit deflection in route.ts).
      - Assert: `classifyUserMessage` was NOT called.
      - This documents that the session limiter is intentionally NOT in the allowlist (D-A-01 scope boundary).

    1-line mock additions to 4 existing test files. Each file mocks `@/lib/redis` and currently does not export `isEmailIpRatelimitAllowlisted`. After Task 1 adds the import surface to `src/lib/redis.ts`, any test that mocks `@/lib/redis` must declare every name the module exports OR vitest will fail at module load with `[vitest] No "isEmailIpRatelimitAllowlisted" export is defined on the "@/lib/redis" mock` for any test that imports anything via /api/chat (since redis.ts is now in the route's import surface — wait, actually the route does NOT import this helper, only the redis.ts internal callsite does. But the tests directly destructure-import from @/lib/redis OR rely on the mock factory exhaustively listing exports. The ro4 precedent shows tests fail anyway. Track the same Rule 3 deviation pattern.)

    SPECIFICALLY: the route.ts does NOT import `isEmailIpRatelimitAllowlisted` (only redis.ts's internal `checkRateLimits` calls it). However, several test files use a `vi.mock('@/lib/redis', () => ({ ... }))` mock that exhaustively lists exports the route uses. If those mock factories don't include `isEmailIpRatelimitAllowlisted`, vitest may not necessarily fail (mocks only need to satisfy what code-under-test imports). The ro4 SUMMARY shows chat-tools.test.ts DID fail this way despite route.ts not having directly imported `isEmailSpendCapAllowlisted` at that moment in the dev cycle — the failure mode is module-resolution at test file load. To be safe + consistent with the ro4 precedent: add the 1-line mock entry to all four files defensively. Cost is 1 line each; benefit is no Rule 3 deviation at execution time.

    The four files and the exact 1-line addition each gets:

    1. `tests/api/chat-email-allowlist.test.ts` — inside the `vi.mock('@/lib/redis', () => ({` block (around line 76-88 in current file): add `isEmailIpRatelimitAllowlisted: () => false,` alongside the existing `isEmailSpendCapAllowlisted: () => false,`.

    2. `tests/api/chat-spendcap-allowlist.test.ts` — inside the `vi.mock('@/lib/redis', () => ({` block (around line 59-66 in current file): add `isEmailIpRatelimitAllowlisted: () => false,` alongside the existing entries.

    3. `tests/api/chat-six-gate-order.test.ts` — inside the `vi.mock('@/lib/redis', () => ({` block (around line 80-91 in current file): add `isEmailIpRatelimitAllowlisted: () => false,` alongside the existing `isEmailSpendCapAllowlisted: () => false,`. Happy-path uses `r@x.com` (not allowlisted), so the canonical 6-gate recorder sequence is preserved.

    4. `tests/api/chat-tools.test.ts` — inside the `vi.mock('@/lib/redis', () => ({` block (around line 56-68 in current file): add `isEmailIpRatelimitAllowlisted: () => false,`. Happy-path uses `r@x.com` (not allowlisted), so the existing 5 W4 heartbeat-before-persistence + tool-wiring tests remain semantically-identical.

    Verification of Task 2 end-state:
      - `npm test -- tests/api/chat-iprl-allowlist.test.ts` runs the 5 new integration tests, all green
      - `npm test` full suite passes (no regression in existing ~645 tests; net +5 new integration tests)
      - The pre-existing test files' tests run byte-identically — only the mock surface grew, no behavior change
  </behavior>
  <action>
    **Edit 1 — create tests/api/chat-iprl-allowlist.test.ts:**

    Use `tests/api/chat-spendcap-allowlist.test.ts` as the structural template. Specifically reuse:
      - The env stub block (lines 25-36)
      - The supabaseAdmin mock chain pattern (lines 68-91)
      - The streamText / @anthropic-ai/sdk mocks structure (lines 97-123)
      - The persistDeflectionTurn spy + tests structure (lines 125-178)
      - The makeRequest helper + HAPPY_BODY constant (lines 180-196)
      - The beforeEach/afterEach lifecycle (lines 198-222)

    Differences from chat-spendcap-allowlist.test.ts:
      - File header comment block should reference SEED-001 quick task 260512-sne (NOT 260512-ro4) and call out the ip-rate-limit half + T-sne-04 (NOT T-ro4-04) for the SAFE-08 backstop assertion.
      - The @/lib/redis mock includes `isEmailIpRatelimitAllowlisted: (email: string) => email === 'eval-cli@joedollinger.dev'` (real-shape, returns true only for canonical eval-cli — mirrors the spend-cap file's `isEmailSpendCapAllowlisted` mock at line 48-50).
      - Test bodies: 5 tests as enumerated in the `<behavior>` section above.
      - Test naming: SEED-001-prefixed (e.g. `'SEED-001 ip-rl AC: exact-match — eval-cli@joedollinger.dev bypasses ip10m and reaches classifier'`, `'SEED-001 ip-rl AC: per-IP cost cap (SAFE-08) STILL trips for eval-cli email — T-sne-04 last-line backstop'`, `'SEED-001 ip-rl AC: session limiter STILL applies to eval-cli email (D-A-01 scope boundary)'`).
      - SECURITY-CRITICAL comment at Test 4 mirrors chat-spendcap-allowlist Test 3's comment block (line 261-279) with T-sne-04 substituted for T-ro4-04.

    DO NOT: spin up a real Next.js server or hit Upstash live. Pure vitest with mocked Supabase + Redis + Anthropic + persistence, same isolation level as chat-spendcap-allowlist.test.ts.

    DO NOT: duplicate the unit-level allowlist assertions from Task 1 — this test file is for the END-TO-END contract through the route. Unit-level tests live in `tests/lib/redis.test.ts`.

    **Edit 2 — 1-line mock additions to 4 existing test files:**

    For each of these four files, locate the `vi.mock('@/lib/redis', () => ({` block (each currently has `isEmailSpendCapAllowlisted: () => false,` from ro4) and add `isEmailIpRatelimitAllowlisted: () => false,` on the next line. Single-line edit per file:

    1. `tests/api/chat-email-allowlist.test.ts`:
       ```typescript
       // ... existing entries ...
       isEmailSpendCapAllowlisted: () => false,
       isEmailIpRatelimitAllowlisted: () => false,  // SEED-001 ip-rl half (quick task 260512-sne): route module load resolves
       }));
       ```

    2. `tests/api/chat-spendcap-allowlist.test.ts`:
       ```typescript
       // ... existing entries (including isEmailSpendCapAllowlisted: <real-shape spy>) ...
       isEmailIpRatelimitAllowlisted: () => false,  // SEED-001 ip-rl half (quick task 260512-sne): route module load resolves
       }));
       ```

    3. `tests/api/chat-six-gate-order.test.ts`:
       ```typescript
       // ... existing entries ...
       isEmailSpendCapAllowlisted: () => false,
       isEmailIpRatelimitAllowlisted: () => false,  // SEED-001 ip-rl half (quick task 260512-sne): route module load resolves
       }));
       ```

    4. `tests/api/chat-tools.test.ts`:
       ```typescript
       // ... existing entries ...
       isEmailSpendCapAllowlisted: () => false,
       isEmailIpRatelimitAllowlisted: () => false,  // SEED-001 ip-rl half (quick task 260512-sne): route module load resolves
       }));
       ```

    The mock addition is defensive (route.ts does not directly import the new helper, but consistency with ro4's precedent + safety against future executor moves the import to the route — single-line cost). Each file's existing tests remain semantics-identical because:
      - chat-email-allowlist.test.ts: happy-path session.email is parameterized; none of the 3 surviving tests exercise the ip-rl path
      - chat-spendcap-allowlist.test.ts: 4 tests focus on spend-cap gate 4 + onFinish; ip-rl never trips
      - chat-six-gate-order.test.ts: happy-path uses r@x.com; gate 5 (rate_limit_check) still records via the mocked checkRateLimits
      - chat-tools.test.ts: happy-path uses r@x.com; checkRateLimits returns { ok: true } default

    Verification: `npm test` full suite, then `npx tsc --noEmit`, then `npm run build`. All three must exit 0.
  </action>
  <verify>
    <automated>npm test -- tests/api/chat-iprl-allowlist.test.ts</automated>
  </verify>
  <done>
    - `tests/api/chat-iprl-allowlist.test.ts` exists with 5+ tests covering the ip-rl contract end-to-end
    - All 5 new tests pass
    - 1-line mock additions present in all 4 sibling test files
    - All pre-existing tests still pass (no regression in existing ~645 tests; net +5 new tests in chat-iprl-allowlist + 0 net change in the 4 sibling files)
    - `npx tsc --noEmit` exits 0
    - `npm run build` exits 0
    - `npm test` full suite green
    - `src/app/api/chat/route.ts` BYTE-IDENTICAL diff (verify via `git diff src/app/api/chat/route.ts` returning empty)
  </done>
</task>

<task type="auto">
  <name>Task 3: Update SEED-001 seed doc — extend resolved_by + Resolution Notes for the ip-rl third half</name>
  <files>.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md</files>
  <action>
    Docs-only edit. Two changes to `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md`:

    1. Frontmatter — extend the `resolved_by` list to include the third half. Currently:
    ```yaml
    resolved_by:
      - 260512-r4s  # rate-limit half ...
      - 260512-ro4  # spend-cap half ...
    ```
    Becomes:
    ```yaml
    resolved_by:
      - 260512-r4s  # rate-limit half (per-email 150/day window bypass)
      - 260512-ro4  # spend-cap half (SAFE-04 300¢/24h global counter bypass + invisible-to-counter via incrementSpend skip)
      - 260512-sne  # ip-rate-limit half (ip10m=20/10min + ipday=60/day per-IP rate limiter bypass; SAFE-08 per-IP cost cap is now the only cost-based last-line backstop)
    ```

    2. Resolution Notes section (currently lines 64-74) — append a THIRD paragraph after the existing two halves. The combined intro line "Both halves resolved on 2026-05-12 in two quick tasks:" updates to "All three halves resolved on 2026-05-12 in three quick tasks:". Verbatim text for the new paragraph:

    ```markdown
    3. **Ip-rate-limit half (`260512-sne`, commit `<will be filled in by close-out>`)** — PR #4 CI eval run (2026-05-13T00:29:20Z, runId `HYxSxtSM_8f782_NdJ7kr`) deflected cat1-fab-013/014/015 with `deflectionReason: "ratelimit"`. The eval CLI does ~20 requests (15 cat1 + 5 cat4-judge) from a single GH Actions runner IP in ~2 minutes; `ipLimiter10m` is 20 msg/10min so it trips at request 21. The rate-limit-half (`260512-r4s`) only exempted the per-email window, leaving per-IP limits intact by design ("Keep per-IP and spend-cap protection intact") — that design assumed multi-IP eval traffic and didn't anticipate single-IP CI bursts. Extended the unified allowlist to also bypass ip10m + ipday: added `isEmailIpRatelimitAllowlisted` helper (third sibling alongside `isEmailRatelimitAllowlisted` + `isEmailSpendCapAllowlisted`, all consulting the unified `EVAL_CLI_ALLOWLIST` Set); `checkRateLimits` short-circuits both ip10m and ipday with `Promise.resolve({ success: true } as const)` for allowlisted emails (D-A-01 ip-half bypass; mirrors the existing email-limiter exemption pattern). Session limiter (200 msg/7d) STILL fires for eval-cli traffic — D-A-01 explicit scope boundary; the safety net is preserved. STRIDE T-sne-01..07 mitigated; six-gate ORDER unchanged (gate 5 still fires 5th); src/app/api/chat/route.ts BYTE-IDENTICAL.
    ```

    3. Acceptance Criteria revision note (currently the final paragraph of Resolution Notes section, mentioning that the third bullet was SUPERSEDED). Extend it to also note the second bullet ("Per-IP rate limit still applies to the eval-cli email (IP-based protection preserved)") is now ALSO superseded by 260512-sne. Verbatim addition (append to the end of the existing "Acceptance Criteria revision (post-resolution)" paragraph):

    ```markdown

    Similarly, the SECOND bullet of the original Acceptance Criteria ("Per-IP rate limit still applies to the eval-cli email (IP-based protection preserved)") is HISTORICALLY ACCURATE for the r4s + ro4 landings but was SUPERSEDED on 2026-05-12 by the ip-rate-limit-half quick task `260512-sne`. Post-260512-sne the canonical statement is: per-IP cost cap (SAFE-08, 150¢/day per IP) and session limiter (200 msg/7d) are the remaining backstops for eval-cli traffic; ip10m + ipday no longer apply. Original bullet preserved for historical traceability. The driver for this revision was the 2026-05-13T00:29:20Z PR #4 CI failure where the original "keep per-IP intact" design (which assumed multi-IP eval traffic) tripped ip10m=20/10min from a single GH Actions runner IP.
    ```

    4. Combined-effect paragraph (currently in Resolution Notes, beginning "Combined effect:"). Extend it to reflect the ip-half landing. Verbatim replacement (rewrite the entire paragraph):

    ```markdown
    **Combined effect:** eval-cli traffic is fully invisible to the per-email window, the global spend cap, AND the per-IP rate limiters (ip10m + ipday). A recruiter spending the day chatting cannot be locked out by an eval verification spike on any of those layers. An attacker who learns the eval-cli email is still bounded by per-IP cost cap (SAFE-08, 150¢/day per IP) and session limiter (200 msg/7d) — a distributed-IP attack would need many IPs and burns 150¢ per IP independently. Ceiling per IP per day = $1.50 in Anthropic spend. Org-level Anthropic spend cap is $100/mo per project memory, so sustained attack against this project is bounded by org limits too. No new exposure surface beyond what was already accepted for the rate-limit-half + spend-cap-half threat models (decision documented in CONTEXT.md D-A-03).
    ```

    Use `<will be filled in by close-out>` as placeholder for the sne commit hash — replaced at SUMMARY time.

    DO NOT: edit any other section of the seed doc (don't touch "Why This Matters", "When to Surface", "Scope Estimate", "Acceptance Criteria", "Out of Scope", "Breadcrumbs", "Notes from Planting Session").

    DO NOT: change the frontmatter `status: resolved` (already set after ro4) or `resolved_on: 2026-05-12` (already set).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs');const a=fs.readFileSync('.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md','utf8');if(!a.includes('260512-sne'))process.exit(1);if(!a.includes('Ip-rate-limit half'))process.exit(2);if(!a.includes('isEmailIpRatelimitAllowlisted'))process.exit(3);if(!a.includes('T-sne'))process.exit(4);console.log('seed-doc ok');"</automated>
  </verify>
  <done>
    - `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` frontmatter `resolved_by` lists all three halves
    - Resolution Notes section has THREE paragraphs (one per half); third paragraph covers 260512-sne
    - Combined-effect paragraph updated to reflect all three halves
    - Acceptance Criteria revision paragraph extended to note bullet #2 (Per-IP rate limit) is now ALSO superseded
    - `seed-doc ok` from the node probe — all four substring checks pass
    - No regression: `npm test` still green, `npm run build` still exits 0 (doc-only change, but verify regardless per Plan 05-10 lesson)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| public internet → /api/chat | Any anonymous user can POST; six-gate prelude is the first line of defense |
| /api/chat route → src/lib/redis.ts checkRateLimits | Email argument originates from `session.email`, which originated from `/api/session`'s body — attacker-controlled at session-mint time |
| /api/session → Supabase sessions table | EmailGate UI POSTs the email plaintext; no domain verification |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sne-01 | Spoofing | `isEmailIpRatelimitAllowlisted` lookup in `checkRateLimits` (ip10m + ipday short-circuit) | mitigate | An attacker who learns `eval-cli@joedollinger.dev` could mint a session with that email and bypass the per-IP 10-minute (20/10min) and daily (60/day) rate limits. **Mitigation:** SAFE-08 per-IP cost cap (150¢/day per IP) STILL applies — verified by Task 1 Test Q (unit layer) AND Task 2 Test 4 (integration layer; mirrors chat-spendcap-allowlist Test 3 T-ro4-04 pattern). Session limiter (200/7d) STILL applies — verified by Task 1 Test N (asserts sessionLimiter.limit called for allowlisted email) and Task 2 Test 5 (integration assertion). Email value is low-entropy / public-by-discovery (it appears in commit history and prior plan docs once SEED-001 closes), so we treat it as compromised by default and rely on SAFE-08 + session limiter + organizational backstops. Per D-A-03: Joe explicitly accepted the residual risk — bounded at $1.50/day per source IP and gated by the $100/mo org cap. |
| T-sne-02 | Spoofing | Pattern-bypass via case-variant or subdomain trick at the ip-rate-limit layer | mitigate | Use `Set.has()` (case-sensitive, exact-string match). NOT `.endsWith()`, NOT regex, NOT `.toLowerCase()` normalization. Task 1 Test P covers `'EVAL-CLI@...'`, `'eval-cli-test@...'`, `'eval-cli@joedollinger.dev.attacker.com'`, `'eval-cli2@...'` — ALL must hit ip10m + ipday. Task 2 Test 3 enforces this at the integration layer (pattern-adjacent email STILL deflects with reason=ratelimit). |
| T-sne-03 | Tampering / Drift | Three-helper allowlist drift across `isEmailRatelimitAllowlisted` + `isEmailSpendCapAllowlisted` + `isEmailIpRatelimitAllowlisted` | mitigate | Extended drift-detection test in tests/lib/redis.test.ts iterates `EVAL_CLI_ALLOWLIST` and asserts ALL THREE helpers return identical results for every member AND for pattern-adjacent emails. Future executor cannot diverge any one helper (e.g. add `.toLowerCase()` to isEmailIpRatelimitAllowlisted but not the others) without that test failing noisily. Pattern carried from ro4 (which used 2-helper drift detection); this plan extends to 3 helpers. |
| T-sne-04 | Denial of Service | Per-IP cost cap (SAFE-08, 150¢/IP/day) bypass via allowlisted email | accept | Per-IP cost cap operates on `ipKey`, NOT on email. Allowlisting email cannot affect this gate. **Verified at two layers**: Task 1 Test Q (unit — pre-populates FakeRedis ipcost key to 150 and asserts checkRateLimits returns `{ ok: false, which: 'ipcost' }` for allowlisted email) AND Task 2 Test 4 (integration — checkRateLimits returns `{ ok: false, which: 'ipcost' }` and route maps to reason=ratelimit deflection). The SAFE-08 check is the load-bearing last-line cost backstop after sne; an attacker who spoofs the eval-cli email AND wants to burn cost is still capped at 150¢/day per source IP. Distributed attack would need many IPs. Per D-A-03: explicit accept disposition; alternatives (lower SAFE-08 to 50¢ for eval-cli, per-call max-cost ceiling, per-IP throttle on cost) rejected for marginal benefit at high complexity cost. |
| T-sne-05 | Denial of Service | Session limiter (200/7d) bypass | accept | Session limiter operates on `sessionId`, NOT on email. Allowlisting email cannot affect this gate. **Verified**: Task 1 Test N asserts `sessionLimiter.limit` IS called for allowlisted email (D-A-01 scope boundary; the session limiter must still fire). Task 2 Test 5 (integration) asserts an allowlisted email STILL deflects with reason=ratelimit when checkRateLimits returns `{ ok: false, which: 'session' }`. 200/7d is generous enough to not bottleneck legitimate CI eval traffic (each run mints a fresh session via `mintEvalSession`, so accumulation across runs against one session is impossible by design). Sustained attack against a single sessionId would trip at 200 turns/7d — a meaningful cap. |
| T-sne-06 | Information Disclosure | Logging the allowlisted email at WARN/ERROR or in deflection metadata | accept | No new log statements introduced by this change. Existing logs already log `session.email` and `email_domain` via Pino in route.ts onFinish + email.ts pre-check (per Phase 04 STATE.md notes). `eval-cli@joedollinger.dev` appearing in logs is operational metadata, not PII. Same disposition as T-r4s-05 (rate-limit half) and T-ro4-05 (spend-cap half). |
| T-sne-07 | Elevation of Privilege | Blanket bypass via overreach in implementation (e.g. someone adds env-var override or `.endsWith()` matcher) | mitigate | Allowlist Set contains exactly one element. `EVAL_CLI_ALLOWLIST.size === 1` is asserted by the existing constant-shape test in tests/lib/redis.test.ts (lines 121-126, unchanged by this plan). Three-helper drift-detection block iterates the Set and would fail loudly if anyone added an env-var override path. No env-var override path exists in v1 of this change. Any future expansion requires explicit Set member addition + test update — code review burden is intentional. |
| T-sne-08 | Tampering | Eval CLI literal drifting from `EVAL_CLI_ALLOWLIST` | mitigate | The existing constant-shape test in tests/lib/redis.test.ts (lines 121-126) imports `EVAL_CLI_ALLOWLIST` and asserts it contains exactly `'eval-cli@joedollinger.dev'`. The literal in `src/lib/eval/agent-client.ts` mintEvalSession is physically separated, but the test bridges them. If a future executor changes the eval CLI email (e.g. to `eval-runner@joedollinger.dev`) without updating the allowlist, the test fails noisily and CI blocks. This bridge was established by r4s and is now leveraged by all three halves. |
| T-sne-09 | Repudiation | Distinguishing real vs eval-CLI traffic in audit at the ip-rate-limit layer | mitigate | All eval traffic uses sessions with `email_domain='joedollinger.dev'` — already greppable in admin/sessions UI. SEED-001 doesn't change this signal. CR-02's `EVAL_SYNTHETIC_EMAIL_SUFFIX` skip in email.ts also still distinguishes eval sessions from recruiter sessions at the notification layer. The ip-rate-limit bypass adds no new ambiguity to audit logs — admin can still attribute every session row to its email domain. |
</threat_model>

<verification>
Run after all three tasks land:

```bash
# Unit + integration tests
npm test

# Strict TS (catches issues vitest doesn't)
npx tsc --noEmit

# Production build (catches issues vitest + tsc don't — Plan 05-10 lesson)
npm run build

# Spot-check the diff
git diff --stat src/lib/redis.ts tests/lib/redis.test.ts tests/api/chat-iprl-allowlist.test.ts tests/api/chat-email-allowlist.test.ts tests/api/chat-spendcap-allowlist.test.ts tests/api/chat-six-gate-order.test.ts tests/api/chat-tools.test.ts .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md

# Verify src/app/api/chat/route.ts is BYTE-IDENTICAL
git diff src/app/api/chat/route.ts
# Expected: zero output (no diff)

# Verify allowlist constant + 3 helpers all present
git grep -n 'isEmailIpRatelimitAllowlisted' src/lib/redis.ts
# Expected: 2 hits (declaration + body) plus 1 hit inside checkRateLimits (`const ipRlExempt = isEmailIpRatelimitAllowlisted(email)`)

git grep -c 'isEmailRatelimitAllowlisted\|isEmailSpendCapAllowlisted\|isEmailIpRatelimitAllowlisted' src/lib/redis.ts
# Expected: at least 6 hits (3 declarations + 3 body references inside checkRateLimits/Promise.all/etc.)

# Verify checkRateLimits Promise.all shape preserved
git grep -A 20 'export async function checkRateLimits' src/lib/redis.ts
# Expected: still has Promise.all over five expressions; precedence ordering ip10m → ipday → email → session → ipcost unchanged

# Verify SEED-001 doc updated
git grep -n '260512-sne' .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md
# Expected: ≥ 2 hits (frontmatter resolved_by + Resolution Notes paragraph)
```

Expected:
- All tests green (no regression in the existing ~645 tests; ~18 new tests: ~13 in redis.test.ts + 5 in chat-iprl-allowlist.test.ts)
- `tsc --noEmit` exits 0
- `npm run build` exits 0
- `src/app/api/chat/route.ts` shows ZERO diff (allowlist logic lives entirely in redis.ts — mirrors r4s pattern)
- `src/lib/redis.ts` shows ~25-35 lines added (third helper + checkRateLimits conditional + extended comment header)
- 4 sibling test files each show +1 line (the `isEmailIpRatelimitAllowlisted: () => false,` mock entry)
- `tests/lib/redis.test.ts` shows ~80-120 lines added (new describe block for ip-rl half + extended drift-detection)
- `tests/api/chat-iprl-allowlist.test.ts` shows ~280-330 lines added (new file)
- `.planning/seeds/SEED-001-...md` shows ~10-15 lines added (one new resolved_by entry + one new Resolution Notes paragraph + Combined Effect rewrite + Acceptance Criteria revision append)

Manual smoke verification (not blocking, post-merge):
- After this commit lands on `gsd/05-12-task-0-classifier-tune`, re-trigger PR #4's CI eval run. Expect cat1=15/15 + cat4=5/5 PASS without any `deflectionReason: "ratelimit"` rows. That's the structural validation of all three SEED-001 halves working together. Document on the quick task SUMMARY.
- After PR #4 merges to main, run `npm run eval -- --cats cat1 --target https://joe-dollinger-chat.com` against prod. Expect cat1=15/15 with zero ratelimit deflections, repeat 2-3x within ~10 minutes (single-IP burst) to validate ip10m no longer trips. That's the long-term SEED-001 Acceptance Criteria #1 ("≥3 consecutive successful runs against the live deployment without any manual rate-limit reset between them") satisfied across all three halves.
</verification>

<success_criteria>
1. **Third sibling helper**: `isEmailIpRatelimitAllowlisted(email)` exported from `src/lib/redis.ts`, consults `EVAL_CLI_ALLOWLIST` Set, parallel signature to `isEmailRatelimitAllowlisted` and `isEmailSpendCapAllowlisted`.

2. **Bypass works at unit layer**: `checkRateLimits('ip', 'eval-cli@joedollinger.dev', 'sess')` does NOT invoke `ipLimiter10m.limit()` OR `ipLimiterDay.limit()`. Verified by Task 1 Test N.

3. **Bypass works at integration layer**: A request from a session with email `eval-cli@joedollinger.dev` reaches `classifyUserMessage` even when `checkRateLimits` would have tripped ip10m for a non-allowlisted caller (verified structurally via the integration mock pattern). Verified by Task 2 Tests 1 + 2.

4. **Bypass is exact-match**: Pattern-adjacent emails (`eval-cli-test@`, `eval-cli2@`, `EVAL-CLI@`, `eval-cli@joedollinger.dev.attacker.com`) DO invoke `ipLimiter10m.limit()` AND `ipLimiterDay.limit()`. Verified by Task 1 Test P and Task 2 Test 3.

5. **SAFE-08 last-line backstop preserved**: `checkRateLimits` returning `{ ok: false, which: 'ipcost' }` for an allowlisted email still produces a ratelimit deflection in /api/chat. Verified by Task 1 Test Q (unit) AND Task 2 Test 4 (integration — security-critical, mirrors T-ro4-07 / chat-spendcap-allowlist Test 4).

6. **Session limiter preserved**: `sessionLimiter.limit()` STILL fires for allowlisted emails (verified at unit layer by Task 1 Test N's `sessionLimiter.limit` toHaveBeenCalledWith assertion); session-limiter failure still produces ratelimit deflection (verified at integration layer by Task 2 Test 5). D-A-01 scope boundary documented.

7. **Per-email + spend-cap exemptions preserved**: All 19+ existing SEED-001 tests in `tests/lib/redis.test.ts` (r4s + ro4) still pass byte-identically. All 3 tests in `tests/api/chat-email-allowlist.test.ts` and all 4 tests in `tests/api/chat-spendcap-allowlist.test.ts` still pass.

8. **Three-helper unified Set**: `EVAL_CLI_ALLOWLIST` remains the single source of truth. The extended drift-detection test in `tests/lib/redis.test.ts` iterates the Set and asserts all three helpers return identical results for every member AND for every pattern-adjacent test email.

9. **Six-gate order preserved**: `tests/api/chat-six-gate-order.test.ts` passes 5/5 byte-identically (gate 5 still fires 5th in canonical sequence; happy-path uses `r@x.com` so the rate-limit check still records `rate_limit_check` in the gate recorder).

10. **Route diff = 0**: `src/app/api/chat/route.ts` is BYTE-IDENTICAL after this change. Allowlist logic lives entirely inside `checkRateLimits` in `src/lib/redis.ts`, preserving the Phase 2 D-G-01..05 byte-identical-route guarantees and the r4s pattern.

11. **Mock surfaces consistent**: All four pre-existing /api/chat test files (`chat-email-allowlist`, `chat-spendcap-allowlist`, `chat-six-gate-order`, `chat-tools`) have `isEmailIpRatelimitAllowlisted: () => false` added to their `@/lib/redis` mock factory blocks. Each remains green with byte-identical test behavior (none of their tests exercise the ip-rl path).

12. **Docs reconciled**: `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` frontmatter `resolved_by` lists all three halves; Resolution Notes section has a third paragraph covering 260512-sne; Combined-effect paragraph reflects all three halves; Acceptance Criteria revision append notes the second AC bullet (per-IP rate limit still applies) is now ALSO superseded.

13. **All verification gates green**: `npm test` (full suite), `npx tsc --noEmit`, `npm run build` all exit 0. Plan 05-10 lesson — three-gate verification before declaring done.

14. **CI**: After landing on `gsd/05-12-task-0-classifier-tune`, re-trigger PR #4's CI eval run. Cat1 = 15/15 + cat4 = 5/5 with zero `deflectionReason: "ratelimit"` rows. Structural validation that the third half closes the remaining single-IP-burst failure mode.
</success_criteria>

<output>
After completion, create `.planning/quick/260512-sne-exempt-eval-cli-joedollinger-dev-from-pe/260512-sne-SUMMARY.md` with:

- SEED-001 third-half reference + summary of all three halves now resolved
- Commit hash(es) (preferably 1-2 commits: one for code+tests, one for SEED-001 doc — mirrors ro4 pattern)
- File diff summary (lines added/removed per file across the 8 files)
- Test count delta (~18 new tests: ~13 unit in tests/lib/redis.test.ts + 5 integration in chat-iprl-allowlist.test.ts; net zero from the 4 mock-addition files)
- Verification gate results (`npm test`, `npx tsc --noEmit`, `npm run build` all green)
- Threat-model verification table (T-sne-01..09 each cross-referenced to the test that anchors its mitigation/accept disposition)
- Update STATE.md "Quick Tasks Completed" table with the row `260512-sne | exempt eval-cli email from per-IP rate limits ip10m + ipday (SEED-001 ip-rl half — third in series) | 2026-05-12 | <commit> | DONE | [./quick/260512-sne-exempt-eval-cli-joedollinger-dev-from-pe/](./quick/260512-sne-exempt-eval-cli-joedollinger-dev-from-pe/)`
- Update `.planning/seeds/SEED-001-...md` is handled in Task 3, not the SUMMARY; just verify final commit hash is filled in where Task 3 left `<will be filled in by close-out>`
- Note in SUMMARY: post-merge follow-up is re-triggering PR #4's CI eval run to verify cat1=15/15 + cat4=5/5 without ratelimit deflections. Observation, not implementation; not a gate on this quick task closing.
- Self-check section (mirror ro4 SUMMARY): bulleted verification of each <success_criteria> item, all checked.
</output>
