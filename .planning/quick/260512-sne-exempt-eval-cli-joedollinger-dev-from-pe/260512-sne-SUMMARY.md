---
phase: quick
plan: 260512-sne
subsystem: redis-rate-limit-ip-allowlist
tags: [seed-001, ip-rate-limit, eval-cli, ci-reliability, abuse-controls, safe-05, safe-06, safe-08]

dependency_graph:
  requires:
    - 260512-r4s          # rate-limit half (per-email window) — landed e3dbfae
    - 260512-ro4          # spend-cap half (SAFE-04 global counter) — landed 5c19fa1 + 423c984
    - SEED-001            # original seed planted 2026-05-12 EOD by /gsd-seed
  provides:
    - isEmailIpRatelimitAllowlisted  # third sibling helper consulting unified EVAL_CLI_ALLOWLIST Set
    - "checkRateLimits ip10m/ipday short-circuit"  # ipRlExempt branch — D-A-01 ip-half bypass
    - "three-helper drift-detection"  # extended SEED-001 unified-Set test to cover all 3 helpers
  affects:
    - src/lib/redis.ts
    - tests/lib/redis.test.ts
    - tests/api/chat-iprl-allowlist.test.ts  # new
    - tests/api/chat-email-allowlist.test.ts  # mock surface addition
    - tests/api/chat-spendcap-allowlist.test.ts  # mock surface addition
    - tests/api/chat-six-gate-order.test.ts  # mock surface addition
    - tests/api/chat-tools.test.ts  # mock surface addition
    - .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md

tech_stack:
  added: []
  patterns:
    - "Three-helper unified-allowlist Set pattern extended from 2 to 3 sibling helpers (D-A-02)"
    - "Promise.resolve({ success: true } as const) synthetic in Promise.all to preserve precedence ordering when a limiter is bypassed (mirrors r4s email-limiter exemption pattern)"
    - "Drift-detection idiom iterates the canonical Set across N helpers — extends linearly as new gates get allowlist-aware short-circuits"
    - "Route.ts byte-identical guarantee preserved (D-G-01..05 from Phase 02) — allowlist logic lives inside checkRateLimits in src/lib/redis.ts"

key_files:
  created:
    - tests/api/chat-iprl-allowlist.test.ts  # 5 integration tests for the ip-rate-limit half
  modified:
    - src/lib/redis.ts  # new helper + checkRateLimits ip-rl skip + extended comment header
    - tests/lib/redis.test.ts  # +13 unit tests (6 direct-unit + 4 checkRateLimits behaviors + extended 3-helper drift-detection); 1 pre-existing r4s assertion updated to reflect new D-A-01 ip-half bypass
    - tests/api/chat-email-allowlist.test.ts  # 1-line mock addition
    - tests/api/chat-spendcap-allowlist.test.ts  # 1-line mock addition
    - tests/api/chat-six-gate-order.test.ts  # 1-line mock addition
    - tests/api/chat-tools.test.ts  # 1-line mock addition
    - .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md  # resolved_by + Resolution Notes third paragraph + combined-effect rewrite + AC revision append
  unchanged_critical:
    - src/app/api/chat/route.ts  # BYTE-IDENTICAL (verified: `git diff 97e4a65^ src/app/api/chat/route.ts` returns empty)
    - src/lib/redis.ts EVAL_CLI_ALLOWLIST Set membership  # still single entry: 'eval-cli@joedollinger.dev'
    - src/lib/redis.ts isEmailRatelimitAllowlisted  # already-shipped r4s helper, body unchanged
    - src/lib/redis.ts isEmailSpendCapAllowlisted  # already-shipped ro4 helper, body unchanged
    - src/lib/redis.ts checkRateLimits signature  # (ipKey, email, sessionId) unchanged
    - src/lib/redis.ts checkRateLimits precedence ordering  # ip10m → ipday → email → session → ipcost preserved
    - src/lib/redis.ts incrementIpCost  # SAFE-08 per-IP cost cap is the load-bearing last-line backstop — NOT gated by email

