# Quick Task 260512-sne: SEED-001 ip-rate-limit half - Context

**Gathered:** 2026-05-13 (00:38 UTC; recorded as continuation of 2026-05-12 PM session)
**Status:** Ready for planning

<domain>
## Task Boundary

Exempt `eval-cli@joedollinger.dev` from the per-IP rate limiters `ipLimiter10m` (20 msg/10min) and `ipLimiterDay` (60 msg/day), both consumed inside `checkRateLimits` at `/api/chat` route gate 5. This is the SEED-001 ip-rate-limit half (third in series — rate-limit half `e3dbfae`, spend-cap half `5c19fa1`+`423c984` already landed; SEED-001 frontmatter already says `status: resolved`).

**Root cause requiring this task:** PR #4's CI eval run (2026-05-13T00:29:20Z, runId `HYxSxtSM_8f782_NdJ7kr`) deflected cat1-fab-013/014/015 with `deflectionReason: "ratelimit"`. The eval CLI does 20 requests (15 cat1 + 5 cat4-judge) from a single GitHub Actions runner IP in ~2 minutes. `ipLimiter10m` is exactly 20/10min — trips at request 21. SEED-001's rate-limit half (`e3dbfae`) only exempted the per-email window, leaving per-IP limits intact by design (seed line: "Keep per-IP and spend-cap protection intact"). That design assumed multi-IP eval traffic and didn't anticipate single-IP CI bursts.

Out of scope:
- Session limiter (`sessionLimiter`, 200 msg/7d) — generous enough to not bottleneck; D-A-01 keeps it as a safety net
- Per-IP cost cap (SAFE-08, 150¢/day/IP at `resume-agent:ipcost:YYYY-MM-DD:<ipKey>`) — the new ONLY cost-based last-line backstop for eval-cli traffic per D-A-03
- /api/chat six-gate ORDER (must stay intact; `chat-six-gate-order.test.ts` contract)

</domain>

<decisions>
## Implementation Decisions

### D-A-01: Limiter scope — exempt ip10m + ipday only

Bypass `ipLimiter10m.limit(ipKey)` and `ipLimiterDay.limit(ipKey)` for allowlisted emails inside `checkRateLimits`. Same `Promise.resolve({ success: true } as const)` synthetic pattern used for the email-limiter exemption in the rate-limit half. Session limiter still fires for eval-cli traffic — 200/7d is generous enough that it's a free safety net.

Rationale: single CI eval run = 20 reqs → ip10m trips. Multiple runs in same day from same runner IP can also approach ipday=60. Session is multi-day so unlikely to bottleneck legitimate eval volume.

### D-A-02: Three sibling helpers — add `isEmailIpRatelimitAllowlisted`

Keep the three-helper pattern. Add `isEmailIpRatelimitAllowlisted(email: string): boolean` as the third sibling. All three consult the unified `EVAL_CLI_ALLOWLIST` Set, but the named-per-gate API future-proofs the design — if Joe ever wants per-gate flexibility, the helper body changes without touching call sites.

Existing helpers (already shipped):
- `isEmailRatelimitAllowlisted` (from `e3dbfae`, consumed by emailLimiterDay skip)
- `isEmailSpendCapAllowlisted` (from `5c19fa1`, consumed by isOverCap short-circuit + incrementSpend skip)

Add: `isEmailIpRatelimitAllowlisted` (consumed by ipLimiter10m + ipLimiterDay skip in checkRateLimits).

### D-A-03: SAFE-08 accepted as only cost backstop

After this lands, the only cost-based last-line backstop for eval-cli email spoofing is SAFE-08 (per-IP cost cap, 150¢/day/IP at `resume-agent:ipcost:YYYY-MM-DD:<ipKey>`).

Joe explicitly accepted the tradeoff. Numbers:
- $1.50/day max per IP (150¢ × 1¢/cent ÷ 100¢/$)
- Sonnet 4.6 at $3/$15 per MTok → 150¢ buys ~30K-100K tokens depending on output ratio
- An attacker who spoofs the eval-cli email AND learns it can burn 150¢/day per source IP in a tight loop (per-IP rate limits no longer throttle once email is allowlisted)
- Distributed attack would need many IPs to do real damage; per-IP cost cap throttles each IP independently
- Org-level Anthropic spend cap is $100/mo (per project memory), so a sustained attack against this project is bounded by org limits too

No compensating control added (rejected: lower SAFE-08 to 50¢ for eval-cli, add per-call max-cost ceiling, add per-IP throttle on cost). The accepted residual risk is bounded and the alternatives add complexity for marginal gain.

### Claude's Discretion

