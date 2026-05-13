---
phase: quick
plan: 260512-tku
subsystem: safety-gates
tags: [kill-switch, feature-flag, rate-limit, spend-cap, SEED-002]
requires:
  - SEED-001 (resolved 2026-05-12 via 260512-r4s + 260512-ro4 + 260512-sne — helpers byte-identical)
provides:
  - SAFETY_GATES_ENABLED env-var feature flag (default OFF)
  - Conditional gate-4 (spend-cap) execution behind the flag
  - Conditional gate-5 (rate-limits) execution behind the flag
  - SEED-002 dormant seed tracking re-enable criteria
affects:
  - src/lib/env.ts (added optional SAFETY_GATES_ENABLED field)
  - src/app/api/chat/route.ts (two if-block wrappers + call-time flag read)
  - tests/api/chat-six-gate-order.test.ts (flag-aware tests + regression traps)
  - tests/api/chat-spendcap-allowlist.test.ts (describe.skip)
  - tests/api/chat-iprl-allowlist.test.ts (describe.skip)
  - tests/api/chat-email-allowlist.test.ts (describe.skip)
tech-stack:
  added: []
  patterns:
    - call-time process.env read inside POST handler (Phase 02-04 Turnstile precedent — STATE.md line 108)
    - strict-equality === 'true' env check (NOT truthy; eliminates '1'/'yes' footgun)
    - describe.skip with TODO(SEED-002) marker for trivially reversible test gating
    - feature-flag wrappers preserve helper imports + onFinish counter writes
key-files:
  created:
    - .planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md
    - .planning/quick/260512-tku-disable-rate-limit-spend-cap-gates-globa/260512-tku-SUMMARY.md
  modified:
    - src/lib/env.ts
    - src/app/api/chat/route.ts
    - tests/api/chat-six-gate-order.test.ts
    - tests/api/chat-spendcap-allowlist.test.ts
    - tests/api/chat-iprl-allowlist.test.ts
    - tests/api/chat-email-allowlist.test.ts
decisions:
  - call-time process.env read (not module scope) so vitest can mutate flag per-test without resetModules ceremony
  - strict equality === 'true' (NOT Boolean(env.X)) — empty/'false'/'1'/'yes' all evaluate to OFF; eliminates dev footgun
  - ipKey declaration stays OUTSIDE if (SAFETY_GATES_ENABLED) so onFinish.incrementIpCost(ipKey, ...) still resolves; counter writes preserved for observability
  - describe.skip with TODO comments (NOT delete test bodies) — re-enable is a one-line edit per file, no re-implementation work
  - keep SEED-001 helper imports in route.ts even though unused when flag OFF — TypeScript doesn't flag conditionally-used imports as unused, and keeping them means re-enable requires zero import edits
  - global disable (gates 4 + 5 OFF for ALL emails, not just allowlisted) over piecemeal exemption — cleanest kill-switch pattern; Anthropic org-cap of $100/mo bounds exposure
metrics:
  duration: 28min
  tasks_completed: 5
  files_changed: 7
  tests_added: 3 (regression traps + flag-on legacy variants)
  tests_skipped: 12 (3 SEED-001 contract files, single-line revert per file)
  completed_date: 2026-05-13
---

# Quick Task 260512-tku: Disable rate-limit + spend-cap gates globally in /api/chat Summary

Kill-switch wrapping gates 4 (spend-cap, SAFE-04) and 5 (rate-limits, SAFE-05..08) in /api/chat behind a single `SAFETY_GATES_ENABLED` env-var feature flag (default OFF). Re-enable is a Vercel env-var flip with zero code change. SEED-001 helpers remain byte-identical in src/lib/redis.ts; counter increments (incrementSpend, incrementIpCost) still fire in onFinish for observability. SEED-002 planted with trigger conditions, 6-step rollback path, SECURITY-RISK note about the $100/mo Anthropic org-cap exposure window.

## Why

PR #4 CI eval gate has been failing for 4+ hours despite three SEED-001 halves (260512-r4s rate-limit + 260512-ro4 spend-cap + 260512-sne ip-rate-limit) all shipped. Structural root cause: `incrementIpCost` accumulates classifier + tools + sub-call costs (~150¢ server-side per single eval run), tripping SAFE-08 (per-IP cost cap, 150¢/day per IP) on one CI eval run from the GH Actions runner IP. Each prior SEED-001 fix revealed a deeper gate.

