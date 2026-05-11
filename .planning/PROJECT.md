# Resume Agent

## What This Is

A public, QR- and URL-linked chat agent attached to Joe Dollinger's paper and digital resume. Hiring managers scan or click, land in a gated chat, and can both ask Q&A about Joe and invoke three PM-flavored agentic tools (tailored company pitch, case-study walkthrough, metric framework). The agent itself is the portfolio artifact — interacting with it is the evidence of Joe's ability to product-manage agentic AI.

## Core Value

A recruiter in under five minutes walks away with a distinctive, specific impression of Joe — grounded in real projects, free of fabrication, and delivered by an agent they can see was engineered (not just prompted) with cost, abuse, and hallucination controls.

## Requirements

### Validated

- [x] Public landing page with brief framing and soft email gate (no password) — *Validated in Phase 1: Foundation & Content*
- [x] Knowledge base of resume, profile, about-me, management philosophy, voice samples, stances, FAQ, guardrails, 4-6 case studies — *Validated in Phase 1: Foundation & Content*
- [x] Streaming chat UI with first-person voice as Joe, grounded in a markdown knowledge base — *Validated in Phase 2: Safe Chat Core (live SMOKE evidence + SpaceX trap test passed during close-out)*
- [x] Input classifier (Haiku) that gates abuse / injection / offtopic / sensitive messages — *Validated in Phase 2: Safe Chat Core (4 trip tests passed at $0 Sonnet cost)*
- [x] Four-layer voice defense (authentic samples, negative directives, opinion-density stances, voice-first case studies) — *Validated in Phase 2: Safe Chat Core (system-prompt determinism + VOICE-11 conformance test cases pass)*
- [x] Hard daily spend cap in code + per-IP/per-email rate limits + max output tokens + max conversation length — *Validated in Phase 2: Safe Chat Core (six gates run cheapest-first; cache hit confirmed cold 14¢ → warm 7¢)*
- [x] Tool: company research + tailored 3-paragraph pitch with live sources (`research_company`) — *Validated in Phase 3: Tools & Resilience (Exa client w/ <90d freshness filter, sanitizer + system-prompt FETCHED_CONTENT_RULE; live DevTools observation pending in 03-HUMAN-UAT)*
- [x] Tool: menu-driven case-study walkthrough narrated first-person (`get_case_study`) — *Validated in Phase 3: Tools & Resilience (kb-loader + tool wired; ~400-word prose-shape verification pending in 03-HUMAN-UAT)*
- [x] Tool: structured metric framework rendered as card + Joe's commentary (`design_metric_framework`) — *Validated in Phase 3: Tools & Resilience (Haiku 4.5 forced-tool-output + Zod-validated, MetricCard renders six sections; live render pending in 03-HUMAN-UAT)*
- [x] Tool-call trace panel visible to the user ("see what I did") — *Validated in Phase 3: Tools & Resilience (TracePanel walks message.parts; chevron UX pending in 03-HUMAN-UAT)*
- [x] Graceful degradation banner when any dependency is impaired; friendly "come back later" on spend cap — *Validated in Phase 3: Tools & Resilience (/api/health always-200, StatusBanner SC + ChatStatusBanner CC, plain-HTML fallback at /?fallback=1 + error.tsx safety net)*
- [x] Admin dashboard (GitHub-OAuth-gated) with sessions, transcripts, cost tracking, abuse log, tool-health ping — *Validated in Phase 4: Admin & Observability (proxy.ts perimeter + requireAdmin Layer 2, sessions list with always-expanded TracePanel admin variant, cost tracker with 24h/7d/30d windows + cache hit rate, abuse log w/ ip_hash[:8], health grid w/ 5 deps + heartbeats + alarms; live OAuth + dashboard smoke pending in 04-HUMAN-UAT)*
- [x] New-session email notifications to Joe (with company-domain priority) — *Validated in Phase 4: Admin & Observability (Resend + React Email template, atomic-claim UPDATE-WHERE-IS-NULL idempotency, [PRIORITY] subject prefix for non-free-mail, after()-fired post-persistNormalTurn; 4-condition alarm dispatcher with NX suppression; live email observation pending in 04-HUMAN-UAT)*

### Active

<!-- Current scope. Building toward these. All hypotheses until shipped. -->

