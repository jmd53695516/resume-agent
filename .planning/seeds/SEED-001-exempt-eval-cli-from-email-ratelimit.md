---
id: SEED-001
status: dormant
planted: 2026-05-12
planted_during: v1.0 / Phase 05 (eval-gates-launch) — Plan 05-12 LAUNCH (prod live; friend-test pending)
trigger_when: v1.1 milestone start OR Phase 6 (post-launch eval calibration) planning
scope: Small
---

# SEED-001: Exempt eval-cli email from per-email rate limiter

## Why This Matters

The cat1 = 15/15 prod gate (D-B-01 zero-fabrication launch criterion) is structurally unreliable from CI today. The eval CLI bursts 15 classifier + chat calls in ~5-10 seconds from a single email/IP, which trips the per-email 10-minute sliding-window rate limiter mid-run. Result: cat1 reliably flakes at cases 12-15 with either:

- `deflectionReason: "ratelimit"` (the user rate limiter trips), or
- `deflectionReason: "offtopic"` (the classifier's own Anthropic call rate-limits, hits the WR-01 fail-closed sentinel, and the heartbeat reports degraded)

Both are infrastructure noise, not real fabrication signal. The PR #3 prod-promotion night (2026-05-12) made this concrete:

- 4 consecutive CI eval runs against `1eaf25d` failed identically — first to spend cap, then mid-cat1 to rate limit
- Manual rate-limit + spend-cap resets between runs partially helped but didn't fix the in-run accumulation
- Final outcome: prod was promoted via Vercel checks-failed override (the 4th bypass in three PRs), because the eval gate cannot pass under current rate-limit policy

The launch-checklist baseline run that hit 15/15 (`sWLys5bpVsiHAfwvoln04`) was effectively a fluke of timing: rate-limit windows happened to be cleared just before it ran.

Until this is fixed, Vercel's Deployment Checks gate is theatrically required but functionally unreliable, and every PR ends in a manual-promote dance.

## When to Surface

**Trigger:** v1.1 milestone start, or when a Phase 6 "post-launch eval calibration" phase is being planned.

`/gsd-new-milestone` should present this seed when the new milestone scope includes any of:
- eval reliability / calibration
- CI gate hardening
- Rate-limit policy revisions
- Post-launch operational hygiene

## Scope Estimate

**Small** — single phase task, ~1-2 hours including tests.

Concrete implementation sketch (subject to revalidation at planning time):

1. Add `EVAL_CLI_EMAILS = ['eval-cli@joedollinger.dev']` constant near the rate-limit middleware (or env-var driven for flexibility)
2. In the per-email rate-limit check inside `src/app/api/chat/route.ts`, skip the `emailLimiter.limit(email)` call when `EVAL_CLI_EMAILS.includes(email)`
3. Keep per-IP and spend-cap protection intact — these prevent abuse if a third party learns the eval-cli email
4. Add regression tests: real-user-email still gets rate-limited; eval-cli email bypasses email window but still gets IP + spend cap
5. Update `scripts/reset-eval-rate-limits.ts` documentation — the email-key clearing becomes a no-op for eval-cli@ (since there's no window to reset); update the launch-checklist follow-up entry

## Acceptance Criteria

- cat1 = 15/15 prod runs from CI reliably (≥3 consecutive successful runs against the live `https://joe-dollinger-chat.com` deployment) without any manual rate-limit reset between them
- Per-IP rate limit still applies to the eval-cli email (IP-based protection preserved)
- Spend cap (SAFE-04, 300¢/day) still applies to the eval-cli email (cost-based protection preserved)
- Tests demonstrate that arbitrary OTHER emails do NOT bypass the email rate limiter (the allowlist is exact-match, not pattern-based)
- Vercel Deployment Checks gate flips to auto-passing for routine code PRs that don't break cat1 semantics
- 05-12-LAUNCH-CHECKLIST.md follow-ups section updated to mark this resolved

## Out of Scope (handled separately at Phase 6 planning time)

- **Option (a) — add delays between cat1 cases in `src/lib/eval/cats/cat1.ts`**: rejected during PR #3 night (2026-05-12) per Joe's tonight decision. Determines outcome by slowing the test rather than fixing the policy mismatch.
- cat2 / cat3 / cat5 / cat6 calibration to push per-cat baselines closer to 100% (separate Phase 6 calibration work — these are documented baselines, not infra bugs)
- Anthropic structured-output retry on transient "Grammar compilation timed out" errors (separate Phase 6 follow-up, captured in launch-checklist)
- KB expansion from the 775-line consolidated resume.md (decimal phase 5.4 candidate, separate concern)

## Breadcrumbs

Relevant code as of 2026-05-12:

- [src/app/api/chat/route.ts](../../src/app/api/chat/route.ts) — where the per-email rate-limit check fires inside the six-gate order; this is the primary fix site
- [src/lib/redis.ts](../../src/lib/redis.ts) — `@upstash/ratelimit` limiter constructions (ip10m, ipDaily, email-daily, session, etc.)
- [src/lib/email.ts](../../src/lib/email.ts) — already has eval-cli email detection for skipping session-notification (CR-02 from PR #3); same pattern can be reused for the rate-limit allowlist
- [src/lib/eval/agent-client.ts](../../src/lib/eval/agent-client.ts) — eval CLI sets `eval-cli@joedollinger.dev` as the session email; canonical source of the identity
- [scripts/reset-eval-rate-limits.ts](../../scripts/reset-eval-rate-limits.ts) — current manual workaround; documents the storage shape of `@upstash/ratelimit` sliding-window keys
- [.planning/phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md](../phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md) — "Open follow-ups" section documents this as a Phase 6 candidate before tonight's surfacing
- [.planning/phases/05.1-eval-content-trust-restoration/05.1-01-PLAN.md](../phases/05.1-eval-content-trust-restoration/05.1-01-PLAN.md) — Phase 05.1 Item #6 added the reset-rl script that surfaces this gap

## Notes from Planting Session

- Planted on the night PR #3 merged. The merge required a 4th `enforce_admins`-bypass / manual-Vercel-promote because of this gate flakiness — that's the operational pain point making this worth fixing.
- The fix is small but the SECURITY threat-model review (who can spoof the eval-cli email?) should be done at planning time. Mitigation: per-IP + spend-cap still apply; an attacker spoofing the email would need to also bypass IP rate limits, which requires distributed source IPs and burns spend cap fast.
- Joe explicitly rejected option (a) (delays between cases) at planting time — option (b) is canonical.
- Tied to broader Phase 6 theme: "eval reliability hardening." Likely siblings: judge retry on transient grammar-compile errors; cat2/3/5/6 calibration; eval CLI rate-limit hygiene at the orchestrator level.
