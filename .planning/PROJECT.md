# Resume Agent

> **v1.0 SHIPPED 2026-05-22** — LIVE on prod at https://joe-dollinger-chat.com since 2026-05-11; friend-test sign-off clean. 10 phases / 52 plans. See [milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md).

## What This Is

A public, QR- and URL-linked chat agent attached to Joe Dollinger's paper and digital resume. Hiring managers scan or click, land in a gated chat, and can both ask Q&A about Joe and invoke three PM-flavored agentic tools (tailored company pitch, case-study walkthrough, metric framework). The agent itself is the portfolio artifact — interacting with it is the evidence of Joe's ability to product-manage agentic AI.

## Core Value

A recruiter in under five minutes walks away with a distinctive, specific impression of Joe — grounded in real projects, free of fabrication, and delivered by an agent they can see was engineered (not just prompted) with cost, abuse, and hallucination controls.

## Current State (v1.0 — shipped 2026-05-22)

**Public URL:** https://joe-dollinger-chat.com (apex; Cloudflare CNAME-flattened; LIVE since 2026-05-11)
**Sign-off:** Joe-attested clean friend-test 2026-05-22 (3 testers including non-PM, Q1=Y satisfied LAUNCH-04)
**Eval state on prod:** cat1=15/15 (`JXjeiyEtKcCqKoOia4awU`), cat4 aggregate 4.52 with 5/5 per_case (`EQXxHsTg-_WZENKHxgZua`)
**Codebase:** 25,599 LOC TS/TSX + 15 KB markdown files; 345 commits across 30 days (2026-04-21 → 2026-05-22)
**Ops:** Heartbeat split-cron at `*/1 9-17 * * 1-5 ET` (deps-only) + prewarm-cache `*/5 9-17 * * 1-5 ET` (Sonnet cache_read); steady-state ~$1.06/biz-day
**CI gate:** test.yml SAFE-11 determinism (17/17 tests) gates every PR + push-to-main

## Requirements

### Validated (v1.0 — shipped 2026-05-22)

