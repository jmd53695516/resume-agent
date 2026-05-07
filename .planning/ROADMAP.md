# Roadmap: Resume Agent

## Overview

Five-phase path from empty repo to a publicly linked, eval-gated chat agent attached to Joe's resume. The project has three unrecoverable failure modes — fabrication, cost runaway, and generic-ChatGPT voice — so the ordering is non-negotiable: content and deterministic system-prompt assembly land first, cost/abuse controls land before any tools, tools ship alongside graceful-degradation fallbacks, admin and observability follow, and eval cat 1 (fabrication) + cat 4 (voice fidelity, blind A/B) plus a non-PM friend-test gate the public URL. Content acquisition (~10-14 hours of Joe-time) runs as a parallel track within Phase 1; it has no code dependency on downstream engineering, but launch is blocked on it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Content** - Scaffold, deterministic KB-backed system prompt, email-gated landing page, and voice-first content populated into `kb/`
- [ ] **Phase 2: Safe Chat Core** - Streaming chat with Sonnet, Haiku classifier preflight, spend cap and multi-key rate limits live before any tools exist
- [ ] **Phase 3: Tools & Resilience** - Three agentic tools (pitch, case study, metric) with trace panel, metric card, health endpoint, and plain-HTML fallback
- [ ] **Phase 4: Admin & Observability** - GitHub-OAuth-gated admin dashboard with transcripts, cost tracker, abuse log, alarm emails, and external synthetic monitor
- [ ] **Phase 5: Eval Gates & Launch** - ~40-case eval harness, blind A/B friend-test, promote-to-prod CI gate, QR code, and resume link activation

## Phase Details

### Phase 1: Foundation & Content
**Goal**: A deployable Next.js shell exists, the knowledge base is real and voice-true, the system prompt assembles byte-identically across requests, and a recruiter can hit the framing page and enter their email — without any LLM calls yet.
**Depends on**: Nothing (first phase)
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, CHAT-03, CHAT-04, CHAT-05, VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07, VOICE-08, VOICE-09, VOICE-10, VOICE-12, SAFE-11, SAFE-14
**Success Criteria** (what must be TRUE):
  1. A recruiter can load the framing page, read the engineered (non-breathless) copy with the "I'm an AI, not Joe" disclaimer visible without scroll, submit an email, and see a session row created in Supabase
  2. `kb/` contains `resume.md` (SSOT), `profile.yml`, `about_me.md`, `management_philosophy.md`, `voice.md` (8-12 samples from unfiltered sources only), `stances.md` (8-12 disagreeable positions), `faq.md`, `guardrails.md` (Joe-signed), and 4-6 case studies drafted voice-first, all satisfying the coverage rubric (≥1 failure, ≥1 leadership-without-authority, ≥1 data-rooted, ≥1 cross-functional conflict, ≥1 recent, ≥1 long-arc)
  3. A unit test proves the assembled system prompt is byte-identical across two invocations (no timestamps, no session IDs, no per-request data inside the cached prefix — SAFE-11 enforced)
  4. The voice interview transcript exists and has seeded `voice.md` plus 2-3 `stances.md` entries
  5. A pre-commit hook scans for `NEXT_PUBLIC_` secret leaks and blocks on any match
**Plans:** 4 plans
Plans:
- [x] 01-01-PLAN.md — Next.js scaffold, Tailwind v4 + shadcn/ui, Vitest/Playwright, env + Supabase clients + hashIp + pre-commit secret-scanning hook (SAFE-14)
- [x] 01-02-PLAN.md — KB scaffold (10 files + fixture) + deterministic kb-loader + pure buildSystemPrompt + determinism and forbidden-pattern tests (CHAT-03, CHAT-04, CHAT-05, SAFE-11, VOICE-01)
- [x] 01-03-PLAN.md — Supabase migration, /api/session route, landing page with framing + disclaimer + email gate, /chat stub, VOICE-12 SSOT note (GATE-01..05, VOICE-12)
- [x] 01-04-PLAN.md — Interview protocol docs + content-status tracker + frontmatter validator, then Joe-time content population: voice interview, voice/stances seeding, self-authored prose pack, selection session, case-study interviews, voice-pass sign-off (VOICE-02..10)
**UI hint**: yes

