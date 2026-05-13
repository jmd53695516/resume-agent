---
phase: quick
plan: 260512-ro4
subsystem: redis-rate-limit-spend-cap
tags: [seed-001, spend-cap, eval-cli, ci-reliability, abuse-controls, safe-04, safe-08]

dependency_graph:
  requires:
    - 260512-r4s          # rate-limit half landed at commit e3dbfae; this plan extends the unified allowlist + adds the spend-cap exemption
    - SEED-001            # original seed planted 2026-05-12 EOD by /gsd-seed
  provides:
    - EVAL_CLI_ALLOWLIST  # unified rename from EVAL_CLI_RATELIMIT_ALLOWLIST (single ReadonlySet, both halves consult it)
    - isEmailSpendCapAllowlisted  # new helper parallel to isEmailRatelimitAllowlisted, both reading the unified Set
    - incrementSpend(opts.email-gated-skip)  # D-A-01 full invisibility — eval-cli traffic neither reads nor writes the SAFE-04 global counter
    - "gate-4 short-circuit in /api/chat/route.ts"  # !isEmailSpendCapAllowlisted(session.email) && (await isOverCap())
  affects:
    - src/lib/redis.ts
    - src/app/api/chat/route.ts
    - tests/lib/redis.test.ts
    - tests/api/chat-spendcap-allowlist.test.ts  # new
    - tests/api/chat-email-allowlist.test.ts     # mock addition + Test 4 deletion
    - tests/api/chat-six-gate-order.test.ts      # mock addition
    - tests/api/chat-tools.test.ts               # mock addition (Rule 3 deviation)
    - .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md

tech_stack:
  added: []
  patterns:
    - "Exact-match Set-based allowlist (NOT regex / endsWith / case-insensitive) — pattern carried from rate-limit half (260512-r4s) and extended to spend-cap"
    - "Unified single-Set source-of-truth with parallel helpers + drift-detection test iterating the Set"
    - "Short-circuit ordering in JS && expression: cheap-allowlist-check BEFORE await-isOverCap so allowlisted traffic doesn't even hit Redis"
    - "Captured-onFinish test pattern for asserting post-stream wiring when the streamText mock returns a synthetic Response that doesn't naturally invoke the callback"
    - "Load-bearing comment + regression test pair anchoring intentionally-NOT-gated security mitigations (T-ro4-07 — incrementIpCost stays uncalled-by-email)"

key_files:
  created:
    - tests/api/chat-spendcap-allowlist.test.ts        # 4 integration tests for the spend-cap half
  modified:
    - src/lib/redis.ts                                  # rename + new helper + extended incrementSpend signature
    - src/app/api/chat/route.ts                         # import addition + gate-4 short-circuit + onFinish email threading + load-bearing comment
    - tests/lib/redis.test.ts                           # +13 unit tests (6 isEmailSpendCapAllowlisted + 2 drift-detection + 5 incrementSpend skip)
    - tests/api/chat-email-allowlist.test.ts            # mock addition + deliberate Test 4 deletion (premise inverted by D-A-01)
    - tests/api/chat-six-gate-order.test.ts             # 1-line mock addition
    - tests/api/chat-tools.test.ts                      # 1-line mock addition (Rule 3 deviation — pre-existing test file needed the mock surface)
    - .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md  # resolved_by list + Resolution Notes section
  unchanged_critical:
    - src/lib/redis.ts isOverCap()                      # signature unchanged — email check lives at the caller, keeps isOverCap testable in isolation
    - src/lib/redis.ts getSpendToday()                  # read-only, no email concept
    - src/lib/redis.ts incrementIpCost()                # per-IP, NOT gated by email — preserved as SAFE-08 last-line backstop
    - src/lib/redis.ts isEmailRatelimitAllowlisted()    # already-shipped public surface; helper name unchanged; only the constant reference inside renamed
    - src/lib/redis.ts checkRateLimits()                # rate-limit-half code byte-identical to e3dbfae