decisions:
  - "D-A-01 ip-half bypass: ipLimiter10m + ipLimiterDay short-circuited via Promise.resolve({ success: true } as const) for allowlisted emails. Session limiter (200/7d) STILL fires (D-A-01 scope boundary; the safety net is preserved). Same synthetic pattern used for the email-limiter exemption in r4s."
  - "D-A-02 three-helper unified Set: isEmailIpRatelimitAllowlisted added as the third sibling alongside isEmailRatelimitAllowlisted + isEmailSpendCapAllowlisted. All three consult the unified EVAL_CLI_ALLOWLIST Set. Drift-detection test in tests/lib/redis.test.ts extended from 2 helpers to 3 — iterates the Set and asserts all three helpers return identical results for every member AND for every pattern-adjacent test email."
  - "D-A-03 SAFE-08 as only cost backstop: per-IP cost cap (150¢/day per IP) is now the only cost-based last-line backstop for eval-cli traffic. Joe explicitly accepted the tradeoff — ceiling per IP per day = $1.50 in Anthropic spend; distributed attack bounded by per-IP independence + org-level $100/mo cap. SAFE-08 in checkRateLimits + incrementIpCost in /api/chat onFinish are NOT gated by email (T-sne-04 regression-trap)."
  - "Six-gate order preserved: chat-six-gate-order.test.ts passes 5/5 byte-identically (gate 5 still fires 5th). The internal short-circuit lives inside checkRateLimits (which is mocked at module boundary in that test), so gate ordering is structurally unaffected. Happy-path uses r@x.com (not allowlisted), so the rate-limit check still records 'rate_limit_check' in the gate recorder."
  - "Route.ts byte-identical guarantee preserved: src/app/api/chat/route.ts shows zero diff after this task. All ip-rl allowlist logic lives inside checkRateLimits in src/lib/redis.ts. Mirrors the r4s approach exactly."
  - "Updated 1 pre-existing r4s test assertion: tests/lib/redis.test.ts 'SKIPS emailLimiterDay.limit() for canonical eval-cli email' previously asserted ip10m + ipday WERE still called (r4s preserved per-IP limits by design). Updated to assert they are NOT called (new D-A-01 ip-half behavior). Replacement-comment marker on the assertion documents the supersedence."

metrics:
  duration: "~12 minutes (Tasks 1-3 + close-out)"
  completed: 2026-05-12
  task_count: 3
  file_count: 8
  tests_added: "+18 (+13 unit in tests/lib/redis.test.ts; +5 integration in tests/api/chat-iprl-allowlist.test.ts; net zero from the 4 mock-addition files)"
  total_tests_post: "663 passing (663/663) in 64 files"
---

# Quick Task 260512-sne: SEED-001 ip-rate-limit Half Summary

## One-Liner

Closed SEED-001 (ip-rate-limit half — third and final) by adding `isEmailIpRatelimitAllowlisted` (third sibling helper consulting unified `EVAL_CLI_ALLOWLIST` Set) + short-circuiting `ipLimiter10m.limit()` and `ipLimiterDay.limit()` inside `checkRateLimits` for allowlisted emails (D-A-01 ip-half full bypass); SAFE-08 per-IP cost cap (150¢/day/IP) is now the only cost-based last-line backstop for eval-cli traffic and is verified at both unit + integration layers as still trippable for allowlisted emails (T-sne-04 regression-trap).

