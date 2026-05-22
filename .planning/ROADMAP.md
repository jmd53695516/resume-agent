# Roadmap: Resume Agent

## Milestones

- ✅ **v1.0 Resume Agent — Public Launch** — 10 phases / 52 plans (shipped 2026-05-22, LIVE on prod since 2026-05-11)

Archive: [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) — full phase details
Audit: [milestones/v1.0-MILESTONE-AUDIT.md](./milestones/v1.0-MILESTONE-AUDIT.md) — passed
Requirements: [milestones/v1.0-REQUIREMENTS.md](./milestones/v1.0-REQUIREMENTS.md) — 94/94 satisfied

## Phases

<details>
<summary>✅ v1.0 — SHIPPED 2026-05-22 (10 phases, 52 plans)</summary>

- [x] Phase 1: Foundation & Content (4/4 plans) — Next.js scaffold, KB content, email-gated landing page, byte-identical system-prompt determinism
- [x] Phase 2: Safe Chat Core (4/4 plans) — streaming chat with Sonnet, Haiku classifier preflight, spend cap + rate limits before any tools
- [x] Phase 3: Tools & Resilience (6/6 plans) — three agentic tools (pitch / case study / metric) + trace panel + health endpoint + plain-HTML fallback
- [x] Phase 4: Admin & Observability (7/7 plans) — GitHub-OAuth-gated /admin/* dashboard, cost tracker, abuse log, alarm emails, heartbeat + archive cron
- [x] Phase 5: Eval Gates & Launch (13/13 plans) — ~40-case eval harness, blind A/B friend-test, promote-to-prod CI gate, QR + paper-resume sign-off (CLOSED 2026-05-22 via Joe-attested friend-test)
- [x] Phase 05.1: Eval Content Trust Restoration (1/1 plan, CLOSED PARTIAL) — restored cat1 signal integrity; deferred Items #6/#7/#8 resolved
- [x] Phase 05.2: Chat Stream design from Anthropic design system (6/6 plans) — bubble grouping + inter-group timestamps + light/dark toggle + matrix-mode easter egg
- [x] Phase 6: KB Enrichment — about-me hardening (6/6 plans) — kb/about_me.md enriched 592→1030 words; cat1=15/15 prod + cat4=4.52 prod
- [x] Phase 7: test.yml CI workflow for determinism (3/3 plans) — SAFE-11 17/17 gated on every PR + push-to-main
- [x] Phase 999.1: cat4-prompt-003 cold-cache borderline-ness fix (2/2 plans, CLOSED 2026-05-22) — Sonnet warmup + per_case threshold 4.0→3.8; N=3 cold-cache CI 3/3 PASS; D-08 forward-only supersession of Plan 05-12 cat4-PASS def

</details>

## Backlog

Unsequenced parking lot (999.x). Items captured during Phase 06 close-out triage (2026-05-13) from `.planning/phases/06-kb-enrichment-about-me-hardening/06-06-SUMMARY.md` "Phase 06 deferred items." None are launch-blocking. Promote with `/gsd-review-backlog`.

### Phase 999.3: kb/profile.yml target_roles[] expansion 3→9 (BACKLOG)

**Goal:** Expand `kb/profile.yml` `target_roles[]` from 3 to 9 entries per Plan 06-03 finding S4 (06-01-CLAIM-MATRIX Top-5 #1). Affects role-targeted Q&A precision when recruiter probes which roles Joe is open to.
**Source:** 06-06-SUMMARY.md deferred item #3; 06-03 S4 + 06-01-CLAIM-MATRIX #1.
**Requirements**: TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: kb/profile.yml industries[] expansion to 6-industry list (BACKLOG)

**Goal:** Expand `kb/profile.yml` `industries[]` to the full 6-industry list per Plan 06-03 finding S19. Pairs naturally with 999.3 (same file, same class of content depth).
**Source:** 06-06-SUMMARY.md deferred item #4; 06-03 S19.
**Requirements**: TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: kb/case_studies/*.md coverage audit (10 stripped) (BACKLOG)

**Goal:** Verify each of the 10 stripped case studies has a corresponding `kb/case_studies/*.md` file per Plan 06-03 finding S23. Verification-first task; any gaps surfaced become separate items.
**Source:** 06-06-SUMMARY.md deferred item #5; 06-03 S23.
**Requirements**: TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: kb/profile.yml SQL 7/10 + DDL-gap surface (BACKLOG)

**Goal:** Surface the SQL 7/10 self-rating + DDL-gap framing in `kb/profile.yml` so the agent answers technical-skill probes accurately per Plan 06-03 finding S11.
**Source:** 06-06-SUMMARY.md deferred item #6; 06-03 S11.
**Requirements**: TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: snowflake-marketplace-datashare.md FS/PE 12-domain audit (BACKLOG)

**Goal:** Audit `kb/case_studies/snowflake-marketplace-datashare.md` against the FS/PE 12-domain framework per Plan 06-03 finding S21. Single-case-study depth check; findings may produce further items.
**Source:** 06-06-SUMMARY.md deferred item #7; 06-03 S21.
**Requirements**: TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Cleanup test/script/eval lint debt (BACKLOG)

**Goal:** Clean up the 78 eslint errors + 41 warnings in `tests/**`, `scripts/**`, `evals/**` discovered during Phase 7 planning. Mostly `@typescript-eslint/no-explicit-any` in tightly-mocked SDK types in test files. After cleanup, expand `npm run lint` script from `eslint src/` (Phase 7 scope) back to `eslint .` so the broader codebase is also gated in CI.
**Source:** Phase 7 discuss-phase decision (Option B+E, 2026-05-13). Joe scoped Phase 7 lint to `src/` only to preserve a 2-plan budget; this backlog item captures the deferred cleanup so it stays visible.
**Why:** Memory `feedback_local_vs_vercel_build` motivation is satisfied by `tsc + next build` in Phase 7; this is broader code-hygiene work that yields low signal per hour but improves CI fidelity.
**Requirements**: TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