decisions:
  - "D-A-01 full bypass: isOverCap() short-circuited at gate 4 AND incrementSpend() skips for allowlisted emails. Both halves required — letting eval traffic increment the counter while still bypassing the check creates the silent-lockout failure mode that bit prod 2026-05-12."
  - "D-A-02 unified allowlist Set: single EVAL_CLI_ALLOWLIST consumed by both isEmailRatelimitAllowlisted (rate-limit half) and isEmailSpendCapAllowlisted (spend-cap half). One drift-detection test (Test H) iterates the Set and asserts both helpers return identical results — future executor cannot diverge them."
  - "Gate-4 short-circuit ordering: !isEmailSpendCapAllowlisted(email) FIRST, await isOverCap() SECOND. JS && short-circuits left-to-right, so allowlisted traffic doesn't hit Redis mget for the 24 hourly buckets. Non-allowlisted traffic invokes isOverCap byte-identically (six-gate canonical order preserved)."
  - "incrementIpCost is INTENTIONALLY NOT gated by email — SAFE-08 (150¢/day per IP) is the new last-line cost backstop for eval-cli traffic. Load-bearing comment + Test 4 in chat-spendcap-allowlist anchor this (T-ro4-07 regression-trap against future executors disabling SAFE-08 as 'redundant')."
  - "Deliberate Test 4 deletion from chat-email-allowlist.test.ts: prior test 'SEED-001 AC: spend cap STILL applies to allowlisted eval-cli email' was inverted by D-A-01. Replacement (chat-spendcap-allowlist Test 1) asserts the corrected post-fix behavior. Leaving both would be a self-contradictory regression-trap. Replacement-comment marker left at deletion site for forensic reference."
  - "Captured-onFinish test pattern: streamText mock returns synthetic Response without naturally invoking the callback, so Test 4 captures the callback at streamText() call time and invokes it manually with a synthetic event. Pattern documented inline for reuse in future tests asserting post-stream wiring."

metrics:
  duration: "~10 minutes (recovery of prior Task 1 on-disk work + Task 2 + Task 3 + SUMMARY)"
  completed: 2026-05-12
  task_count: 3
  file_count: 8
  tests_added: "+16 (13 unit in tests/lib/redis.test.ts + 4 integration in chat-spendcap-allowlist.test.ts - 1 deleted from chat-email-allowlist.test.ts)"
  total_tests_post: "645 passing (645/645) in 63 files"
---

# Quick Task 260512-ro4: SEED-001 Spend-Cap Half Summary

## One-Liner

Closed SEED-001 (spend-cap half) by unifying `EVAL_CLI_RATELIMIT_ALLOWLIST` → `EVAL_CLI_ALLOWLIST` + adding `isEmailSpendCapAllowlisted` helper + gating `incrementSpend()` and gate 4 of `/api/chat/route.ts` on the same Set; `eval-cli@joedollinger.dev` is now fully invisible to the SAFE-04 300¢/24h global counter (D-A-01 full bypass) while per-IP rate limits (ip10m/ipday) and per-IP cost cap (SAFE-08, the new last-line backstop) remain fully active.