- [ ] End-of-session optional feedback prompt ("was this useful?") — deferred (not landed in Phase 4)
- [ ] Eval suite (~40 cases) across 6 categories: factual fidelity, tool correctness, persona, voice fidelity, abuse resilience, UX smoke — Phase 5
- [ ] Deployed to public URL with QR code linked from Joe's resume — Phase 5

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
| Delivery via QR + URL (hosted web chat) | QR on paper resume + clickable link on digital resume; the demo IS the artifact | — Pending |
| Hybrid Q&A + three agentic tools (pitch / walkthrough / metric) | Pure Q&A is commoditized; tools demonstrate real agentic judgment | — Pending |
| Single-model + prompt caching instead of RAG | KB fits in <50k tokens; simpler, cheaper, higher quality at this scale | — Pending |
| First-person voice ("I shipped X...") with upfront disclaimer | Third-person is awkward; warmth > strict technical accuracy once disclaimer is clear | — Pending |
| Four-layer voice defense (samples / negative rules / stances / voice-first case studies) | Generic ChatGPT voice is the single largest quality risk for a PM-targeted agent | — Pending |
| Resilient launch posture (rate limits / spend cap / graceful degradation / plain-HTML fallback) | A PM who engineered cost/abuse controls is itself the portfolio piece | — Pending |
| Voice fidelity promoted to its own eval category with blind A/B friend test | It's the top quality risk; measurement discipline must match | — Pending |
| Admin auth via Supabase Auth + GitHub OAuth (free) | Zero incremental cost; minimal setup; reads well as "I chose the right primitive" | — Pending |
| Email-only notifications (no SMS) | Volume doesn't justify Twilio even at $0.01/msg; fewer moving parts | — Pending |
| End-of-session feedback prompt included | PM-coded signal to instrument one's own project; signal is gold even at low response rate | — Pending |
| Content acquisition via Mode 3 (selection session + Claude-led case-study interviews + voice interview) | Raw self-write produces thin case studies; conversational interview extraction is the highest-leverage content pattern | — Pending |

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

## Current State

**Phase 4 (Admin & Observability) closed 2026-05-07.** GitHub-OAuth-gated `/admin` is live behind a two-layer perimeter (`src/proxy.ts` + `requireAdmin()` per page); the `(authed)/` route group keeps `/admin/login` reachable. Sessions list (last 100, URL-driven sort) → transcript viewer reuses Phase 3's TracePanel via a new `alwaysExpanded` admin variant (label "Tool trace", no chevron). Cost dashboard runs 24h/7d/30d windows with per-tool breakdown + cache-hit-rate; abuse log merges classifier verdicts + deflection stop-reasons with ip_hash[:8]; health grid pings 5 deps, surfaces heartbeats, and conditionally renders the BetterStack link. Email infra: Resend + React Email template, atomic UPDATE-WHERE-IS-NULL idempotency, `[PRIORITY]` subject prefix for non-free-mail (canonical 25-domain allowlist), fired via Next.js 16 `after()` post-persistNormalTurn. Alarm dispatcher (4 conditions: spend-cap ≥$3, error-rate >2% over 10min w/ minSample=10, dep-down across 5 pings, ≥5 distinct rate-limit IPs in 1h) with per-condition Redis NX suppression and `alarms_fired` audit. Heartbeat cron pre-warms prompt cache + refreshes both Anthropic + classifier heartbeat keys; archive cron runs 180d hot→cold (gzip-JSONL upload-first-then-delete to private `transcripts-archive` bucket) + 90d classifier purge. Migration `0002_phase4.sql` applied to live DB. Code review surfaced 6 warnings — all auto-fixed (proxy matcher path-segment anchor, archive starvation interleave, prod localhost URL fallback, missing classifier heartbeat refresh, abuse-page true-count surface, stable canonical archive path). 330/330 tests pass.

Deferred from Phase 2 (still tracked):
- **SAFE-12** — Anthropic $20/mo org-level spend cap (operational only, no code) — gates Phase 5 LAUNCH-06 deploy
- **REVIEW WR-01** (Phase 2) — message-length cap on `/api/chat` (classifier cost scales with input tokens before the local $3 cap fires)
- **REVIEW WR-02..05** (Phase 2) — IP spoofing on `/api/session`, atomic Redis ops, classifier delimiter wrap, `/api/session` rate limit

Phase 3 follow-ups (still tracked in 03-HUMAN-UAT.md):
- 9 human-verification items requiring live runtime testing — best smoked manually before public deploy or as part of Phase 5 evals.
- Resume PDF placement at `/joe-dollinger-resume.pdf` — Joe drops the PDF in `public/` before public deploy (Phase 5 LAUNCH-* responsibility).
- 9 Info-severity code-review items deferred per `fix_scope: critical_warning`.