### Phase 2: Safe Chat Core
**Goal**: A recruiter can have a grounded, first-person streaming conversation with Joe's agent, protected by a classifier preflight, a hard daily spend cap that checks before the Anthropic call, and multi-key token-cost-based rate limits — with zero tools live yet, so cost exposure is bounded.
**Depends on**: Phase 1
**Requirements**: CHAT-01, CHAT-02, CHAT-06, CHAT-07, CHAT-08, CHAT-09, CHAT-10, CHAT-11, CHAT-12, CHAT-14, VOICE-11, SAFE-01, SAFE-02, SAFE-03, SAFE-04, SAFE-05, SAFE-06, SAFE-07, SAFE-08, SAFE-09, SAFE-10, SAFE-12, SAFE-13, SAFE-15
**Success Criteria** (what must be TRUE):
  1. A recruiter can send a message and see a streaming first-person reply from Sonnet with a "thinking" indicator, capped at ≤1500 output tokens and defaulting under 120 words, persisted to `messages` with app-generated UUIDs
  2. The Haiku classifier runs synchronously on every user message and routes injection/offtopic/sensitive inputs to in-character deflections; borderline (<0.7) confidence routes to a clarify template
  3. When asked about a fictional project or anything not in the KB, the agent says "I don't know" and offers the closest real alternative — verified by manual trap prompts against eval-style cases
  4. When the Redis spend counter is past `$3/day`, `/api/chat` returns a graceful in-character "come back in a few hours" response without calling Anthropic — confirmed by a synthetic test that mocks the counter past threshold
  5. Rate limits trigger per-IP (20/10min, 60/day via Vercel `ipAddress()`), per-email (150/day), per-session, and on cumulative token cost — each in-character deflection when tripped
  6. The conversation caps at 30 turns with a graceful "we've covered a lot, email Joe to keep going" message, and the system prompt refuses persona change / instruction override / verbatim KB dump (defense-in-depth alongside the classifier)
**Plans**: TBD
**UI hint**: yes

### Phase 3: Tools & Resilience
**Goal**: The three agentic tools work for real (DevTools shows live network calls), render as distinct UI (trace panel + metric card), degrade gracefully when any dependency fails, and a recruiter never leaves empty-handed even if `/api/chat` is 500ing.
**Depends on**: Phase 2
**Requirements**: CHAT-13, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, TOOL-08, TOOL-09, TOOL-10, TOOL-11, OBSV-07, OBSV-10, OBSV-11, OBSV-12, OBSV-16
**Success Criteria** (what must be TRUE):
  1. A recruiter clicks "Pitch" with a company name and gets a streamed 3-paragraph tailored pitch that cites specific recent (<90 days) company signals with live clickable source URLs — and DevTools shows a real Exa call occurred
  2. A recruiter clicks "Walkthrough," picks a case study from the menu, and hears a ~400-word first-person narration ending with "Want to go deeper, or hear a different story?"; unknown slugs return the menu instead of fabricating a story
  3. A recruiter clicks "Metric Design," describes a feature, and sees a formatted card (not a markdown blob) with north_star / input_metrics / counter_metrics / guardrails / experiment / open_questions, with Sonnet's short commentary above the card
  4. Every tool call renders in a collapsible "See what I did" trace panel under the assistant reply, tool-call depth is capped at 3 per turn with `stopWhen: stepCountIs(5)`, and duplicate-arg tool calls trigger a stop-sequence
  5. When any dependency is impaired, the framing-page status banner turns yellow with a specific message ("Company-pitch tool temporarily offline, everything else works"); when `/api/chat` returns 500, the same URL serves a plain-HTML snapshot of Joe's background with a direct-email CTA
  6. Tool errors produce honest in-character fallback messages; fetched Exa content is never interpreted as instructions (prompt-injection via scraped pages blocked); all tool `execute` functions are read-only, with writes only in `onFinish`
**Plans:** 6 plans
Plans:
- [x] 03-00-PLAN.md — Foundation prep: pino@10 swap, exa-js install, EXA_API_KEY required, getCaseStudy(slug) helper, exa.ts client, health.ts skeleton (OBSV-16)
- [x] 03-01-PLAN.md — Three AI SDK tools (research_company, get_case_study, design_metric_framework) + sanitize/depth-cap/failure-copy modules + system-prompt extensions for fetched-content + anti-reflexive-chaining (TOOL-01..05, TOOL-09, TOOL-11)
- [x] 03-02-PLAN.md — Wire tools + prepareStep + persistToolCallTurn + heartbeats into /api/chat onFinish (TOOL-06, TOOL-07, TOOL-08, TOOL-10)
- [x] 03-03-PLAN.md — TracePanel + MetricCard + MessageBubble extension to walk message.parts (CHAT-13, TOOL-06, TOOL-10)
- [x] 03-04-PLAN.md — /api/health endpoint + StatusBanner SC + dual-page mounting via app/chat/layout.tsx (OBSV-07, OBSV-10, OBSV-11)
- [x] 03-05-PLAN.md — Plain-HTML fallback: build-time KB extractor + branched render in page.tsx + error.tsx belt-and-suspenders + ChatUI persistent-500 redirect (OBSV-12)
**UI hint**: yes

