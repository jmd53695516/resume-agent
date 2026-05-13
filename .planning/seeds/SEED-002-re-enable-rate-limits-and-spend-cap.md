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