Phase 4 follow-ups (tracked in 04-HUMAN-UAT.md, not blocking closure):
- 11 human-verification items: live OAuth round-trip happy/sad path, real per-session email + idempotency, cron auth gate + force-trip spend-cap alarm, heartbeat with `cache_read_tokens > 0`, archive smoke, **3 cron-job.org schedules to configure**, **BetterStack synthetic monitor + dashboard URL env var**, visual confirm always-expanded admin trace.
- One-time `oauth_debug_claims_shape` Pino log in `/auth/callback` — schedule a removal commit after Joe verifies the claims shape on Vercel logs from the first real GitHub login (resolves RESEARCH Open Q 1).
- 5 Info-severity code-review items left as documented follow-ups (TracePanel click-lock, OAuth diagnostic log, magic threshold constants, streamText error reason hack, direct `process.env` reads in supabase-browser).
- End-of-session feedback prompt ("was this useful?") was originally listed for Phase 4 in the early roadmap but did not land — moved back to Active with no phase assignment until prioritized.

**Phase 5 (Eval Gates & Launch) — in flight (10/12 plans done):** eval harness across 6 categories shipped (Plans 05-01..05-09); two-layer prod gate live (Plan 05-10 — GH branch protection + Vercel Deployment Checks); cron eval scaffolding partial (Plan 05-11 PARTIAL, cron-job.org schedule deferred to 05-12 pending stable prod URL post-CNAME flip). Plan 05-12 LAUNCH-* (CNAME, prod-URL eval, friend-tester sessions, QR-code launch) is the final remaining work.

**Phase 5.1 (Eval Content Trust Restoration) closed PARTIAL 2026-05-10.** Three sequential commits closed deferred-items #6 (ipLimiter local-reset script + sliding-window key expansion), #7 (eval CLI deflection-vs-real disambiguation via AI SDK v6 transient `data-deflection` chunk), and #8 (Sonnet quantitative-claim hallucination — `HALLUCINATION_RULES` premise-smuggling rule + `kb/profile.yml` `counter_facts:` 10-entry block). cat1-fab-005 passes every post-Item-#8 run. The cat1=15/15 D-B-01 stretch goal was NOT met because Item #7's now-honest deflection signal exposed a previously-hidden classifier (Haiku 4.5) over-flagging behavior — promoted as new deferred-item #11 for Plan 05-12 / Phase 05.2 disposition. Production /api/chat byte-identical to pre-phase SHA `8be227b` (Phase 2 D-G-01..05 contract preserved). 541/541 tests pass; 0 Critical / 3 Warning / 4 Info on code review.

**Phase 5.2 (Implement Chat Stream design from Anthropic design system) closed 2026-05-11.** Visual-only port of the four remaining bundle features into the recruiter-facing chat surface before LAUNCH-05: bubble grouping with iMessage tail-corner radii (D-A-01), inter-group timestamps with the 5-minute rule fully client-side (D-A-02 + AMENDED — `/api/chat` byte-identical to phase 02 D-G contract, no backend changes), top-right "Light Mode / Dark Mode" toggle pill (D-B-01..03 — literal labels, session-only state, no persistence), and the matrix-mode easter egg with canvas digital-rain backdrop + green-monospace terminal restyle (D-A-04, lazy-mounted via `next/dynamic({ ssr: false })` so the rain bundle only ships on Dark Mode click). New modules: `src/lib/chat-types.ts` (`ResumeAgentUIMessage`, `BubblePosition`), `src/lib/chat-format.ts` (pure `computePositions` + `shouldShowTimestampBefore` helpers, 18-test coverage), `src/components/TimestampDivider.tsx`, `src/components/ViewToggle.tsx`, `src/components/MatrixRain.tsx`. Body-class side effect on `chat/page.tsx` includes Pitfall 2 cleanup so `matrix-mode` doesn't leak to `/admin/*`. All Phase 02 data-testids preserved verbatim; 12 new selector-hook testids added on existing chrome elements (no DOM restructure). Cat6 Playwright e2e re-baselined per D-C-03: view-toggle sanity assertion appended to `chat-happy-path.spec.ts` and new `cat-06-view-toggle.spec.ts` (5 tests). 562/562 vitest pass; tsc + next build green; 14/14 automated must-haves verified; 6/7 HUMAN-UAT items approved (item 7 `npm run eval -- --category 6` deferred to Plan 05-12 LAUNCH pre-flight per verifier note). Code review: 0 Critical / 2 Warning (both auto-fixed: runtime `--font-matrix` resolution for canvas, continuous a11y/viewport gates via matchMedia + resize listener) / 6 Info deferred. Pre-existing `cat-06-admin-403` proxy-redirect mismatch + `chat-six-gate-order` parallel flake filed in 05.2/deferred-items.md (scope-boundary rule — both pre-date 05.2).

Next up: Plan 05-12 (LAUNCH-*) — re-baseline cat1/cat3 against prod URL where classifier behavior may differ, run cat6 against prod (item 7 above), run friend-tester sessions, configure cron-job.org weekly schedule, flip CNAME, ship the QR-code launch.

---
*Last updated: 2026-05-11 after Phase 05.2 (Anthropic chat-stream design port) closure*
