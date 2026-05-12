---
phase: quick
plan: 260512-r4s
subsystem: rate-limit
tags: [seed-001, rate-limit, eval-cli, ci-reliability]
seed: SEED-001 (status flip: dormant → resolved)
dependency_graph:
  requires: []
  provides:
    - EVAL_CLI_RATELIMIT_ALLOWLIST (Set<string>)
    - isEmailRatelimitAllowlisted(email)
    - per-email window bypass for canonical eval-cli email
  affects:
    - src/lib/redis.ts checkRateLimits behavior (only allowlisted email branch changes)
    - scripts/reset-eval-rate-limits.ts (header only; logic byte-identical)
    - .planning/phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md follow-up bullet
tech_stack:
  added: []
  patterns:
    - Exact-match ReadonlySet<string> allowlist (NOT regex, NOT suffix, case-sensitive)
    - Synthetic Promise.resolve({success:true}) preserves Promise.all shape for early-skip branch
    - Per-instance Ratelimit mock with vi.fn() .limit() spies (refactor of redis.test.ts mock)
    - Typed vi.fn() generic with discriminated-union return type to enable mockImplementationOnce(failure) under strict tsc
key_files:
  created:
    - tests/api/chat-email-allowlist.test.ts
  modified:
    - src/lib/redis.ts
    - tests/lib/redis.test.ts
    - scripts/reset-eval-rate-limits.ts
    - .planning/phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md
  unchanged_critical:
    - src/app/api/chat/route.ts (byte-identical — Phase 2 D-G-01..05 contract preserved; chat-six-gate-order.test.ts contract preserved)
decisions:
  - Allowlist as hardcoded Set (NOT env-var driven) so drift-detection test can compare to canonical eval-cli literal at compile time
  - Exact-match Set.has() (case-sensitive, no suffix, no regex) — pattern-adjacent emails MUST hit limiter
  - Synthetic Promise.resolve({success:true}) preserves Promise.all parallelism and the canonical precedence ordering (ip10m → ipday → email → session → ipcost)
  - Logic lives in src/lib/redis.ts checkRateLimits — /api/chat/route.ts call site unchanged (preserves chat-six-gate-order.test.ts contract)
metrics:
  duration: 7min
  tasks: 3
  files: 5
  tests_added: 12
  completed_date: 2026-05-12
---

# Quick Task 260512-r4s: Exempt eval-cli email from per-email rate limiter (SEED-001) Summary

**One-liner:** Closed SEED-001 by adding an exact-match `EVAL_CLI_RATELIMIT_ALLOWLIST` Set + `isEmailRatelimitAllowlisted()` guard inside `checkRateLimits` — eval-cli@joedollinger.dev now bypasses the per-email 150/day sliding window while ip10m/ipday/session/ipcost/spendcap backstops remain fully active.

