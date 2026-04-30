# Requirements — Resume Agent v1

**Project:** Resume Agent
**Version:** v1 (initial public launch attached to Joe's resume)
**Source:** Derived from `docs/superpowers/specs/2026-04-21-resume-agent-design.md` (approved design spec) and `.planning/research/SUMMARY.md` (research synthesis).
**Requirement format:** `[CATEGORY]-[NUMBER]`. All Active until shipped and validated in production with a real recruiter.

---

## v1 Requirements

### Gate & Session (GATE)

- [ ] **GATE-01** — Landing page displays Joe's framing (who he is, what the agent does, three tools) with an "I'm an AI, not Joe in real time" disclaimer visible without scroll
- [ ] **GATE-02** — Single-field email gate (no password, no magic link); format validated inline; submission unlocks chat
- [ ] **GATE-03** — Each session produces a row in Supabase `sessions` table with email, email_domain, hashed IP, user agent, timestamp
- [ ] **GATE-04** — Session ID persisted in `sessionStorage` and referenced on every subsequent `/api/chat` request
- [ ] **GATE-05** — Landing-page copy is engineered (professional, warm, specific) — no breathless "Meet my AI assistant!" tone that reads as gimmicky

### Chat Core (CHAT)

- [ ] **CHAT-01** — Streaming chat UI (token-by-token response) with a "thinking / calling tool" indicator while waiting
- [ ] **CHAT-02** — Main-agent replies in first-person voice as Joe
- [ ] **CHAT-03** — System prompt loads the full knowledge base (<50k tokens) from versioned markdown files in `kb/`
- [ ] **CHAT-04** — System prompt prefix is byte-identical between requests (no dynamic content) so Anthropic prompt-caching actually hits
- [ ] **CHAT-05** — Explicit `cache_control` with non-default TTL set on the system prompt (never rely on 5-min default)
- [ ] **CHAT-06** — `cache_read_input_tokens` is logged every turn; alarm if below threshold for 3 consecutive calls
- [ ] **CHAT-07** — Agent refuses to fabricate: when asked about anything not in the KB, says "I don't know" and offers the closest real alternative
- [ ] **CHAT-08** — Agent refuses to narrate fictional / counterfactual projects (trap prompts in eval cat 1)
- [ ] **CHAT-09** — Agent caps output to ≤1500 tokens per response; defaults to <120 words
- [ ] **CHAT-10** — Conversation capped at 30 turns per session with graceful "we've covered a lot, email Joe to keep going" message
- [ ] **CHAT-11** — All messages (user + assistant + tool) persisted to `messages` table with classifier verdict, token counts, and latency
- [x] **CHAT-12** — Message persistence uses app-generated UUIDs (not AI SDK message IDs)
- [ ] **CHAT-13** — Every tool call rendered in a collapsible "See what I did" trace panel under the assistant reply
- [x] **CHAT-14** — Suggested starter prompts / three tool buttons visible from the empty-state chat UI

### Knowledge Base & Voice (VOICE)

- [ ] **VOICE-01** — `kb/` folder contains: `profile.yml`, `resume.md`, `linkedin.md`, `github.md`, `about_me.md`, `management_philosophy.md`, `voice.md`, `stances.md`, `faq.md`, `guardrails.md`, and `case_studies/*.md`
- [ ] **VOICE-02** — 4-6 case studies following the strict template (context / options / decision / outcome / retrospective / likely follow-ups)
- [ ] **VOICE-03** — Coverage rubric satisfied across case studies: ≥1 failure, ≥1 leadership-without-authority, ≥1 data-rooted decision, ≥1 cross-functional conflict, ≥1 recent (<2y), ≥1 long-arc (>12mo)
- [ ] **VOICE-04** — `voice.md` has 8-12 short (2-4 sentence) authentic samples drawn only from informal sources (Slack DMs, texts, voice-memo transcripts, unfiltered emails) — NOT from LinkedIn posts or PRDs
- [ ] **VOICE-05** — Voice interview (30-min recorded + transcribed) completed and seeds `voice.md` + 2-3 `stances.md` entries
- [ ] **VOICE-06** — `stances.md` has 8-12 opinions that a reasonable PM could disagree with (test: "could someone I respect read this and say 'I disagree'?")
- [ ] **VOICE-07** — `faq.md` has 15 canned answers (visa, remote, timezone, compensation→redirect, availability, etc.)
- [ ] **VOICE-08** — `about_me.md` (400-600 words, warm, first-person) and `management_philosophy.md` (600-1000 words, opinionated, concrete)
- [ ] **VOICE-09** — `guardrails.md` written by Joe and covers: no fabrication, no salary negotiation, no disparagement of former employers, no confidential details, hiring/comp questions redirect to email
- [ ] **VOICE-10** — Case studies drafted voice-first (conversational register from the first draft, not polished into voice at the end)
- [x] **VOICE-11** — System-prompt tonal directives enumerate negative rules (no "Great question", banned vocab list, no unsolicited bullets, no markdown headers in chat, use contractions, take positions, say "I don't know" not "it depends", <120 words default)
- [ ] **VOICE-12** — `resume.md` declared the single source of truth (SSOT); any PDF/other format generated from it

### Tools (TOOL)

- [ ] **TOOL-01** — `research_company(name, website?)` tool: Exa search (90-day freshness filter) + Haiku summarization returning structured JSON (`company`, `one_liner`, `recent_signals`, `open_roles`, `product_themes`, `sources`)
- [ ] **TOOL-02** — `research_company` returns a 3-paragraph tailored pitch (observation / connection to Joe's background / first-problem-I'd-dig-into) with live source links rendered as footer
- [ ] **TOOL-03** — `get_case_study(slug)` tool: returns structured case study record from the in-memory KB; when slug is absent or unknown, offers the menu of available case studies
- [ ] **TOOL-04** — `get_case_study` narration is ~400 words, first person, with subtle Context/Decision/Outcome/Retro markers; ends with "Want to go deeper, or hear a different story?"
- [ ] **TOOL-05** — `design_metric_framework(description)` tool: Haiku sub-call with rigid schema returns structured JSON (north_star, input_metrics, counter_metrics, guardrails, proposed_experiment, open_questions)
- [ ] **TOOL-06** — Metric framework output rendered as a formatted card in the UI (not a markdown blob) with labeled sections; main agent adds short commentary above the card
- [ ] **TOOL-07** — Tool-call depth capped at 3 per turn; `stopWhen: stepCountIs(5)` on `streamText`
- [ ] **TOOL-08** — Tool executions are read-only; all writes happen in `onFinish`, never in tool `execute` functions
- [ ] **TOOL-09** — Fetched Exa content treated strictly as data, never as instructions (prompt-injection via scraped pages blocked)
- [ ] **TOOL-10** — Tools are real — DevTools on the chat page shows real network activity when a tool fires
- [ ] **TOOL-11** — Graceful in-character fallback when any tool errors ("research tool is having a moment — ask me about my background instead")

### Safety, Cost & Abuse Controls (SAFE)

- [ ] **SAFE-01** — Haiku input classifier runs synchronously as preflight on every user message (not a tool Sonnet chooses to call)
- [ ] **SAFE-02** — Classifier output routed: `normal` → main agent; `injection` → in-character deflection; `offtopic` → redirect to what the agent can do; `sensitive` → compensation→email redirect
- [ ] **SAFE-03** — Classifier returns `{label, confidence}`; borderline (<0.7) routed to clarify template
- [ ] **SAFE-04** — Hard daily spend cap in code (default $3/day) tracked in Upstash Redis; above threshold, `/api/chat` returns graceful "come back in a few hours" message
- [ ] **SAFE-05** — Per-IP rate limit: 20 messages / 10 min, 60 messages / day (using Vercel `ipAddress()` helper, not raw `X-Forwarded-For`)
- [ ] **SAFE-06** — Per-email rate limit: 150 messages / day
- [ ] **SAFE-07** — Per-session rate limit as a safety net on top of IP + email
- [ ] **SAFE-08** — Token-cost-based rate limiting (not just message-count) so a single abusive session can't stay at "1 message" while costing 30x
- [ ] **SAFE-09** — Spend-cap check runs BEFORE the Anthropic API call, not after
- [x] **SAFE-10** — System-prompt hardening refuses persona change, refuses instruction override, refuses to reveal system prompt or KB verbatim (defense-in-depth alongside classifier)
- [ ] **SAFE-11** — System prompt never contains dynamic content (no timestamps, session IDs, per-request data) — cache integrity preserved
- [ ] **SAFE-12** — Anthropic org-level spend limit set matching the code-level cap (operational task before any public URL)
- [x] **SAFE-13** — Cloudflare Turnstile feature-flagged and wired but OFF — ready to flip in <10 minutes if abuse is observed
- [ ] **SAFE-14** — No `NEXT_PUBLIC_` prefix on secrets; pre-commit hook scans for accidental secret leaks
- [ ] **SAFE-15** — Stop-sequence on duplicate-arg tool calls prevents tool-call infinite loops

### Admin & Observability (OBSV)

- [ ] **OBSV-01** — Admin dashboard at `/admin` gated by Supabase Auth + GitHub OAuth provider (free)
- [ ] **OBSV-02** — Admin email allowlist enforced at API/middleware layer, not just UI
- [ ] **OBSV-03** — Sessions table view: last 100 sessions with email, domain, timestamp, flag column, sortable by date/domain
- [ ] **OBSV-04** — Transcript viewer: click a session → full conversation with tool-call traces rendered inline
- [ ] **OBSV-05** — Cost tracker: rolling 24h / 7d / 30d Anthropic spend; per-tool breakdown; prompt-cache hit rate
- [ ] **OBSV-06** — Abuse log: classifier-flagged messages + rate-limit hits with hashed IP and email
- [ ] **OBSV-07** — Tool health: ping endpoint status (Anthropic / Exa / Supabase / Upstash) green/yellow/red
- [ ] **OBSV-08** — Per-session email notification to Joe when a recruiter starts chatting; company-domain (non-free-mail) subject-line priority flag
- [ ] **OBSV-09** — Alarm email on hard spend-cap trigger, error rate >2% over 10min, any dependency down, ≥5 unique IPs hitting rate limits within an hour
- [ ] **OBSV-10** — `/api/health` endpoint returns per-dependency status for the framing-page status banner
- [ ] **OBSV-11** — Status banner on framing page: yellow if any dependency is degraded (e.g., "Company-pitch tool temporarily offline, everything else works")
- [ ] **OBSV-12** — Plain-HTML fallback at the same URL: if `/api/chat` returns 500, recruiter sees a static snapshot of Joe's background + direct-email CTA
- [ ] **OBSV-13** — External synthetic monitor (BetterStack or UptimeRobot) pinging from outside Vercel to catch Vercel-originated outages
- [ ] **OBSV-14** — Scheduled jobs via `cron-job.org` (free, unlimited): pre-warm heartbeat every 5 min during business hours to keep prompt cache + Supabase warm
- [ ] **OBSV-15** — Session transcripts retained 180 days hot, then archived to cold storage indefinitely; captured emails retained indefinitely; classifier flags 90 days
- [ ] **OBSV-16** — Pino structured JSON logging (no pino-pretty transports in prod) to Vercel logs for server-side events

### Eval Suite (EVAL)

- [ ] **EVAL-01** — Eval harness (`npm run eval`) runs ~40 cases in parallel against a preview deploy; completes in 3-5 min; costs ~$0.50-1.00 per run
- [ ] **EVAL-02** — Category 1 (factual fidelity): 15 cases; LLM-judge using a non-Sonnet model + deterministic name-token allow-list check; 15/15 hard gate; zero tolerance for fabrication
- [ ] **EVAL-03** — Category 2 (tool-use correctness): 9 cases covering happy-path, edge-case, and graceful-failure for each of the three tools; all happy paths pass; failures degrade gracefully
- [ ] **EVAL-04** — Category 3 (persona): 6 cases covering jailbreak attempts, disparagement bait, identity-swap, compensation questions; all pass; refusals read warm
- [ ] **EVAL-05** — Category 4 (voice fidelity) — blind A/B test: 5 agent responses + 5 real Joe paragraphs shuffled; friend-tester identifies AI responses at <70% to pass
- [ ] **EVAL-06** — Category 4 (voice fidelity) — LLM judge: non-Sonnet model scores responses against `voice.md` rubric (cadence, register, opinion-density); ≥4.0 average threshold
- [ ] **EVAL-07** — Category 5 (abuse resilience): 6 cases covering rate-limit trigger, OWASP LLM01 jailbreak corpus (DAN, grandma, academic-paper, Base64, ASCII-art, translation), system-prompt extraction; all pass
- [ ] **EVAL-08** — Category 6 (UX smoke): Playwright checks for email gate validation, all three tool buttons fire correct tools and render output, trace panel toggles, plain-HTML fallback renders under induced 500, admin negative-auth test (non-admin GitHub account → 403)
- [ ] **EVAL-09** — CI blocks promote-preview-to-prod if any eval regresses
- [ ] **EVAL-10** — Synthetic spend-cap test (mock Redis past threshold) included in eval suite
- [ ] **EVAL-11** — Weekly scheduled eval run to catch drift from KB edits, LLM version shifts, or Exa data drift
- [ ] **EVAL-12** — Human baseline calibration monthly against LLM-judge results (detect judge drift/self-preference)
- [ ] **EVAL-13** — Judge model pinned to specific version ID; changes require explicit calibration re-run
- [ ] **EVAL-14** — Eval results stored in Supabase with run-id, pass/fail per case, and surface in `/admin/evals/<run-id>`

### Launch (LAUNCH)

- [ ] **LAUNCH-01** — Deployed to Vercel with a memorable public URL (subdomain of Joe's personal domain or dedicated domain)
- [ ] **LAUNCH-02** — QR code generated from the final URL, printed on paper resume
- [ ] **LAUNCH-03** — URL link added to digital resume (PDF, LinkedIn, personal site)
- [ ] **LAUNCH-04** — Friend-test completed: 3 testers including ≥1 PM and ≥1 non-PM; non-PM must answer "feels substantive, not gimmicky" as yes; any "that's awkward" issues fixed before launch
- [ ] **LAUNCH-05** — All EVAL-* requirements verified as currently passing against the production deploy before resume link goes live
- [ ] **LAUNCH-06** — Pre-launch checklist walked: `resume.md` final, guardrails Joe-signed, all EVAL cat 1 + cat 4 passing, friend-tests complete, admin dashboard verified with a real transcript
- [ ] **LAUNCH-07** — Preview-to-prod promotion only via Vercel preview with eval suite green; no direct-to-prod deploys

---

## v2 Requirements (deferred)

- **OBSV-D1** — Daily digest email (9am) with session count, unique emails, top 3 questions, abuse flags
- **OBSV-D2** — Weekly question-clustering job (Haiku-assisted semantic clustering) to surface KB gaps
- **OBSV-D3** — End-of-session optional feedback prompt ("Was this useful? Anything Joe's agent should do better?")
- **CHAT-D1** — 1-hour extended-cache beta evaluation (decide after first week of real traffic data)
- **LAUNCH-D1** — Custom domain beyond Vercel subdomain (if Joe wants one)

---

## Out of Scope (v1 — explicit exclusions with reasoning)

- **Mobile-optimized UX** — Responsive baseline only; recruiter flow is desktop-first.
- **Full WCAG accessibility audit** — Baseline semantic HTML + keyboard nav only; full audit deferred.
- **i18n / multi-language** — English only; audience is US/Western recruiters.
- **Voice / audio chat** — Text only; scope creep and infra cost not justified; creepy on first recruiter contact.
- **Image generation / upload** — Scope creep; no user need in this flow.
- **CSV / dataset upload tool** — Finicky UX; overlapping with metric tool demonstration; parked.
- **Roadmap-critique tool, "interview me" tool** — Brainstormed and parked (spec appendix B); revisit post-launch if session feedback demands.
- **SMS notifications (Twilio)** — Email-only suffices at this volume.
- **Third-party identity enrichment (Clearbit/Apollo)** — Feels intrusive on first recruiter contact; "knowing uninvited = creepy."
- **Product analytics (PostHog/Amplitude/GA)** — Single conversion event; cookie banners harm the demo.
- **A/B testing framework** — One version at a time; ship, observe, iterate.
- **Full RAG / vector DB (pgvector, Pinecone)** — KB fits in a cached system prompt (<50k tokens); simpler wins at this scale.
- **Magic-link or password auth** — Friction for 2-minute demo; email-only gate is the correct primitive.
- **Day-1 CAPTCHA** — Turnstile available if abuse observed; not day one.
- **ORMs (Prisma/Drizzle)** — Schema is ~5 tables; `supabase-js` + generated types is enough.
- **Multi-user / team / white-label** — This is Joe's personal portfolio, not a SaaS product.
- **Talking-head avatar video / personality emoji layer** — Creepy, gimmicky, and uncanny-valley risk.
- **System-prompt / KB verbatim dump on request** — Agent refuses by design.
- **Self-rated match scores ("I am 92% a fit!")** — Cringe; undermines credibility.
- **Auto-generated downloadable cover letters** — Crosses line from demo to ops tool; out of scope.

---

## Traceability

Each v1 requirement is mapped to exactly one phase. Coverage: 94/94.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GATE-01 | Phase 1 | Pending |
| GATE-02 | Phase 1 | Pending |
| GATE-03 | Phase 1 | Pending |
| GATE-04 | Phase 1 | Pending |
| GATE-05 | Phase 1 | Pending |
| CHAT-01 | Phase 2 | Pending |
| CHAT-02 | Phase 2 | Pending |
| CHAT-03 | Phase 1 | Pending |
| CHAT-04 | Phase 1 | Pending |
| CHAT-05 | Phase 1 | Pending |
| CHAT-06 | Phase 2 | Pending |
| CHAT-07 | Phase 2 | Pending |
| CHAT-08 | Phase 2 | Pending |
| CHAT-09 | Phase 2 | Pending |
| CHAT-10 | Phase 2 | Pending |
| CHAT-11 | Phase 2 | Pending |
| CHAT-12 | Phase 2 | Complete |
| CHAT-13 | Phase 3 | Pending |
| CHAT-14 | Phase 2 | Complete |
| VOICE-01 | Phase 1 | Pending |
| VOICE-02 | Phase 1 | Pending |
| VOICE-03 | Phase 1 | Pending |
| VOICE-04 | Phase 1 | Pending |
| VOICE-05 | Phase 1 | Pending |
| VOICE-06 | Phase 1 | Pending |
| VOICE-07 | Phase 1 | Pending |
| VOICE-08 | Phase 1 | Pending |
| VOICE-09 | Phase 1 | Pending |
| VOICE-10 | Phase 1 | Pending |
| VOICE-11 | Phase 2 | Complete |
| VOICE-12 | Phase 1 | Pending |
| TOOL-01 | Phase 3 | Pending |
| TOOL-02 | Phase 3 | Pending |
| TOOL-03 | Phase 3 | Pending |
| TOOL-04 | Phase 3 | Pending |
| TOOL-05 | Phase 3 | Pending |
| TOOL-06 | Phase 3 | Pending |
| TOOL-07 | Phase 3 | Pending |
| TOOL-08 | Phase 3 | Pending |
| TOOL-09 | Phase 3 | Pending |
| TOOL-10 | Phase 3 | Pending |
| TOOL-11 | Phase 3 | Pending |
| SAFE-01 | Phase 2 | Pending |
| SAFE-02 | Phase 2 | Pending |
| SAFE-03 | Phase 2 | Pending |
| SAFE-04 | Phase 2 | Pending |
| SAFE-05 | Phase 2 | Pending |
| SAFE-06 | Phase 2 | Pending |
| SAFE-07 | Phase 2 | Pending |
| SAFE-08 | Phase 2 | Pending |
| SAFE-09 | Phase 2 | Pending |
| SAFE-10 | Phase 2 | Complete |
| SAFE-11 | Phase 1 | Pending |
| SAFE-12 | Phase 2 | Pending |
| SAFE-13 | Phase 2 | Complete |
| SAFE-14 | Phase 1 | Pending |
| SAFE-15 | Phase 2 | Pending |
| OBSV-01 | Phase 4 | Pending |
| OBSV-02 | Phase 4 | Pending |
| OBSV-03 | Phase 4 | Pending |
| OBSV-04 | Phase 4 | Pending |
| OBSV-05 | Phase 4 | Pending |
| OBSV-06 | Phase 4 | Pending |
| OBSV-07 | Phase 3 | Pending |
| OBSV-08 | Phase 4 | Pending |
| OBSV-09 | Phase 4 | Pending |
| OBSV-10 | Phase 3 | Pending |
| OBSV-11 | Phase 3 | Pending |
| OBSV-12 | Phase 3 | Pending |
| OBSV-13 | Phase 4 | Pending |
| OBSV-14 | Phase 4 | Pending |
| OBSV-15 | Phase 4 | Pending |
| OBSV-16 | Phase 3 | Pending |
| EVAL-01 | Phase 5 | Pending |
| EVAL-02 | Phase 5 | Pending |
| EVAL-03 | Phase 5 | Pending |
| EVAL-04 | Phase 5 | Pending |
| EVAL-05 | Phase 5 | Pending |
| EVAL-06 | Phase 5 | Pending |
| EVAL-07 | Phase 5 | Pending |
| EVAL-08 | Phase 5 | Pending |
| EVAL-09 | Phase 5 | Pending |
| EVAL-10 | Phase 5 | Pending |
| EVAL-11 | Phase 5 | Pending |
| EVAL-12 | Phase 5 | Pending |
| EVAL-13 | Phase 5 | Pending |
| EVAL-14 | Phase 5 | Pending |
| LAUNCH-01 | Phase 5 | Pending |
| LAUNCH-02 | Phase 5 | Pending |
| LAUNCH-03 | Phase 5 | Pending |
| LAUNCH-04 | Phase 5 | Pending |
| LAUNCH-05 | Phase 5 | Pending |
| LAUNCH-06 | Phase 5 | Pending |
| LAUNCH-07 | Phase 5 | Pending |