## What Changed

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/redis.ts` | +57 / -21 | Rename `EVAL_CLI_RATELIMIT_ALLOWLIST` → `EVAL_CLI_ALLOWLIST` (D-A-02 unified Set); add `isEmailSpendCapAllowlisted` helper; extend `incrementSpend(cents, opts?: { email? })` with email-gated skip (D-A-01 full invisibility); rewrite header comment block to document both halves consult the unified Set + SAFE-08 is the new last-line backstop |
| `src/app/api/chat/route.ts` | +28 / -3 | Import `isEmailSpendCapAllowlisted`; wrap gate 4 with `!isEmailSpendCapAllowlisted(session.email) && (await isOverCap())` short-circuit; thread `session.email` into `incrementSpend` in onFinish; add load-bearing comment at `incrementIpCost` call site documenting that it is INTENTIONALLY NOT gated by email (SAFE-08 last-line backstop) |
| `tests/lib/redis.test.ts` | +98 / -2 | +13 new tests in 3 describe blocks: 6× `isEmailSpendCapAllowlisted` direct unit (mirrors `isEmailRatelimitAllowlisted`), 2× unified-Set drift detection iterating the Set, 5× `incrementSpend` email-gated skip |
| `tests/api/chat-spendcap-allowlist.test.ts` | +312 new | 4 integration tests: (1) eval-cli bypasses gate 4 when cap tripped, (2) pattern-adjacent deflects with reason=spendcap, (3) per-IP cost cap STILL trips for eval-cli (T-ro4-04 last-line backstop), (4) onFinish wiring asserts incrementSpend receives email opts AND incrementIpCost still called (T-ro4-07 regression-trap). Uses captured-onFinish pattern for Test 4. |
| `tests/api/chat-email-allowlist.test.ts` | +9 / -19 | 1-line mock addition (`isEmailSpendCapAllowlisted: () => false`) + deliberate Test 4 deletion (premise inverted by D-A-01). Net: 4 tests → 3 tests. Replacement-comment marker at deletion site. |
| `tests/api/chat-six-gate-order.test.ts` | +5 | 1-line mock addition so route module load resolves; happy-path uses r@x.com so gate 4 still records `over_cap_check` (canonical order preserved 5/5) |
| `tests/api/chat-tools.test.ts` | +6 | Rule 3 deviation — pre-existing test file's `@/lib/redis` mock did not export `isEmailSpendCapAllowlisted`; added 1-line entry; 13/13 W4 heartbeat-before-persistence + tool-wiring tests stay green |
| `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` | +15 / -1 | Frontmatter `resolved_by` upgraded from scalar to list (260512-r4s + 260512-ro4); new "Resolution Notes" section summarizes both halves + revises the original Acceptance Criteria bullet about SAFE-04 still applying (superseded by 260512-ro4) |

**Total:** +513 insertions / -37 deletions across 8 files.

## Commits

| # | Hash | Subject | Files |
|---|------|---------|-------|
| 1 | `5c19fa1` | feat(quick-260512-ro4): SEED-001 spend-cap half — unify allowlist + add isEmailSpendCapAllowlisted + incrementSpend email-gated skip | src/lib/redis.ts, tests/lib/redis.test.ts |
| 2 | `423c984` | feat(quick-260512-ro4): SEED-001 spend-cap half — gate-4 short-circuit in /api/chat + onFinish email threading | src/app/api/chat/route.ts, tests/api/chat-spendcap-allowlist.test.ts (new), tests/api/chat-email-allowlist.test.ts, tests/api/chat-six-gate-order.test.ts, tests/api/chat-tools.test.ts |
| 3 | `3fd4d89` | docs(quick-260512-ro4): mark SEED-001 fully resolved — both halves landed | .planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md |

## Verification Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Full unit + integration tests | `npm test` | 63 files / 645 tests pass (no regression vs pre-task baseline; net +16 new tests: +13 unit + 4 new integration - 1 deliberately-deleted) |
| Strict TS | `npx tsc --noEmit` | exit 0 |
| Production build | `npm run build` | exit 0 (Next.js 16 build green; Plan 05-10 lesson — strict tsc + build catches what local vitest misses) |
| Six-gate order test | `npx vitest run tests/api/chat-six-gate-order.test.ts` | 5/5 byte-identical (gate 4 still fires 4th in canonical sequence) |
| Route.ts byte-shape verification | `git grep 'isEmailSpendCapAllowlisted(session.email)' src/app/api/chat/route.ts` | 1 hit at line 197 (gate 4 short-circuit present) |
| Route.ts onFinish wiring | `git grep 'incrementSpend(costCents, { email' src/app/api/chat/route.ts` | 1 hit at line 392 (email threaded through) |
| Seed doc verifier | `node -e "...includes('260512-ro4') && includes('Resolution Notes') && includes('EVAL_CLI_ALLOWLIST')..."` | exit 0 — `seed-doc ok` |

## Threat Model Mitigations Re-Verified Post-Implementation

| Threat ID | Category | Disposition | Verified By |
|-----------|----------|-------------|-------------|
| T-ro4-01 | Spoofing eval-cli@ at spendcap layer | mitigate | `tests/api/chat-spendcap-allowlist.test.ts` Test 3 — per-IP cost cap (SAFE-08) STILL trips for eval-cli@. Per-IP rate limits (ip10m, ipday) also still apply (`tests/lib/redis.test.ts` `checkRateLimits` happy path + chat-email-allowlist Test 3 from rate-limit-half). |
| T-ro4-02 | Pattern-bypass (case-variant, subdomain-trick) | mitigate | `tests/lib/redis.test.ts` `isEmailSpendCapAllowlisted` 6-case suite + `tests/api/chat-spendcap-allowlist.test.ts` Test 2 (eval-cli-test@ STILL deflects with reason=spendcap). |
| T-ro4-03 | Drift between rate-limit + spend-cap helpers | mitigate | `tests/lib/redis.test.ts` "unified EVAL_CLI_ALLOWLIST drift detection (D-A-02)" describe block — iterates the Set and asserts BOTH helpers return identical results for every member AND for pattern-adjacent emails. |
| T-ro4-04 | DoS via distributed-IP attack on allowlisted email | accept | SAFE-08 operates on ipKey, not email. Verified at integration layer by `tests/api/chat-spendcap-allowlist.test.ts` Test 3. Cost-trade explicitly accepted in CONTEXT.md D-A-01 rationale: 150¢/day × N IPs is bounded for this project's audience. |
| T-ro4-05 | Operational log leak of allowlisted email | accept | No new log statements introduced. `incrementSpend` early-return for allowlisted email does not log. Same disposition as T-r4s-05 in the rate-limit half. |
| T-ro4-06 | Audit ambiguity (real vs eval traffic in spend) | mitigate | Pre-fix: real + eval contributed to same hourly buckets. Post-fix: eval-cli writes nothing to the global counter (D-A-01); audit cleanly attributes 100% of `resume-agent:spend:<hour>` to non-eval traffic. Eval cost remains observable via Anthropic console + per-IP cost (SAFE-08 increment still fires for eval-cli) + structured `chat` event logs. |
| T-ro4-07 | Future executor disables SAFE-08 as redundant | mitigate | Load-bearing comment at incrementIpCost call site in route.ts explicitly documents SAFE-08 is the new last-line cost backstop. `EVAL_CLI_ALLOWLIST` header comment in redis.ts mirrors. `incrementSpend` JSDoc mirrors. Test 4 in chat-spendcap-allowlist asserts `incrementIpCost` IS still called for eval-cli (regression-trap). Three independent surfaces document the same load-bearing intent. |

## Deviations from Plan

### [Rule 3 - Auto-fix blocking issue] tests/api/chat-tools.test.ts mock surface update

**Found during:** Task 2 (full-suite `npm test` after route.ts edits)

**Issue:** `tests/api/chat-tools.test.ts` mocks `@/lib/redis` but did not export `isEmailSpendCapAllowlisted`. After adding the import to `src/app/api/chat/route.ts`, the 5 tests in this file failed at module load with `[vitest] No "isEmailSpendCapAllowlisted" export is defined on the "@/lib/redis" mock`. The plan anticipated this for chat-six-gate-order.test.ts and chat-email-allowlist.test.ts (Edits 3 + 4) but did not enumerate chat-tools.test.ts.

**Fix:** Added `isEmailSpendCapAllowlisted: () => false` to the `@/lib/redis` mock factory at line 62 (parallel to the same fix in the other two test files). Test wiring stays semantically-identical to pre-task behavior (happy-path session.email is r@x.com; not allowlisted; gate 4 invokes isOverCap exactly as before).

**Files modified:** `tests/api/chat-tools.test.ts` (+6 / -0)

**Commit:** `423c984` (Task 2 — bundled with the other test mock additions in the same commit)

**Justification for Rule 3 disposition:** Blocking issue directly caused by the current task's changes (route.ts import surface expansion). Out-of-scope per `tests\api\chat-bl17-session-error.test.ts` was NOT modified because its 4 tests all short-circuit at gate 2 (session_lookup_failed) and pass without the mock — Rule 3 scope-boundary applied.

### [Rule 2 - Critical functionality] Load-bearing comment + Test 4 in chat-spendcap-allowlist anchoring T-ro4-07

**Found during:** Planning re-read after Task 1 commit.

**Issue:** The plan's Task 2 action specifies passing `session.email` to `incrementSpend` and NOT gating `incrementIpCost`, but does not specify a load-bearing comment at the `incrementIpCost` site (T-ro4-07 mitigation surface). Without an inline comment, a future executor reading the diff and noticing "we gate incrementSpend by email but not incrementIpCost" might "correct the inconsistency" and break SAFE-08.

**Fix:** Added an 8-line LOAD-BEARING comment block immediately above the `incrementIpCost` call in onFinish documenting that the inconsistency is INTENTIONAL — SAFE-08 is the new last-line backstop and must NOT be gated. Also added Test 4 in chat-spendcap-allowlist.test.ts asserting `incrementIpCost` IS still called for eval-cli@ traffic. Three independent surfaces (route.ts comment, redis.ts comment, test) document the same intent.

**Files modified:** `src/app/api/chat/route.ts`, `tests/api/chat-spendcap-allowlist.test.ts`

**Commit:** `423c984` (Task 2)

**Justification for Rule 2 disposition:** Security-critical T-ro4-07 mitigation. The plan's `<threat_model>` register specifies the mitigation; this work makes it executable.

## Self-Check

- [x] `src/lib/redis.ts` exports `EVAL_CLI_ALLOWLIST` (renamed) — verified via Grep
- [x] `src/lib/redis.ts` exports `isEmailSpendCapAllowlisted` — verified via Grep
- [x] `src/lib/redis.ts` `incrementSpend` signature is `(cents: number, opts?: { email?: string }) => Promise<void>` — verified via Grep + 5 unit tests pass
- [x] `src/app/api/chat/route.ts` gate 4 reads `if (!isEmailSpendCapAllowlisted(session.email) && (await isOverCap())) {` — verified via Grep at line 197
- [x] `src/app/api/chat/route.ts` onFinish calls `incrementSpend(costCents, { email: session.email })` — verified via Grep at line 392
- [x] `tests/api/chat-spendcap-allowlist.test.ts` exists with 4 SEED-001-prefixed tests — file present, all 4 pass
- [x] `tests/api/chat-email-allowlist.test.ts` Test 4 deleted with comment marker — verified
- [x] `tests/api/chat-six-gate-order.test.ts` 5/5 tests pass byte-identical
- [x] All 3 task commits exist: 5c19fa1, 423c984, 3fd4d89 — verified via `git log --oneline -3`
- [x] `npm test`: 645/645 pass — verified
- [x] `npx tsc --noEmit`: exit 0 — verified
- [x] `npm run build`: exit 0 — verified
- [x] `.planning/seeds/SEED-001-...md` `resolved_by` lists both halves + Resolution Notes section appended — verified via node probe (exit 0, `seed-doc ok`)

## Self-Check: PASSED

## Threat Flags

None. No new network endpoints, no auth-path changes, no schema modifications, no new trust boundaries. The change TIGHTENS the global spend counter to exclude one canonical email; per-IP cost cap (SAFE-08) remains as the security-critical last-line backstop. The unified-Set drift-detection test (Test H) is the new regression-trap against future executors who might add case-insensitive normalization or env-var-driven extension to one helper but not the other.

## Known Stubs

None. The change does not introduce any placeholder, hardcoded-empty, or "coming soon" surfaces. The plan's "post-merge follow-up" — confirming Phase 6 verification spend doesn't re-trip the 24h cap — is observation (not implementation) and is intentionally NOT a gate on this quick task per the plan's `<output>` block.

## Post-Merge Follow-Up

- **Phase 6 unblocker:** Phase 6 (KB enrichment) verification spend can now run without re-tripping the 24h spend cap. Confirm via observation (Upstash console / `npm run admin:redis-keys`) on the next Phase 6 verification pass; NOT a gate on this quick task closing.
- **CI cat1 reliability:** SEED-001 Acceptance Criteria #1 (≥3 consecutive successful cat1=15/15 runs against prod without manual rate-limit reset between them) was the long-term success metric. With both halves landed, expected behavior is now reliably achievable. Observation, not implementation.
- **Documentation breadcrumb:** A future v1.1 milestone planner reading `.planning/seeds/SEED-001-...md` will find both halves landed and the original "SAFE-04 still applies" acceptance bullet explicitly marked SUPERSEDED-but-historically-preserved.
