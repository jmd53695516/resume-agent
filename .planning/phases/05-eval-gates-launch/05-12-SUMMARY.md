---
phase: 05-eval-gates-launch
plan: 12
status: CLOSED
launch_date: 2026-05-11
friend_test_signed_off_date: 2026-05-22
final_url: https://joe-dollinger-chat.com
milestone: v1.0
prod_cat1_runId: sWLys5bpVsiHAfwvoln04
prod_cat4_runId: OPoI0ljuwE4GlbT_LFh4u
launch_signoff_artifact: .planning/phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md
---

# Plan 05-12 CLOSED — v1.0 launch sign-off complete

**One-liner:** Public chat agent live at https://joe-dollinger-chat.com since 2026-05-11; friend-test sign-off (3 testers, non-PM Q1=Y, no awkward issues) attested by Joe on 2026-05-22 — Plan 05-12 fully closed.

**Durable sign-off artifact:** [05-12-LAUNCH-CHECKLIST.md](./05-12-LAUNCH-CHECKLIST.md)

## Hard-gate summary

| Gate | Status | Evidence |
|------|--------|----------|
| LAUNCH-01 (domain) | ✓ | Apex `joe-dollinger-chat.com` purchased 2026-05-10; Cloudflare CNAME flattening; TLS live |
| LAUNCH-02 (QR) | ✓ | `public/resume-qr.png` (committed); phone-scan-verified by Joe |
| LAUNCH-03 (digital URL) | ✓ | LinkedIn Featured + master resume PDF (personal site N/A) |
| LAUNCH-04 (friend-test) | ✓ | 3 testers (≥1 PM, ≥1 non-PM, +recruiter); non-PM Q1=Y; no awkward-issues to triage (Joe-attested 2026-05-22) |
| LAUNCH-05 (cat1=15/15 + cat4 PASS on prod) | ✓ | cat1 `sWLys5bpVsiHAfwvoln04`; cat4 `OPoI0ljuwE4GlbT_LFh4u` (aggregate 4.40, 5/5 per_case) |
| LAUNCH-06 (pre-launch checklist) | ✓ | resume.md final, guardrails Joe-signed (line 37), evals passed, transcript verified end-to-end in /admin/sessions |
| LAUNCH-07 (branch protection + Deployment Checks) | ✓ | A7 spot-test from Plan 05-10 + repeatedly exercised (with documented enforce_admins bypass dance — narrowing follow-up logged) |
| SAFE-12 (Anthropic spend cap) | ✓ | Org-level $100/mo cap (deviation from spec'd $20/mo — see CHECKLIST §SAFE-12 rationale); evidence at safe-12-evidence.png. Project-specific protection via in-code 300¢/day SAFE-04. |

## Cat4 PASS def amendment (Phase 999.1, forward-only)

Cat4 PASS at sign-off-time (2026-05-13) was against the legacy `per_case_min_avg 4.0 + aggregate_min_avg 4.0` threshold. Plan 05-12 cleared it: preview 4.20/5-of-5, prod 4.52/5-of-5.

Effective 2026-05-14 per Phase 999.1, the forward-looking cat4 PASS def is `per_case_min_avg 3.8 + aggregate_min_avg 4.0` (D-07 preserves the original sign-off; D-08 cross-references the supersession). See:
- [`05-12-CONTEXT-ADDENDUM.md`](./05-12-CONTEXT-ADDENDUM.md) D-12-B-01 supersession note
- Inline supersession parentheticals at 4 sites in [`05-12-PLAN.md`](./05-12-PLAN.md)
- N=3 cold-cache verification: [`999.1-VERIFICATION-LOG.md`](../999.1-cat4-prompt-003-cold-cache-borderline-ness-fix/999.1-VERIFICATION-LOG.md) (3/3 PASS, aggregate 4.16 / 4.20 / 4.32)

## Documented baseline (non-blocking per D-12-B-01)

| Cat | Pass rate | Source runId | Disposition |
|-----|-----------|--------------|-------------|
| cat2 | 2/9 | `j1w6V80X4l0wcZekN52XL` (preview) | Tool-call assertion mismatches; Phase 6 calibration |
| cat3 | 2/6 | `loroDuGeY8SfJ-m_AliBs` | D-12-C-05 ≥1/6 informational gate MET (was 0/6 pre-Task-0); calibration to push >5/6 = post-launch |
| cat5 | 1/7 | `OPoI0ljuwE4GlbT_LFh4u` | Refusal hybrid + warmth threshold; case-by-case investigation, Phase 6 |
| cat6 | 17/20 | `j1w6V80X4l0wcZekN52XL` (CI) | 3 admin-403 spec failures pre-existing (per Plan 05.2-06 deferred-items); not introduced by 05-12 |

## Launch-window incidents (resolved)

1. **Supabase Site URL was localhost (dev default)** — admin OAuth bounced to localhost after sign-in; fixed in Supabase Dashboard (Site URL → apex + Redirect URLs include `/auth/callback`).
2. **Banner false-degraded on Exa + chicken-and-egg classifier ping** — fixed in PR #2 (`296ad6c`): pingExa switched to heartbeat-trust pattern; heartbeat route now calls classifyUserMessage directly (~$0.0001/cron fire) instead of reading its own stale heartbeat key.
3. **Eval CLI bursts trip rate-limiters from single CI runner IP** — SEED-001 resolved in 3 halves (quick tasks `260512-r4s` rate-limit + `260512-ro4` spend-cap + `260512-sne` ip-rate-limit), then global kill-switch `SAFETY_GATES_ENABLED=false` (`260512-tku`) for cleanup. Per-IP cost cap SAFE-08 (150¢/day/IP) is the new last-line backstop during the OFF window.
4. **Anthropic spend cap incident 2026-05-12** — single-hour spike from eval verification filled the in-code 300¢/day cap; agent dead silently until rollover. Driver of SEED-001 + SAFETY_GATES_ENABLED escape hatch. Documented at `.planning/memory/project_spend_cap_incident_2026-05-12.md`.
5. **Heartbeat over-fire incident 2026-05-20** — `*/1 13-22 UTC` schedule fired with prewarm enabled, ~$5.57/biz-day spend. Resolved via split-cron pattern (PR #7 + quick task `260520-t5j`): heartbeat at `*/1 9-17 ET` deps-only with `HEARTBEAT_LLM_PREWARM=false`; new prewarm-cache route at `*/5 9-17 ET`. Steady-state cost ~$1.06/biz-day. Live-verified 2026-05-22.

## Friend-test attestation (LAUNCH-04)

| Tester | Role | Q1 (substantive) | Awkward / cringe | Block-launch issues |
|--------|------|------------------|------------------|---------------------|
| 1 | non-PM, non-technical, non-HR | **Y** | none | none |
| 2 | PM with some technical ability | **Y** | none | none |
| 3 | recruiter | **Y** | none | none |

Non-PM Q1=Y satisfied (LAUNCH-04 hard gate). Per CHECKLIST sign-off note, full Q3/Q5 response text retained locally by Joe; not committed to repo per friend-tester privacy norm.

## Open follow-ups (post-launch, non-blocking)

Captured in [`05-12-LAUNCH-CHECKLIST.md` §Open follow-ups](./05-12-LAUNCH-CHECKLIST.md), repeated here for visibility:

- **KB expansion (decimal phase 5.4 candidate):** 775-line consolidated resume.md compiled by another agent — held local; merge requires strip + voice-rewrite + cat1/cat4 re-verify.
- **CI eval workflow narrowing** per addendum D-12-B-01 (currently runs all 6 cats; should gate on cat1+cat4-judge only to retire the bypass-treadmill). Partially addressed in PR #3 (`de616de`); residual narrowing tracked as post-v1.0 backlog.
- **Multi-turn eval coverage** for classifier-followup regressions (e.g., short replies like "Nike" to clarifying-questions deflecting as offtopic — surfaced by friend-tester, fixed in PR #6 `47a6f25`).
- **Judge transient retry** for `Grammar compilation timed out` (caught one such failure during cat1 verification; passed on retry).
- **cat2/cat3/cat5/cat6 calibration** to bring per-cat baselines closer to 100% (post-launch ergonomic).
- **Banner classifier false-green WR-01** — RESOLVED via quick task `260511-u9d` (PR #3).
- **`scripts/reset-eval-rate-limits.ts` email-key audit** — RESOLVED via SEED-001 quick task `260512-r4s`.

## Paper-resume go-live (Joe action)

The only remaining LAUNCH-* checkbox is "Paper resume printed with QR" — a Joe-side action ahead of his next interview cycle. Not gating the Plan 05-12 close (digital channels are already live; paper print activates the physical-resume QR experience whenever Joe needs it).

## Commit chain (Plan 05-12 over its multi-PR life)

| PR | Squash commit | Description |
|----|---------------|-------------|
| #1 | (Plan 05-12 Task 0 + Tasks 1-3 squash) | Classifier tune + cat1=15/15 + PDF + QR + LinkedIn/PDF/site URL + SAFE-12 evidence |
| #2 | `296ad6c` | Banner truth fixes (pingExa heartbeat-trust + classifier ping route) |
| #3 | `1eaf25d` | Phase 05 code-review iteration + Plan 05-13 gap closure (eval CLI argv) + WR-01 quick task `260511-u9d` |
| #4 | (subsequent) | SEED-001 all three halves (r4s + ro4 + sne) |
| #6 | `47a6f25` | Classifier-stateless-short-followup fix (driven by friend-tester signal) |
| #7 | `b4f9051` | Split-cron pattern + Phase 999.1 Plan 1 cat4 warmup |
| (this PR) | _pending_ | Plan 05-12 friend-test close-out — Joe-attested clean 2026-05-22 |

## STATE + ROADMAP updates

- Plan 05-12 checkbox flipped to `[x]` in ROADMAP.md Phase 5 plan list.
- Phase 5 (Eval Gates & Launch) status: all 13 plans complete (12 original + 1 gap-closure 05-13). Phase 5 ready to mark CLOSED.
- v1.0 milestone: all phases complete (Phase 1 ✓ Phase 2 ✓ Phase 3 ✓ Phase 4 ✓ Phase 5 ✓ Phase 05.1 ✓ Phase 05.2 ✓ Phase 6 ✓ Phase 7 ✓ Phase 999.1 ✓). Ready for `/gsd-complete-milestone v1.0` to archive.

## Forward references

- **/gsd-complete-milestone v1.0** is the natural next step.
- **v1.1 milestone scoping** (post-archive) — KB expansion, CI eval narrowing, multi-turn eval, cat calibration.

---

**Plan 05-12 status: CLOSED 2026-05-22 (Joe attestation).** v1.0 LIVE on prod with friend-test sign-off.