Joe's decision (2026-05-13 01:15 UTC): rather than ship a fourth SEED-001 half exempting SAFE-08 (which would leave eval-cli traffic completely uncapped at the cost layer and trivially exploitable by email-spoofing), DISABLE gates 4 + 5 globally and TEMPORARILY rely on the Anthropic org-level $100/mo cap as the sole cost backstop. Trade: short-term dev velocity (eval CLI runs reliably) for an exposure window bounded by the $100 org cap. SEED-002 captures the re-enable trigger conditions.

## What Changed

### `src/lib/env.ts` (1 line added)

Optional zod field added at the bottom of EnvSchema:

```typescript
SAFETY_GATES_ENABLED: z.string().optional(),
```

No required-fields broken; existing prod/preview/dev/CI environments continue to load without setting the variable.

### `src/app/api/chat/route.ts` (gates 4 + 5 wrapped)

Three additions:

1. **Header comment block** — appended a 5-line context note to the canonical six-gate documentation comment explaining that gates 4 + 5 are now flag-gated.

2. **Call-time flag read** — added immediately after `const started = Date.now();` inside the POST handler:
   ```typescript
   const SAFETY_GATES_ENABLED = process.env.SAFETY_GATES_ENABLED === 'true';
   ```
   Strict equality (NOT `Boolean(...)`) eliminates the '1'/'yes' footgun. Call-time read (NOT module scope) mirrors Phase 02-04 Turnstile precedent so vitest can mutate the flag per-test without resetModules ceremony.

3. **Two if-block wrappers** — gate 4 (spend-cap) and gate 5 (rate-limits) each wrapped in `if (SAFETY_GATES_ENABLED) { ... }`. Body content byte-identical to the pre-260512-tku state. `ipKey` declaration stays OUTSIDE the gate-5 conditional because `onFinish.incrementIpCost(ipKey, ...)` still needs it.

**NOT modified:** gates 1 (body parse), 2 (session lookup), 3 (turn cap), 6 (classifier); onFinish callback; imports list; `DEFLECTIONS.spendcap` / `DEFLECTIONS.ratelimit` constants. SEED-001 helper imports (isEmailSpendCapAllowlisted, etc.) kept in place — used inside the `if` blocks, so TypeScript does not flag them as unused; re-enable is mechanical.

### `src/lib/redis.ts` (BYTE-IDENTICAL — zero changes)

Verified via `git diff HEAD~4 src/lib/redis.ts` returning empty. All SEED-001 helpers preserved:
- `EVAL_CLI_ALLOWLIST`
- `isEmailRatelimitAllowlisted`
- `isEmailSpendCapAllowlisted`
- `isEmailIpRatelimitAllowlisted`
- `checkRateLimits`
- `isOverCap`
- `incrementSpend`
- `incrementIpCost`

When SEED-002 re-enables, the protection layer comes back unchanged.

### `tests/api/chat-six-gate-order.test.ts` (5 → 8 tests)

Replaced single happy-path canonical-order test with flag-aware coverage:

1. **Default-OFF happy path** — recorder now expects only `[body_parse, session_lookup, turnRows_check, classifier]`. Explicit assertions that `isOverCap` and `checkRateLimits` were NOT called.

2. **Flag-ON happy path (NEW)** — `withGatesEnabled()` helper sets `process.env.SAFETY_GATES_ENABLED='true'`, asserts full canonical six-gate order.

3. **Session/turn-cap short-circuits** — unchanged (gates 1/2/3 not flagged).

4. **Flag-ON gate-4 deflection (replaces old)** — `withGatesEnabled` wraps the test body; asserts legacy six-gate behavior.

5. **Flag-ON gate-5 deflection (replaces old)** — same pattern.

6-7. **Regression traps (NEW)** — explicit tests asserting that with flag OFF:
   - `isOverCap=true` does NOT trigger spendcap deflection (gate 4 fully skipped)
   - `checkRateLimits ok:false` does NOT trigger ratelimit deflection (gate 5 fully skipped)
   - Route reaches classifier in both cases.