- **Where the exemption logic lives**: inside `checkRateLimits` in `src/lib/redis.ts`, branching on `isEmailIpRatelimitAllowlisted(email)` to substitute `Promise.resolve({ success: true } as const)` for the ip10m + ipday limiter calls (mirrors the existing `emailExempt` pattern at lines 94..104). The Promise.all shape and precedence ordering (ip10m → ipday → email → session → ipcost) MUST stay identical so the six-gate ORDER contract holds.
- **Test surface**: extend `tests/lib/redis.test.ts` with `isEmailIpRatelimitAllowlisted` cases + new ip10m/ipday bypass assertions. New integration test file `tests/api/chat-iprl-allowlist.test.ts` mirroring the two existing siblings (chat-email-allowlist for rate-limit half; chat-spendcap-allowlist for spend-cap half). Drift-detection test now covers all three helpers consulting the same Set.
- **SEED-001 frontmatter**: extend `resolved_by` array to `[260512-r4s, 260512-ro4, 260512-sne]`. Update Resolution Notes section to cover all three halves.
- **Comment header in redis.ts**: extend to mention ip10m/ipday exemption alongside rate-limit + spend-cap.

</decisions>

<specifics>
## Specific Ideas

Existing code references (post 260512-ro4 merge at HEAD `f9548a8`):
- `src/lib/redis.ts:19-31` — `ipLimiter10m` (20/10min) + `ipLimiterDay` (60/day) Ratelimit constructions
- `src/lib/redis.ts:47-71` — `EVAL_CLI_ALLOWLIST` Set + comment header (update to mention ip10m/ipday)
- `src/lib/redis.ts:77-95` — `isEmailRatelimitAllowlisted` + `isEmailSpendCapAllowlisted` helpers (add `isEmailIpRatelimitAllowlisted` sibling)
- `src/lib/redis.ts:89..108` — `checkRateLimits` function (extend `emailExempt` pattern to ip10m/ipday)
- `src/lib/eval/agent-client.ts` — `eval-cli@joedollinger.dev` literal (drift-detection target)

Test files:
- `tests/lib/redis.test.ts` — extend with isEmailIpRatelimitAllowlisted cases + ip10m/ipday bypass + drift-detection now covering 3 helpers
- `tests/api/chat-iprl-allowlist.test.ts` (NEW) — integration tests asserting:
  1. eval-cli@ bypasses ip10m (cap at 20, eval-cli req 21 still goes through)
  2. eval-cli@ bypasses ipday (cap at 60, eval-cli req 61 still goes through)
  3. Pattern-adjacent emails (EVAL-CLI@, eval-cli-test@, eval-cli@joedollinger.dev.attacker.com) all STILL deflect at ip10m
  4. eval-cli@ STILL deflects when SAFE-08 per-IP cost cap trips (this is the security-critical "last-line backstop preserved" assertion)
  5. session limiter still applies to eval-cli@ (D-A-01 scope boundary)
- `tests/api/chat-email-allowlist.test.ts` (existing) — may need 1-line mock entry for new helper
- `tests/api/chat-spendcap-allowlist.test.ts` (existing from ro4) — may need 1-line mock entry
- `tests/api/chat-six-gate-order.test.ts` (existing) — may need 1-line mock entry; six-gate order MUST still pass
- `tests/api/chat-tools.test.ts` (existing, mocked in ro4) — may need 1-line mock entry

Documentation:
- `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` — extend body with "Resolution Notes" coverage of third half; frontmatter `resolved_by: [260512-r4s, 260512-ro4, 260512-sne]`
- `.planning/STATE.md` "Quick Tasks Completed" table — new row for 260512-sne
- Code comment header in `src/lib/redis.ts` at `EVAL_CLI_ALLOWLIST` declaration — mention ip10m/ipday exemption alongside existing mentions

CI verification:
- After merge of this fix to PR #4 (or new commit on the PR branch), re-trigger eval CI — expect cat1=15/15 + cat4=5/5 PASS without any "ratelimit" deflections. That's the structural validation of the third half.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/seeds/SEED-001-exempt-eval-cli-from-email-ratelimit.md` — original seed (resolved twice; this task adds third resolution)
- `.planning/quick/260512-r4s-exempt-eval-cli-email-from-per-email-rat/260512-r4s-PLAN.md` — first sibling, architectural precedent for allowlist + drift-detection idiom
- `.planning/quick/260512-ro4-exempt-eval-cli-joedollinger-dev-from-sa/260512-ro4-PLAN.md` — second sibling, full-bypass pattern + STRIDE T-ro4-01..07 register
- `.planning/quick/260512-ro4-exempt-eval-cli-joedollinger-dev-from-sa/260512-ro4-CONTEXT.md` — second sibling's locked decisions (D-A-01 full bypass; D-A-02 unified allowlist)
- GitHub Actions run 25770408256 (PR #4, 2026-05-13T00:29:20Z) — eval CLI log showing cat1-fab-013/014/015 deflectionReason="ratelimit" at request 21+ of 20 in ~2min from one IP — this is the evidence that drove the third quick task

</canonical_refs>