### Phase 4: Admin & Observability
**Goal**: Joe can log in with GitHub, review every session's transcript with tool traces inline, watch costs and abuse flags accumulate in real time, receive per-session emails with company-domain priority, and trust that a synthetic monitor outside Vercel will catch outages Vercel itself can't see.
**Depends on**: Phase 3
**Requirements**: OBSV-01, OBSV-02, OBSV-03, OBSV-04, OBSV-05, OBSV-06, OBSV-08, OBSV-09, OBSV-13, OBSV-14, OBSV-15
**Success Criteria** (what must be TRUE):
  1. Joe can authenticate at `/admin` via GitHub OAuth; a non-allowlisted GitHub account gets a 403 at the API middleware layer (not just UI)
  2. The sessions view shows the last 100 sessions with email, domain, timestamp, and a flag column, sortable by date or domain; clicking a row reveals the full transcript with tool-call traces rendered inline
  3. The cost tracker shows rolling 24h / 7d / 30d Anthropic spend with per-tool breakdown and prompt-cache hit rate; the abuse log shows classifier-flagged messages and rate-limit hits with hashed IP + email
  4. Joe receives a per-session email within seconds of a new session (company-domain addresses get a priority subject-line flag) and alarm emails on: hard spend-cap trigger, error rate >2% over 10min, any dependency down, or ≥5 unique IPs hitting rate limits within an hour
  5. A BetterStack/UptimeRobot synthetic monitor pings the app from outside Vercel and a `cron-job.org` heartbeat pre-warms the prompt cache every 5 min during business hours; retention runs 180d hot then cold for transcripts, indefinite for captured emails, 90d for classifier flags
**Plans:** 7 plans
Plans:
- [x] 04-01-PLAN.md — Deps + env + migration push + shadcn primitives (Wave 1; OBSV-15)
- [x] 04-02-PLAN.md — Auth perimeter: proxy.ts + admin-auth + login + callback + NotAuthorized (Wave 2; OBSV-01, OBSV-02)
- [x] 04-03-PLAN.md — Admin shell + Sessions list + Transcript viewer with TracePanel admin variant (Wave 3; OBSV-03, OBSV-04)
- [x] 04-04-PLAN.md — Cost + Abuse + Health pages (Wave 3; OBSV-05, OBSV-06)
- [x] 04-05-PLAN.md — Email infra: Resend + free-mail allowlist + per-session email via after() in /api/chat (Wave 2; OBSV-08)
- [x] 04-06-PLAN.md — Cron auth + check-alarms cron + 4-condition dispatcher (Wave 3; OBSV-09)
- [x] 04-07-PLAN.md — Heartbeat cron + Archive cron + retention (Wave 3; OBSV-13, OBSV-14, OBSV-15)
**UI hint**: yes

### Phase 5: Eval Gates & Launch
**Goal**: The ~40-case eval suite runs in CI, category 1 (fabrication) passes 15/15 with zero tolerance, category 4 (voice fidelity) passes the blind A/B friend-test under 70% identification AND ≥4.0 LLM-judge average, three friend-testers (including a non-PM) confirm "feels substantive, not gimmicky," and only then does the QR code get printed on the paper resume and the URL go on the digital one.
**Depends on**: Phase 4
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-07, EVAL-08, EVAL-09, EVAL-10, EVAL-11, EVAL-12, EVAL-13, EVAL-14, LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, LAUNCH-07
**Success Criteria** (what must be TRUE):
  1. `npm run eval` runs ~40 cases across 6 categories against a preview deploy in 3-5 minutes for under $1; category 1 (factual fidelity, 15 cases) passes 15/15 with both LLM-judge and a deterministic name-token allow-list against `profile.yml`; CI blocks promote-preview-to-prod on any regression
  2. Category 4 (voice fidelity) passes: a blind A/B test (5 agent replies + 5 real Joe paragraphs shuffled) where a friend-tester identifies agent responses at <70%, AND a non-Sonnet LLM judge scores ≥4.0 average against the `voice.md` rubric
  3. Categories 2 (tool correctness, 9 cases), 3 (persona, 6 cases), 5 (abuse resilience, 6 cases covering OWASP LLM01 jailbreak corpus), and 6 (UX smoke via Playwright — email gate, three tool buttons, trace toggle, fallback under induced 500, negative-auth test) all pass; synthetic spend-cap test included
  4. Three human friend-testers complete a session — at least one PM and at least one non-PM — and the non-PM answers "feels substantive, not gimmicky" as yes; any "that's awkward" issues are fixed before the resume link goes live
  5. The app is deployed to a memorable public URL, a QR code is generated and printed on the paper resume, the URL is added to the PDF/LinkedIn/personal site, all EVAL requirements pass against the production deploy, `guardrails.md` is Joe-signed, and Joe has verified at least one real transcript end-to-end in the admin dashboard
  6. Weekly scheduled eval runs catch drift from KB edits, LLM version shifts, or Exa data drift; judge models are version-pinned and human baseline calibration runs monthly to detect LLM-judge self-preference
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Content | 0/4 | Not started | - |
| 2. Safe Chat Core | 0/TBD | Not started | - |
| 3. Tools & Resilience | 0/TBD | Not started | - |
| 4. Admin & Observability | 0/7 | Not started | - |
| 5. Eval Gates & Launch | 0/TBD | Not started | - |