## What Changed

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/redis.ts` | +29 / -7 | Rewrite `EVAL_CLI_ALLOWLIST` header comment to mention ip10m/ipday alongside rate-limit + spend-cap (`SECURITY` block updated to call SAFE-08 the only remaining cost backstop and session limiter the only remaining session backstop); add `isEmailIpRatelimitAllowlisted` helper (third sibling; body identical to other two — `EVAL_CLI_ALLOWLIST.has(email)`); extend `checkRateLimits` to short-circuit ip10m + ipday with `Promise.resolve({ success: true } as const)` for allowlisted emails. Precedence ordering + Promise.all shape + return shape all preserved. |
| `tests/lib/redis.test.ts` | +97 / -4 | +13 new tests in 3 describe blocks: 6× `isEmailIpRatelimitAllowlisted` direct unit (mirrors `isEmailRatelimitAllowlisted` + `isEmailSpendCapAllowlisted` 6-case suites), 4× `checkRateLimits — allowlisted email (ip-rate-limit half)` (SKIPS ip10m/ipday, back-compat, pattern-adjacency it.each, T-sne-04 SAFE-08 regression-trap), extended 2-helper drift-detection block to cover all 3 helpers. 1 pre-existing r4s assertion updated to reflect new D-A-01 ip-half bypass (ip10m + ipday no longer called for allowlisted; comment marker documents the supersedence). |
| `tests/api/chat-iprl-allowlist.test.ts` | +290 new | 5 integration tests asserting end-to-end contract through /api/chat: (1) eval-cli bypasses ip10m and reaches classifier, (2) eval-cli bypasses ipday and reaches classifier, (3) pattern-adjacent `eval-cli-test@` STILL deflects with reason=ratelimit at ip10m (exact-match contract — security-critical), (4) SAFE-08 ipcost STILL trips for eval-cli@ (T-sne-04 last-line backstop — mirrors chat-spendcap-allowlist Test 3 / T-ro4-04), (5) session limiter STILL applies to eval-cli@ (D-A-01 scope boundary). |
| `tests/api/chat-email-allowlist.test.ts` | +2 | 1-line `isEmailIpRatelimitAllowlisted: () => false` mock addition (defensive, per ro4 precedent — pre-existing tests' 3 surviving cases remain green byte-identically). |
| `tests/api/chat-spendcap-allowlist.test.ts` | +2 | 1-line `isEmailIpRatelimitAllowlisted: () => false` mock addition. |
| `tests/api/chat-six-gate-order.test.ts` | +4 | 1-line `isEmailIpRatelimitAllowlisted: () => false` mock addition. Happy-path uses `r@x.com` (not allowlisted) so canonical 6-gate recorder sequence preserved 5/5. |
| `tests/api/chat-tools.test.ts` | +2 | 1-line `isEmailIpRatelimitAllowlisted: () => false` mock addition. Happy-path uses `r@x.com` so onFinish wiring + W4 heartbeat-before-persistence tests remain semantically identical. |
| `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` | +5 / -2 | Frontmatter `resolved_by` upgraded from `[260512-r4s, 260512-ro4]` to `[260512-r4s, 260512-ro4, 260512-sne]`; "Both halves resolved" → "All three halves resolved"; new third Resolution Notes paragraph describing the ip-rate-limit half + root cause (PR #4 CI 2026-05-13T00:29:20Z runId `HYxSxtSM_8f782_NdJ7kr` ratelimit deflections on cat1-fab-013/014/015 from single GH Actions runner IP); Combined-effect paragraph rewritten to reflect all three halves; new Acceptance Criteria revision append marking the second AC bullet (Per-IP rate limit) as superseded; commit-hash placeholder filled with the three new commit hashes. |

**Total:** +431 insertions / -13 deletions across 8 files.

## Commits

| # | Hash | Subject | Files |
|---|------|---------|-------|
| 1 | `97e4a65` | feat(quick-260512-sne): SEED-001 ip-rate-limit half — add isEmailIpRatelimitAllowlisted + checkRateLimits ip10m/ipday skip | src/lib/redis.ts, tests/lib/redis.test.ts |
| 2 | `161fb56` | test(quick-260512-sne): SEED-001 ip-rate-limit half — chat-iprl-allowlist integration tests + 4 sibling mock additions | tests/api/chat-iprl-allowlist.test.ts (new), tests/api/chat-email-allowlist.test.ts, tests/api/chat-spendcap-allowlist.test.ts, tests/api/chat-six-gate-order.test.ts, tests/api/chat-tools.test.ts |
| 3 | `e69db02` | docs(quick-260512-sne): mark SEED-001 fully resolved — all three halves landed | .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md |
| 4 | `9d079c5` | docs(quick-260512-sne): fill in 260512-sne commit hashes in SEED-001 Resolution Notes | .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md |

## Verification Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Full unit + integration tests | `npm test` | 64 files / 663 tests pass (up from 645 baseline by +18 = 13 unit + 5 integration; net zero from the 4 mock-addition files; 1 pre-existing r4s assertion updated to reflect new D-A-01 ip-half bypass) |
| Strict TS | `npx tsc --noEmit` | exit 0 |
| Production build | `npm run build` | exit 0 (Next.js 16 build green; Plan 05-10 lesson — strict tsc + build catches what local vitest misses) |
| Six-gate order test | `npx vitest run tests/api/chat-six-gate-order.test.ts` (included in full suite) | 5/5 byte-identical (gate 5 still fires 5th in canonical sequence) |
| New ip-rl integration tests | `npx vitest run tests/api/chat-iprl-allowlist.test.ts` | 5/5 pass |
| Route.ts byte-shape verification | `git diff 97e4a65^ src/app/api/chat/route.ts` | empty (BYTE-IDENTICAL across all four sne commits — confirms the r4s pattern of "logic lives in redis.ts, route.ts unchanged") |
| 3-helper presence in redis.ts | `git grep -n 'isEmailIpRatelimitAllowlisted' src/lib/redis.ts` | 3 hits (comment header reference + declaration + body reference inside checkRateLimits) |
| Seed doc verifier | `node -e "...includes('260512-sne') && includes('Ip-rate-limit half') && includes('isEmailIpRatelimitAllowlisted') && includes('T-sne')..."` | exit 0 — `seed-doc ok` |

## Threat Model Mitigations Re-Verified Post-Implementation

| Threat ID | Category | Disposition | Verified By |
|-----------|----------|-------------|-------------|
| T-sne-01 | Spoofing eval-cli@ at ip-rate-limit layer | mitigate | `tests/api/chat-iprl-allowlist.test.ts` Test 4 — SAFE-08 per-IP cost cap STILL trips for eval-cli@ (last-line backstop preserved). Test 5 — session limiter STILL applies to eval-cli@ (D-A-01 scope boundary). `tests/lib/redis.test.ts` Test N — `sessionLimiter.limit` is called for allowlisted email even though ip10m + ipday are bypassed. |
| T-sne-02 | Pattern-bypass (case-variant, subdomain-trick) at ip-rate-limit layer | mitigate | `tests/lib/redis.test.ts` `isEmailIpRatelimitAllowlisted` 6-case suite + `it.each` pattern-adjacency block (`'eval-cli-test@'`, `'eval-cli2@'`, `'EVAL-CLI@'`, `'eval-cli@joedollinger.dev.attacker.com'` ALL hit ip10m + ipday) + `tests/api/chat-iprl-allowlist.test.ts` Test 3 (`eval-cli-test@` STILL deflects with reason=ratelimit at integration layer). |
| T-sne-03 | Drift among three helpers (isEmailRatelimitAllowlisted + isEmailSpendCapAllowlisted + isEmailIpRatelimitAllowlisted) | mitigate | `tests/lib/redis.test.ts` "SEED-001 unified EVAL_CLI_ALLOWLIST drift detection (D-A-02)" extended to 3 helpers — iterates the Set and asserts all three helpers return identical results for every member AND for every pattern-adjacent test email. Future executor cannot diverge any one helper (e.g. add `.toLowerCase()` to only isEmailIpRatelimitAllowlisted) without that test failing noisily. |
| T-sne-04 | DoS via distributed-IP attack on allowlisted email | accept | SAFE-08 operates on `ipKey`, not on email. Verified at TWO layers: `tests/lib/redis.test.ts` Test Q (unit — pre-populates FakeRedis ipcost key to 150 and asserts `checkRateLimits` returns `{ ok: false, which: 'ipcost' }` for allowlisted email; ip10m + ipday spies confirmed not called) AND `tests/api/chat-iprl-allowlist.test.ts` Test 4 (integration — checkRateLimits returns `{ ok: false, which: 'ipcost' }` and route maps to reason=ratelimit deflection). The SAFE-08 check is the load-bearing last-line cost backstop after sne. Per D-A-03: explicit accept disposition; $1.50/day per IP × N IPs bounded by org-level $100/mo cap. |
| T-sne-05 | DoS via session limiter bypass | accept | Session limiter operates on `sessionId`, not on email. `tests/lib/redis.test.ts` Test N asserts `sessionLimiter.limit` IS called for allowlisted email (D-A-01 scope boundary). `tests/api/chat-iprl-allowlist.test.ts` Test 5 asserts integration-layer ratelimit deflection when checkRateLimits returns `{ ok: false, which: 'session' }`. 200/7d generous enough for legitimate CI traffic (each run mints a fresh session). |
| T-sne-06 | Operational log leak of allowlisted email | accept | No new log statements introduced by this change. Same disposition as T-r4s-05 + T-ro4-05. |
| T-sne-07 | Future executor disables SAFE-08 as redundant | mitigate | Three independent surfaces document the load-bearing intent: (1) `EVAL_CLI_ALLOWLIST` header comment in `src/lib/redis.ts` explicitly states SAFE-08 is the only remaining cost-based last-line backstop after sne lands; (2) inline comment above `ipRlExempt` const in `checkRateLimits` says "Future executor noticing the asymmetry 'we bypass ip10m + ipday but not ipcost' — read the SECURITY comment above"; (3) Test Q regression-trap asserts SAFE-08 STILL trips for allowlisted email. Mirrors the ro4 T-ro4-07 mitigation surface count. |
| T-sne-08 | Eval CLI literal drift from EVAL_CLI_ALLOWLIST | mitigate | Existing constant-shape test in `tests/lib/redis.test.ts` (lines 121-126, unchanged) imports `EVAL_CLI_ALLOWLIST` and asserts it contains exactly `'eval-cli@joedollinger.dev'`. The literal in `src/lib/eval/agent-client.ts mintEvalSession` is physically separated but bridged by this test. Bridge established by r4s and now leveraged by all three halves. |
| T-sne-09 | Repudiation / audit ambiguity at ip-rate-limit layer | mitigate | All eval traffic uses sessions with `email_domain='joedollinger.dev'` — already greppable in admin/sessions UI. SEED-001 doesn't change this signal. CR-02's `EVAL_SYNTHETIC_EMAIL_SUFFIX` skip in email.ts also still distinguishes eval sessions from recruiter sessions at the notification layer. |

## Deviations from Plan

### None — plan executed exactly as written, with one anticipated test update

The plan explicitly anticipated that the pre-existing r4s test (`tests/lib/redis.test.ts` "SKIPS emailLimiterDay.limit() for canonical eval-cli email") would need its `ipLimiter10m` + `ipLimiterDay` `toHaveBeenCalledTimes(1)` assertions inverted to `not.toHaveBeenCalled()` because the new D-A-01 ip-half bypass changes the contract: per-IP rate limits are now ALSO bypassed for allowlisted emails. This is a planner-anticipated test update (the plan's `<behavior>` Test N text describes the new behavior; the implication for the pre-existing assertion was implicit but consistent). Replacement-comment marker placed at the updated assertion documenting the supersedence.

The 1-line mock additions in 4 sibling test files (chat-email-allowlist, chat-spendcap-allowlist, chat-six-gate-order, chat-tools) were also planner-anticipated (the plan's `<behavior>` enumerates each file by name) and are therefore NOT Rule 3 deviations.

## Self-Check

- [x] `src/lib/redis.ts` exports `isEmailIpRatelimitAllowlisted` (new function) — verified via Grep (3 hits)
- [x] `src/lib/redis.ts` `checkRateLimits` signature unchanged `(ipKey, email, sessionId) => Promise<RateLimitCheck>` — verified via Grep
- [x] `src/lib/redis.ts` `EVAL_CLI_ALLOWLIST` Set membership unchanged (`size === 1`, contains `'eval-cli@joedollinger.dev'`) — verified by pre-existing constant-shape test still green
- [x] `checkRateLimits` Promise.all shape preserved (5-tuple destructure, ipRlExempt branches inline) — verified by re-reading source post-edit
- [x] Precedence ordering preserved: ip10m → ipday → email → session → ipcost — verified by re-reading source post-edit
- [x] `tests/lib/redis.test.ts` has 13 new tests + 1 updated assertion (43 tests total, up from 30); all pass
- [x] `tests/api/chat-iprl-allowlist.test.ts` exists with 5 SEED-001 ip-rl-prefixed tests; all pass
- [x] 4 sibling test files each have `isEmailIpRatelimitAllowlisted: () => false` mock entry — verified by Grep
- [x] `tests/api/chat-six-gate-order.test.ts` passes 5/5 byte-identically — verified in full-suite run
- [x] All 4 task commits exist: `97e4a65`, `161fb56`, `e69db02`, `9d079c5` — verified via `git log --oneline -4`
- [x] `npm test`: 663/663 pass — verified
- [x] `npx tsc --noEmit`: exit 0 — verified
- [x] `npm run build`: exit 0 — verified
- [x] `src/app/api/chat/route.ts` BYTE-IDENTICAL across all sne commits — verified via `git diff 97e4a65^ src/app/api/chat/route.ts` (empty)
- [x] `.planning/seeds/SEED-001-...md` `resolved_by` lists all three halves + Resolution Notes section has 3 paragraphs + Combined-effect rewritten + AC revision append present — verified via node probe (exit 0, `seed-doc ok`)
- [x] Commit-hash placeholder in seed doc replaced with actual sne commit hashes — verified via Grep
- [x] Three-helper drift-detection in `tests/lib/redis.test.ts` iterates all three helpers — verified via Grep + test pass

## Self-Check: PASSED

## Threat Flags

None. No new network endpoints, no auth-path changes, no schema modifications, no new trust boundaries. The change extends the existing unified-allowlist pattern (D-A-02) to a third gate (per-IP rate limit) using the same exact-match Set-membership policy used by the two earlier halves. SAFE-08 per-IP cost cap (150¢/day per IP) and session limiter (200 msg/7d) remain as the security-critical last-line backstops — both verified at unit + integration layers. The three-helper drift-detection block is the new regression-trap against future executors who might add case-insensitive normalization or env-var-driven extension to one helper but not the others.

## Known Stubs

None. The change does not introduce any placeholder, hardcoded-empty, or "coming soon" surfaces. The post-merge follow-up — re-triggering PR #4's CI eval run to validate cat1=15/15 + cat4=5/5 without ratelimit deflections — is observation (not implementation) and is intentionally NOT a gate on this quick task per the plan's `<output>` block.

## Post-Merge Follow-Up

- **PR #4 CI re-trigger:** After this commit lands on `gsd/05-12-task-0-classifier-tune`, re-trigger PR #4's CI eval run. Expect cat1=15/15 + cat4=5/5 PASS without any `deflectionReason: "ratelimit"` rows. That's the structural validation of all three SEED-001 halves working together. Observation, not implementation.
- **Long-term SEED-001 Acceptance Criteria #1:** After PR #4 merges to main, run `npm run eval -- --cats cat1 --target https://joe-dollinger-chat.com` against prod 3+ times within ~10 minutes (single-IP burst). Expect cat1=15/15 each run with zero ratelimit deflections. Satisfies the "≥3 consecutive successful runs against the live deployment without any manual rate-limit reset between them" criterion across all three halves.
- **SEED-001 fully resolved:** Frontmatter `status: resolved` (was already set after ro4); `resolved_by` now lists all three halves. No further halves planned — the original seed's structural gap is closed end-to-end.