If a future executor accidentally restores either gate unconditionally, these traps fail noisily.

**Cleanup discipline:** `withGatesEnabled` helper restores the prior env var state in a `finally` block; `afterEach` adds a paranoid `delete process.env.SAFETY_GATES_ENABLED` so flag state never leaks even if a test throws before finally runs.

### `tests/api/chat-spendcap-allowlist.test.ts`, `chat-iprl-allowlist.test.ts`, `chat-email-allowlist.test.ts` (describe → describe.skip)

Each file received exactly two edits:
1. A 7-line `TODO(SEED-002)` comment block immediately above the describe line, pointing to `.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md` and the 260512-tku quick-task directory.
2. `describe(...)` → `describe.skip(...)`.

Test bodies, mocks, vi.mock factories, imports — all unchanged. Vitest reports 12 tests skipped across the 3 files (4+5+3). Re-enable is a single-line edit per file: remove the `.skip`.

### `.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md` (new file, 145 lines)

Frontmatter follows SEED-001 convention:
```yaml
id: SEED-002
status: planted
planted: 2026-05-13
planted_during: v1.0 / Phase 6 prep (post-Plan-05-12 LAUNCH; pre-Phase-6 execution)
planted_in_quick_task: 260512-tku-disable-rate-limit-spend-cap-gates-globa
trigger_when: Phase 6 verification working end-to-end OR before broad distribution (QR paper print / LinkedIn push) — whichever comes first
scope: Small
```

Sections:
- **Why This Matters** — captures the 2026-05-13 01:15 UTC decision context and the structural SAFE-08 problem
- **Current State** — enumerates what's preserved (helpers, counters, gates 1/2/3/6) and what's flagged off (gates 4 + 5)
- **SECURITY RISK While Gates Are OFF** — prominent callout: $100/mo Anthropic org-cap exposure window, ~1k-3k messages would drain it, mitigations during the OFF window (heartbeat alarms, daily digest, Anthropic email alerts at $50/$75/$90)
- **When to Surface (Trigger Conditions)** — 4 triggers: Phase 6 verification working / broad distribution prep / spend pattern shift / milestone close-out
- **Rollback Steps** — 6 numbered steps: set Vercel env var → trigger fresh deploy → un-skip 3 tests → verify locally → verify prod → optional cleanup. Estimated 10-20 minutes total.
- **Acceptance Criteria** — 7 concrete checks for marking the seed resolved
- **Out of Scope** — new rate-limit policy / SAFE-08 exemption / Turnstile / Anthropic org-cap adjustment (each separate concern)
- **Breadcrumbs** — links to 260512-tku PLAN, SEED-001, route.ts, env.ts, redis.ts, all 4 affected test files, STATE.md, and the spend-cap incident project memory
- **Notes from Planting Session** — Joe rejected fourth SEED-001 half; chose global disable over piecemeal exemption; feature-flag pattern from Phase 02-04 Turnstile precedent

## Per-task Commits

| Task | Commit  | Description                                                             |
| ---- | ------- | ----------------------------------------------------------------------- |
| 1    | 5aacbb5 | feat(quick/260512-tku): wire SAFETY_GATES_ENABLED kill-switch into gates 4 + 5 |
| 2    | 08a5c99 | test(quick/260512-tku): flag-aware six-gate order coverage + regression traps |
| 3    | 8ab480f | test(quick/260512-tku): describe.skip the 3 SEED-001 contract test files |
| 4    | 03ed243 | docs(seeds): plant SEED-002 — re-enable rate-limit + spend-cap gates |

Task 5 (verification gates) — no commit (verification-only).

## Verification Results

| Gate                | Result   | Details                                                       |
| ------------------- | -------- | ------------------------------------------------------------- |
| `npm test`          | PASS     | 654 passed, 12 skipped (3 SEED-001 contract files), 0 fail   |
| `npx tsc --noEmit`  | PASS     | exit 0                                                        |
| `npm run build`     | PASS     | exit 0; all 23 routes compile clean                          |

### Goal-backward checks