## What changed

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/redis.ts` | +47 / -3 | `EVAL_CLI_RATELIMIT_ALLOWLIST` ReadonlySet + `isEmailRatelimitAllowlisted` helper; `checkRateLimits` skips `emailLimiterDay.limit()` when allowlisted via synthetic `Promise.resolve({success:true})` inside the existing `Promise.all` shape |
| `tests/lib/redis.test.ts` | +130 / -16 | Refactored `@upstash/ratelimit` mock to per-instance `vi.fn()` spies (so we can assert which limiter fired); added 12 SEED-001 unit tests: constant shape, `isEmailRatelimitAllowlisted` direct (6 cases), `checkRateLimits` allowlisted-skip + non-allowlisted-call + `it.each` pattern-adjacency (4 emails) |
| `tests/api/chat-email-allowlist.test.ts` | +315 (new) | 4 end-to-end /api/chat tests: exact-match bypass reaches classifier; pattern-adjacent trips ratelimit deflection; per-IP STILL deflects allowlisted email (T-r4s-01 critical mitigation); spend cap (gate 4) STILL deflects allowlisted email before rate-limit gate (T-r4s-04) |
| `scripts/reset-eval-rate-limits.ts` | +12 / 0 | Header paragraph: email-key clearing is now a no-op for allowlisted emails (preserved for backward compat + future env-var-driven extension); executable logic byte-identical |
| `.planning/phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md` | +1 / -1 | Reset-script audit bullet struck through and marked RESOLVED with commit references |

**`src/app/api/chat/route.ts`: byte-identical** (verified `git diff f573437 HEAD -- src/app/api/chat/route.ts` empty). Preserves Phase 2 D-G-01..05 contract and the canonical six-gate order asserted by `tests/api/chat-six-gate-order.test.ts`.

## Commits (single branch `gsd/05-12-task-0-classifier-tune`)

| Commit | Type | Task | Description |
|--------|------|------|-------------|
| `e3dbfae` | feat | Task 1 | EVAL_CLI_RATELIMIT_ALLOWLIST + isEmailRatelimitAllowlisted + checkRateLimits guard + 12 unit tests |
| `71a78fb` | test | Task 2 | /api/chat integration tests for exact-match contract + per-IP/spend-cap mitigations |
| `2c3b4de` | docs | Task 3 | reset-eval-rate-limits.ts header + 05-12-LAUNCH-CHECKLIST.md follow-up |

## Verification gate results

- **`npm test` (full suite):** 62 files / 629 tests / **all pass** (12 new tests vs ~575 prior; reconciles with Plan estimate of ~8 new — the actual delta is higher because of the `it.each` expansion for pattern-adjacency)
- **`npx tsc --noEmit`:** exit 0
- **`npm run build`:** exit 0 (per Plan 05-10 lesson — strict tsc-on-build catches what local vitest doesn't; caught one issue during Task 2 implementation — vi.fn return-type narrowing for `mockImplementationOnce`; fixed inline by typing the generic with the full `RateLimitCheck` union)
- **`git diff f573437 HEAD -- src/app/api/chat/route.ts`:** empty (zero-diff on route.ts; success criterion #6)
- **Task 3 verification probe:** `docs ok`

## Threat model mitigations (STRIDE register from PLAN.md re-verified post-implementation)

| Threat ID | Mitigation | Verified by |
|-----------|------------|-------------|
| T-r4s-01 (spoof allowlisted email) | per-IP rate limit (ip10m=20/10min + ipday=60/day) STILL applies | `tests/api/chat-email-allowlist.test.ts` Test 3 — ip10m deflects allowlisted email |
| T-r4s-02 (pattern-bypass: case-variant + subdomain trick + suffix) | exact-match `Set.has()` — case-sensitive, NOT `.endsWith()`, NOT regex | `tests/lib/redis.test.ts` `it.each` over `['eval-cli-test@', 'eval-cli2@', 'eval-cli@joedollinger.dev.attacker.com', 'EVAL-CLI@joedollinger.dev']` — all DO call emailLimiterDay |
| T-r4s-03 (allowlist drift between agent-client.ts and redis.ts) | constant size + canonical literal asserted at compile time | `tests/lib/redis.test.ts` `EVAL_CLI_RATELIMIT_ALLOWLIST` shape test (size=1, has canonical literal); `src/lib/eval/agent-client.ts:209` confirms `'eval-cli@joedollinger.dev'` literal matches |
| T-r4s-04 (spend cap bypass via allowlisted email) | gate 4 (`isOverCap`) fires BEFORE gate 5 (`checkRateLimits`); ipcost (D-D-05) still tripped on email-allowlisted requests via `getIpCostToday` | `tests/api/chat-email-allowlist.test.ts` Test 4 — `isOverCap=true` produces spendcap deflection, rate-limit check NOT reached |
| T-r4s-05 (logging allowlisted email) | accepted — no new log statements introduced; existing route.ts logs are unchanged | route.ts byte-identical |
| T-r4s-06 (audit signal: distinguish eval vs recruiter traffic) | preserved — `email_domain='joedollinger.dev'` unchanged | no schema/migration touched |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] vi.fn() return-type narrowing blocked `mockImplementationOnce(failure)`**
- **Found during:** Task 2 (during `npm run build` strict tsc verification — local `vitest` did not catch)
- **Issue:** Default `vi.fn(async () => ({ ok: true }))` inferred a literal `{ readonly ok: true }` return type. `mockImplementationOnce` in Tests 2 + 3 returned `{ ok: false, which: 'email' }` and `{ ok: false, which: 'ip10m' }` — TS rejected with `Type 'false' is not assignable to type 'true'`.
- **Fix:** Typed the `vi.fn` generic explicitly with the full `RateLimitCheck` union (`{ ok: true } | { ok: false; which: 'ip10m' | 'ipday' | 'email' | 'session' | 'ipcost' }`).
- **Files modified:** `tests/api/chat-email-allowlist.test.ts`
- **Commit:** rolled into `71a78fb` (single commit per task per Plan constraint)

Otherwise plan executed exactly as written. No Rule 2/3/4 deviations. No authentication gates.

## Threat Flags

None — no new network endpoints, no auth-path changes, no schema modifications, no trust-boundary changes. The change tightens (not broadens) only the per-email check for a single canonical literal.

## Known Stubs

None.

## Post-merge follow-up (not blocking this quick task)

Per SEED-001 Acceptance Criterion #1: confirm ≥3 consecutive CI cat1=15/15 runs against `https://joe-dollinger-chat.com` without any manual rate-limit reset between them. The structural fix is shipped; the CI observation gate is non-blocking on this quick task (it's the post-merge confirmation of the SEED-001 closure, not part of the implementation scope).

This is also the v1.1 / Phase 6 unblocker — Phase 6 (KB enrichment: about-me hardening) is gated on this fix landing first per STATE.md's "Hard dependency" note (Phase 6 verification spend would otherwise re-trip the 24h-rolling cap and re-create the 2026-05-12 silent-lockout incident).

## Self-Check: PASSED

- `src/lib/redis.ts` exports `EVAL_CLI_RATELIMIT_ALLOWLIST` + `isEmailRatelimitAllowlisted` — FOUND (verified by tests/lib/redis.test.ts import + 17/17 pass)
- `tests/api/chat-email-allowlist.test.ts` exists with 4 SEED-001-prefixed tests — FOUND (4/4 pass)
- `scripts/reset-eval-rate-limits.ts` contains "SEED-001" — FOUND (docs ok probe)
- `05-12-LAUNCH-CHECKLIST.md` contains "RESOLVED 2026-05-12 (SEED-001" — FOUND (docs ok probe)
- Commit `e3dbfae` exists in `git log` — FOUND
- Commit `71a78fb` exists in `git log` — FOUND
- Commit `2c3b4de` exists in `git log` — FOUND
- `src/app/api/chat/route.ts` byte-identical vs `f573437` — VERIFIED (empty diff)