- ✓ Public landing page with brief framing and soft email gate (no password) — v1.0 (Phase 1)
- ✓ Knowledge base of resume, profile, about-me, management philosophy, voice samples, stances, FAQ, guardrails, 4-6 case studies — v1.0 (Phase 1 + Phase 6 about-me enrichment)
- ✓ Streaming chat UI with first-person voice as Joe, grounded in a markdown knowledge base — v1.0 (Phase 2; cat4 voice-fidelity 4.52 on prod)
- ✓ Input classifier (Haiku) that gates abuse / injection / offtopic / sensitive messages — v1.0 (Phase 2)
- ✓ Four-layer voice defense (authentic samples, negative directives, opinion-density stances, voice-first case studies) — v1.0 (Phase 2)
- ✓ Hard daily spend cap in code + per-IP/per-email rate limits + max output tokens + max conversation length — v1.0 (Phase 2; per-IP 150¢/day SAFE-08 active even when SAFETY_GATES_ENABLED=false kill-switch flipped)
- ✓ Tool: company research + tailored 3-paragraph pitch with live sources (`research_company`) — v1.0 (Phase 3; Exa <90d filter)
- ✓ Tool: menu-driven case-study walkthrough narrated first-person (`get_case_study`) — v1.0 (Phase 3)
- ✓ Tool: structured metric framework rendered as card + Joe's commentary (`design_metric_framework`) — v1.0 (Phase 3; Haiku 4.5 forced-tool-output)
- ✓ Tool-call trace panel visible to the user ("see what I did") — v1.0 (Phase 3)
- ✓ Graceful degradation banner when any dependency is impaired; friendly "come back later" on spend cap — v1.0 (Phase 3; banner-truth fix PR #2 `296ad6c`)
- ✓ Admin dashboard (GitHub-OAuth-gated) with sessions, transcripts, cost tracking, abuse log, tool-health ping — v1.0 (Phase 4; OAuth verified launch night)
- ✓ New-session email notifications to Joe (with company-domain priority) — v1.0 (Phase 4; Resend + atomic-claim idempotency; [PRIORITY] for non-free-mail)
- ✓ Eval suite (~40 cases) across 6 categories — v1.0 (Phase 5; narrowed launch gate to cat1+cat4 per D-12-B-01)
- ✓ Public URL with QR code linked from Joe's resume — v1.0 (Phase 5; apex `joe-dollinger-chat.com`; QR at `public/resume-qr.png`)
- ✓ Friend-test sign-off (3 testers, ≥1 non-PM, Q1=Y) — v1.0 (Plan 05-12 LAUNCH-04 Joe-attested 2026-05-22)
- ✓ Chat-stream visual design (bubble grouping + timestamps + light/dark toggle + matrix-mode easter egg) — v1.0 (Phase 05.2)
- ✓ test.yml CI workflow gating SAFE-11 determinism on every PR — v1.0 (Phase 7)
- ✓ Cat4-prompt-003 cold-cache flake fix (Sonnet warmup + per_case threshold 4.0→3.8) — v1.0 (Phase 999.1; N=3 cold-cache CI 3/3 PASS)

### Active (v1.1 candidates)

<!-- Current scope. Building toward these. All hypotheses until shipped. -->

- [ ] End-of-session optional feedback prompt ("was this useful?") — deferred from Phase 4; revisit if recruiter volume justifies instrumentation
- [ ] Cat2/3/5/6 calibration to push prod baselines closer to 100% (informational baseline currently 2/9, 2/6, 1/7, 17/20)
- [ ] CI eval workflow narrowing: full retire of bypass-treadmill via workflow_dispatch trigger that gates on cat1+cat4-judge only (partial via PR #3 `de616de`; residual cleanup remains)
- [ ] Multi-turn eval coverage (classifier-stateless-short-followup class — surfaced by friend-tester, fixed PR #6; eval harness still single-turn)
- [ ] Re-enable SAFETY_GATES_ENABLED before broad distribution (SEED-002 standing follow-up; currently `false` kill-switch with per-IP SAFE-08 backstop)
- [ ] Cron-job.org schedules for: alarms-cron, scheduled-eval-cron (code shipped, schedules not yet wired)
- [ ] KB expansion: 775-line consolidated resume.md merge (held local; needs strip + voice-rewrite + cat1/cat4 re-verify; same risk class as Phase 6 about-me)
- [ ] Backlog promotion: 999.3..999.8 (kb/profile.yml expansions, case_studies coverage audit, SQL+DDL surface, FS/PE 12-domain audit, test/script/eval lint debt cleanup)

### Out of Scope

<!-- Explicit boundaries with reasoning. Prevents re-adding. -->

- Mobile-optimized UX — responsive baseline only; recruiter flow is desktop-first.
- Full WCAG accessibility audit — baseline semantic HTML only; full audit deferred.
- Internationalization (i18n) — English only; audience is US/Western recruiters.
- Voice or audio chat — text only; scope creep and infra cost not justified.
- Image generation or image upload — scope creep; no user need in this flow.
- CSV / dataset upload tool — finicky UX, overlapping with metric tool's demonstration value; parked.
- Roadmap-critique tool, "interview me" tool — brainstormed and parked (appendix B of spec); revisit post-launch if session feedback demands.
- SMS notifications — email-only suffices at this volume; cost not justified.
- Third-party identity enrichment (Clearbit, etc.) — feels intrusive on first recruiter contact.
- Product analytics (PostHog/Amplitude/GA) — single conversion event; cookie banners hurt the demo.
- A/B testing framework — one version at a time; ship, observe, iterate.
- Full RAG with embeddings/vector DB — KB fits in a cached system prompt (<50k tokens); simpler wins at this scale.
- Magic-link or password auth for users — single email field is the gate; anything more is friction for a 2-minute demo.
- CAPTCHA at launch — Turnstile available if abuse observed, not day one.

## Context

**Who Joe is:** Senior PM with 15 years in business intelligence and 6 years in product management. Actively job-searching for data/analytics PM and senior/staff PM roles.

**Why this project exists:** Traditional resumes don't let a PM prove they can thoughtfully product-manage AI. A live agent that (a) represents Joe accurately and (b) demonstrates real agentic-AI judgment on every axis that matters (cost, abuse, hallucination, voice) is more persuasive than any bullet point. The medium is the message.

**Primary audience:** Technical and non-technical hiring managers, recruiters, founders evaluating Joe for PM roles. Secondary audience: AI-savvy hiring managers evaluating Joe's agentic-AI judgment specifically — for them, the tool traces, eval suite, and cost controls are themselves the pitch.

**Existing artifacts to inherit from:** A complete design spec at `docs/superpowers/specs/2026-04-21-resume-agent-design.md` (~500 lines, seven sections plus appendices, user-approved). An initial implementation draft at `docs/superpowers/plans/2026-04-21-resume-agent-plan-a-build.md` covering repo scaffold through localhost-runnable agent with three tools. GSD will re-derive its own requirements and roadmap from the spec; the superpowers-skill plan is not canonical in the GSD workflow but remains a useful thinking artifact.

**Top quality risk:** "Sounds like generic ChatGPT." Default LLM voice is corporate, hedge-everything, bulleted, RLHF-balanced. The whole KB content strategy (voice samples from unfiltered sources, stances that take disagreeable positions, case studies written in conversational register) is engineered to counteract this. Eval category 4 (blind A/B friend test + LLM-judge against voice samples) is the launch gate.

**Top correctness risk:** Fabrication about Joe's background. A single invented claim in front of a recruiter is a career-damaging event. Mitigated by strict KB-only sourcing rule, zero-tolerance eval category 1, and the explicit "I don't know" instruction over "it depends."

## Constraints

- **Tech stack**: Next.js (App Router) on Vercel, TypeScript, Tailwind — because Joe needs a polished streaming chat UI with zero DevOps.
- **LLM provider**: Anthropic Claude (Sonnet 4.6 main agent, Haiku 4.5 classifier + sub-calls) — best quality/$ for this use case; prompt caching cuts repeat-request cost ~80%.
- **Data / auth**: Supabase (Postgres + Auth with GitHub OAuth for admin) — free tier sufficient, integrated auth eliminates rolling our own.
- **Search provider**: Exa or Brave for `research_company` — recent content within 90 days required; Exa preferred because it returns full content in one call (decision deferred to implementation based on pricing at the time).
- **Hosting**: Free tier across Vercel / Supabase / Upstash / GitHub — because this is a personal project tied to Joe's job search, not a funded startup.
- **Budget**: Hard daily spend cap in code (default $3/day) — public-facing agent during active job search; a single abuse spike could be financially and reputationally damaging.
- **Reliability during job search**: >99% uptime expectation during the hiring window — recruiter landing on a broken agent is a worst-case outcome.
- **Zero-fabrication rule**: Agent must never invent facts about Joe — encoded in system prompt, enforced by eval category 1 (15/15 required).
- **Joe-time investment**: ~10-14 hours across content acquisition (voice interview, case study interviews, stances, FAQ, guardrails) spread over 1-2 weeks.

## Key Decisions

<!-- Significant choices that constrain future work. Add throughout lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Delivery via QR + URL (hosted web chat) | QR on paper resume + clickable link on digital resume; the demo IS the artifact | ✓ Good — apex joe-dollinger-chat.com live; QR scan-verified |
| Hybrid Q&A + three agentic tools (pitch / walkthrough / metric) | Pure Q&A is commoditized; tools demonstrate real agentic judgment | ✓ Good — all 3 tools live on prod, real Exa calls observable |
| Single-model + prompt caching instead of RAG | KB fits in <50k tokens; simpler, cheaper, higher quality at this scale | ✓ Good — `cache_read_input_tokens > 0` every heartbeat; ~80% cost reduction |
| First-person voice ("I shipped X...") with upfront disclaimer | Third-person is awkward; warmth > strict technical accuracy once disclaimer is clear | ✓ Good — cat4 voice-fidelity 4.52 prod (Phase 6 enriched) |
| Four-layer voice defense (samples / negative rules / stances / voice-first case studies) | Generic ChatGPT voice is the single largest quality risk for a PM-targeted agent | ✓ Good — voice-rewrite pass (Phase 06-04) restored fidelity 4/5 |
| Resilient launch posture (rate limits / spend cap / graceful degradation / plain-HTML fallback) | A PM who engineered cost/abuse controls is itself the portfolio piece | ⚠️ Revisit — SAFETY_GATES_ENABLED=false kill-switch active (per-IP SAFE-08 backstop only); SEED-002 re-enable before broad distribution |
| Voice fidelity promoted to its own eval category with blind A/B friend test | It's the top quality risk; measurement discipline must match | ✓ Good — Plan 05-08 blind A/B + Plan 05-06 LLM-judge both shipped; cat4 PASS def amended forward-only 3.8/4.0 per Phase 999.1 |
| Admin auth via Supabase Auth + GitHub OAuth (free) | Zero incremental cost; minimal setup; reads well as "I chose the right primitive" | ✓ Good — OAuth verified launch night; Supabase Site URL fix unblocked the redirect chain |
| Email-only notifications (no SMS) | Volume doesn't justify Twilio even at $0.01/msg; fewer moving parts | ✓ Good — Resend 3k/mo free tier ample at current volume |
| End-of-session feedback prompt included | PM-coded signal to instrument one's own project; signal is gold even at low response rate | — Pending (deferred from Phase 4; v1.1 candidate) |
| Content acquisition via Mode 3 (selection session + Claude-led case-study interviews + voice interview) | Raw self-write produces thin case studies; conversational interview extraction is the highest-leverage content pattern | ✓ Good — 5 case studies + 12 voice samples + Phase 6 about-me enrichment |
| Anthropic spend cap $100/mo (not spec'd $20/mo) | Shared with Joe's other workloads; project-specific protection via in-code 300¢/day SAFE-04 | ✓ Good — cap never tripped except eval-CLI burst (mitigated by SEED-001 + SAFETY_GATES_ENABLED) |
| Branch protection + Vercel Deployment Checks two-layer gate | Layer 1 blocks merge; Layer 2 blocks prod alias even if Layer 1 misses | ⚠️ Revisit — bypass-treadmill (7 uses) because eval gate runs all 6 cats while addendum D-12-B-01 narrows to cat1+cat4; workflow_dispatch retire is v1.1 |
| Split-cron pattern (heartbeat */1 deps-only + prewarm-cache */5 Sonnet warm) | Banner-vs-cost tension: */5 alone regressed banner (HEARTBEAT_OK_S=60); */1 with prewarm over-fired to $5.57/biz-day | ✓ Good (2026-05-22) — steady-state ~$1.06/biz-day; banner stays green |
| Phase 999.1 cat4 PASS def forward-only supersession (3.8/4.0 vs legacy 4.0/4.0) | cold-cache borderline-ness on cat4-prompt-003 (5/7 across Phase 6 N=7 variance map); RESEARCH narrowed to (d) warmup + (c) threshold relax | ✓ Good — N=3 cold-cache CI 3/3 PASS; per_case never source of false-fails after fix |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

## Current State (after v1.0 archive)

**Shipped:** v1.0 LIVE on prod (https://joe-dollinger-chat.com) since 2026-05-11. Friend-test sign-off attested by Joe 2026-05-22 (3 testers including non-PM; non-PM Q1=Y satisfied LAUNCH-04; no awkward issues to triage). Plan 05-12 CLOSED via [05-12-LAUNCH-CHECKLIST.md](./phases/05-eval-gates-launch/05-12-LAUNCH-CHECKLIST.md) + [05-12-SUMMARY.md](./phases/05-eval-gates-launch/05-12-SUMMARY.md).

**Eval state on prod:**
- cat1=15/15 (`JXjeiyEtKcCqKoOia4awU`)
- cat4 aggregate 4.52 with 5/5 per_case (`EQXxHsTg-_WZENKHxgZua`); cat4 PASS def amended forward-only 2026-05-14 to per_case 3.8 + aggregate 4.0 per Phase 999.1 D-08
- cat2/3/5/6 documented baseline (non-blocking per D-12-B-01); Phase 6 calibration is v1.1 candidate

**Operational baseline (2026-05-22):**
- Heartbeat cron `*/1 9-17 * * 1-5 ET` (deps-only, HEARTBEAT_LLM_PREWARM=false in Vercel prod)
- Prewarm-cache cron `*/5 9-17 * * 1-5 ET` (Sonnet cache_read warm)
- Steady-state Anthropic spend ~$1.06/biz-day (vs $5.57 over-fire baseline pre-2026-05-22 split-cron landing)
- 24h Anthropic dashboard verification of target cost: due 2026-05-22 afternoon ET
- SAFETY_GATES_ENABLED=false kill-switch active (per-IP SAFE-08 150¢/day backstop is sole cost guard); SEED-002 = re-enable before broad distribution

**Known v1.0 follow-ups (v1.1 candidates):**
- 6 unsequenced backlog phases parked: 999.3 (target_roles 3→9), 999.4 (industries 6-list), 999.5 (case_studies coverage audit), 999.6 (SQL+DDL surface), 999.7 (snowflake FS/PE audit), 999.8 (test/script/eval lint cleanup)
- CI eval workflow narrowing partially landed via PR #3 (`de616de`); workflow_dispatch retire is residual
- Multi-turn eval coverage gap (PR #6 friend-tester signal hint)
- 3 cron-job.org schedules still unwired (alarms-cron, scheduled-eval, BetterStack synthetic monitor)
- KB expansion: 775-line consolidated resume.md held local

---
*Last updated: 2026-05-22 after v1.0 milestone archive (52/52 plans, 10 phases, 30-day span 2026-04-21 → 2026-05-22)*