| Truth                                                              | Proof                                                                                                                                                |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default OFF — gates 4 + 5 skipped at runtime                       | chat-six-gate-order.test.ts "happy-path with SAFETY_GATES_ENABLED unset" recorder shows only `[body_parse, session_lookup, turnRows_check, classifier]` |
| Setting flag='true' re-activates both gates                        | chat-six-gate-order.test.ts "happy-path with SAFETY_GATES_ENABLED=true" recorder shows full canonical six-gate order                                  |
| Counters still increment for observability                         | onFinish block byte-identical (zero changes inside the callback); incrementSpend/incrementIpCost still wired                                          |
| SEED-001 helpers byte-identical                                    | `git diff HEAD~4 src/lib/redis.ts` returns empty                                                                                                      |
| Test files .skip'd cleanly — un-skip is one-line edit              | Each file has exactly one `describe.skip` + a TODO(SEED-002) comment; test bodies/mocks/imports unchanged                                            |
| SEED-002 exists with all required sections                         | Task 4 automated grep check passes 6/6 (SEED-002, status: planted, SAFETY_GATES_ENABLED, SECURITY RISK, Rollback, 260512-tku)                       |

### Manual eyeball checks (post-Task-5)

```
$ git diff HEAD~4 src/lib/redis.ts                # (empty — byte-identical)
$ grep -c "if (SAFETY_GATES_ENABLED)" src/app/api/chat/route.ts
2
$ grep -c "describe.skip" tests/api/chat-{spendcap,iprl,email}-allowlist.test.ts
tests/api/chat-spendcap-allowlist.test.ts:1
tests/api/chat-iprl-allowlist.test.ts:1
tests/api/chat-email-allowlist.test.ts:1
$ grep -c "TODO(SEED-002)" tests/api/chat-{spendcap,iprl,email}-allowlist.test.ts
tests/api/chat-spendcap-allowlist.test.ts:1
tests/api/chat-iprl-allowlist.test.ts:1
tests/api/chat-email-allowlist.test.ts:1
$ ls .planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md
.planning/seeds/SEED-002-re-enable-rate-limits-and-spend-cap.md
$ grep -l "SAFETY_GATES_ENABLED" src/lib/env.ts
src/lib/env.ts
```

All checks pass.

## Deviations from Plan

None — plan executed exactly as written. The plan was unusually thorough about edge cases (ipKey scope, unused-import warning preemption, env-var leak prevention) so all the usual auto-fix triggers were anticipated.

## Threat Surface Scan

No new security surface beyond what's documented in the plan's `<threat_model>` (T-tku-01..07). The kill-switch ACCEPTS T-tku-02 (cost-DoS during OFF window — bounded by $100/mo Anthropic org cap) and MITIGATES T-tku-04 (regression-trap tests defend against future executors accidentally restoring either gate unconditionally) and T-tku-05 (SEED-002 + TODO comments + STATE.md entry provide full traceability for re-enable).

Operational responsibility: re-enable BEFORE broad distribution (QR paper print / LinkedIn push) per SEED-002 trigger condition #2.

## Operational Readiness

| Action                              | Cost                                                                 |
| ----------------------------------- | -------------------------------------------------------------------- |
| To DEACTIVATE gates (current state) | No action — default OFF                                              |
| To REACTIVATE gates                 | Set `SAFETY_GATES_ENABLED=true` in Vercel preview + prod envs        |
| Total re-enable time                | <30 sec (env var) + ~2 min (Vercel deploy) + ~5 min (un-skip tests)  |
| Code review burden for re-enable    | Zero (env-var flip + 3 single-line test edits, no logic changes)     |

## Follow-ups

None blocking. SEED-002 captures the re-enable trigger conditions — that work will be its own quick task or rolled into a Phase 6 cleanup pass.

## Self-Check: PASSED

- [x] All 7 files modified exist and contain expected content
- [x] All 4 task commits present in git history (5aacbb5, 08a5c99, 8ab480f, 03ed243)
- [x] redis.ts byte-identical (zero diff vs HEAD~4)
- [x] Exactly 2 `if (SAFETY_GATES_ENABLED)` blocks in route.ts
- [x] Each of 3 SEED-001 test files has 1 `describe.skip` + 1 `TODO(SEED-002)` comment
- [x] SEED-002 file exists with 6/6 required sections
- [x] npm test: 654 passed, 12 skipped, 0 failures
- [x] npx tsc --noEmit: exit 0
- [x] npm run build: exit 0
