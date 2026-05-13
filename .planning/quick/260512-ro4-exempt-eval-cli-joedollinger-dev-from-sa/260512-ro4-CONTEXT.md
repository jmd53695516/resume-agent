# Quick Task 260512-ro4: SEED-001 spend-cap half - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Task Boundary

Exempt `eval-cli@joedollinger.dev` from the SAFE-04 global 24h rolling spend cap (`isOverCap()` check at route.ts gate 4, the `resume-agent:spend:<hour>` Redis hourly buckets, 300¢/24h threshold).

This is the SEED-001 spend-cap half. The rate-limit half landed earlier today (commits `e3dbfae` feat, `71a78fb` test, `2c3b4de` docs, `f0378ca` docs).

Out of scope:
- Per-IP daily cost cap (SAFE-08, 150¢/day per IP at `resume-agent:ipcost:YYYY-MM-DD:<ip>`) — still applies to eval-cli traffic as the new last-line backstop
- Per-IP rate limits (ip10m, ipday) — still apply
- Per-email rate limit — already exempted by the rate-limit half via `isEmailRatelimitAllowlisted`
- The /api/chat six-gate order (must stay byte-identical to satisfy `chat-six-gate-order.test.ts`)

</domain>

<decisions>
## Implementation Decisions

### D-A-01: Exemption shape — skip check + skip increment (full bypass)

Option A locked. `isOverCap()` returns false for eval-cli@ AND `incrementSpend()` skips increment for eval-cli@. Eval-cli traffic is fully invisible to the global 300¢/24h counter.

Rationale: today's incident proved that letting eval traffic increment the global counter creates a silent-lockout failure mode where regular users get deflected even though eval-cli would still get through. Full invisibility prevents recurrence. Eval cost observability is preserved via the Anthropic console + the per-IP cost counter (SAFE-08) which still applies to eval-cli IPs.

### D-A-02: Allowlist unification — single EVAL_CLI_ALLOWLIST Set

Rename `EVAL_CLI_RATELIMIT_ALLOWLIST` → `EVAL_CLI_ALLOWLIST` in `src/lib/redis.ts`. Both rate-limit (`isEmailRatelimitAllowlisted`) and spend-cap checks consult the same Set. Add a parallel helper `isEmailSpendCapAllowlisted` (or rename existing → `isEmailAllowlisted` if cleaner — planner's call). Single source of truth, single drift-detection test against `agent-client.ts` literal.

The rename touches already-shipped code from commit `e3dbfae` but stays tightly scoped (constant name + helper name + 1 drift-detection test reference). Imports update: `src/app/api/chat/route.ts` does NOT currently import either helper (per the rate-limit-half plan's design decision #1 to keep route.ts byte-identical for that gate); for the spend-cap half it WILL need to import the spend-cap helper.

### Claude's Discretion

- **Compensating control:** Not selected for discussion. The per-IP cost cap (SAFE-08, 150¢/day per IP at `resume-agent:ipcost:YYYY-MM-DD:<ipKey>`) is accepted as the new last-line cost backstop. An attacker spoofing `eval-cli@joedollinger.dev` can burn at most 150¢/day per source IP, gated further by per-IP rate limits (ip10m=20/10min, ipday=60/day). No per-call ceiling, no SAFE-08 threshold change for non-eval IPs.
- **Where the email check lives in route.ts gate 4:** Planner's call. Likely inline `if (!isEmailSpendCapAllowlisted(email) && await isOverCap())` since `email` is available from body parse at this point. Route.ts gate 4 WILL gain new lines (not byte-identical), but the six-gate ORDER stays exact and the `chat-six-gate-order.test.ts` contract is preserved.
- **incrementSpend skip path:** Planner's call where the email check fires. Likely in the route.ts onFinish callback (or wherever the increment is currently called), gated by the same `isEmailSpendCapAllowlisted(email)` helper.

</decisions>

<specifics>
## Specific Ideas

Existing code references (post rate-limit-half merge at HEAD `f0378ca`):
- `src/lib/redis.ts:75` — `EVAL_CLI_RATELIMIT_ALLOWLIST` Set declaration (to be renamed `EVAL_CLI_ALLOWLIST`)
- `src/lib/redis.ts:81` — `isEmailRatelimitAllowlisted` helper (sibling helper `isEmailSpendCapAllowlisted` to add)
- `src/lib/redis.ts:135` — `isOverCap()` (no signature change; just NOT called for eval-cli emails)
- `src/lib/redis.ts:139` — `incrementSpend(cents)` (likely gated at the call site, not inside this function — planner decides)
- `src/app/api/chat/route.ts:187` — gate 4 `if (await isOverCap())` block (gains the email-allowlist short-circuit)
- `src/lib/eval/agent-client.ts` — `eval-cli@joedollinger.dev` literal (drift-detection target)

Test files to mirror the rate-limit-half pattern:
- `tests/lib/redis.test.ts` — extend with `isEmailSpendCapAllowlisted` cases + drift-detection between the unified `EVAL_CLI_ALLOWLIST` and `agent-client.ts`
- `tests/api/chat-email-allowlist.test.ts` (existing from `71a78fb`) OR a new `tests/api/chat-spendcap-allowlist.test.ts` — assert (1) eval-cli@ bypasses spend cap, (2) pattern-adjacent emails STILL deflect at spendcap (`EVAL-CLI@`, `eval-cli-test@`, `eval-cli@joedollinger.dev.attacker.com`), (3) eval-cli@ STILL deflects when per-IP cost cap trips (SAFE-08, the new last backstop — security-critical), (4) `incrementSpend` not called for eval-cli@ emails

Documentation to update:
- `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` — already `status: resolved`; consider extending body to note spend-cap half landed too, or close as "partial→full"
- STATE.md "Quick Tasks Completed" table — new row for 260512-ro4

</specifics>

<canonical_refs>
## Canonical References

- `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` — original seed (status: resolved as of 260512-r4s, but only covers rate-limit half)
- `.planning/quick/260512-r4s-exempt-eval-cli-email-from-per-email-rat/260512-r4s-PLAN.md` — sibling plan from rate-limit half (architectural precedent for allowlist design, STRIDE threat model T-r4s-01..07 pattern)
- HEAD STATE.md frontmatter at commit `f573437` (now reverted in working tree) — EOD 2026-05-12 incident note explicitly requested this exemption as "cleanest fix" for the silent-lockout failure mode
- `tests/api/chat-six-gate-order.test.ts` — order contract; gate 4 must still fire 4th in the gate sequence

</canonical_refs>
