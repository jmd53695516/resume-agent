# Project Research Summary

**Project:** Resume Agent
**Domain:** Public, persona-grounded streaming chat agent (LLM + tool use) tied to one person's reputation during an active job search
**Researched:** 2026-04-21
**Confidence:** HIGH overall (stack verified against primary sources; architecture verified against current SDK docs and issue trackers; features and pitfalls cross-referenced across 20+ postmortems and developer reports)

---

## Executive Summary

This is a **portfolio-by-demonstration** artifact, not a generic "chat with my resume" widget. Every engineering decision is double-duty: it serves the recruiter's information need *and* is itself the evidence being judged. The research converges on one structural conclusion — **the spec is essentially correct for 2026 and should not be re-litigated at the stack level**. Next.js App Router on Vercel, Anthropic Sonnet 4.6 (main) + Haiku 4.5 (classifier and metric sub-call), Supabase, Upstash, Vercel AI SDK v5, Exa for web research, shadcn/ui + Tailwind v4. The research fills gaps the spec left open (Zod, Resend + React Email, Pino, Vitest + Playwright, `cron-job.org` to get around Vercel Hobby's 1-cron limit, `@supabase/ssr` over the deprecated auth-helpers) but does not challenge a single locked-in decision. That means roadmap debate should be concentrated on **sequencing, content acquisition, and safety gates** — not technology selection.

The dominant risk profile is asymmetric and counterintuitive: the project is structurally cheap to run and trivially scales, but it is **one silent failure from killing its own premise**. Three failure modes stand out as unrecoverable: (1) fabrication about Joe's background (career-damaging, Air Canada precedent), (2) cost runaway from a prompt-cache regression or tool-call loop (the March 2026 Anthropic cache-TTL silent drop is a documented 10-20x cost scenario), and (3) voice that reads as generic ChatGPT (quiet failure — nothing errors, but the entire "I can engineer AI products" pitch is dead). These three dictate phase ordering: **content acquisition is the actual critical path** (engineering can't fix thin content later), **cost and abuse controls must land before any public URL exists**, and **eval cat 1 (fabrication) + cat 4 (voice, blind A/B, non-Sonnet judge) are hard launch gates** — not polish.

The recommended build shape is a single Next.js app with one hot path (`/api/chat`) that does preflight (rate limit + spend cap) → classifier (Haiku) → `streamText` with three tools → `onFinish` persistence. KB lives as static markdown frozen into a cached system prompt (no RAG — <50k tokens makes RAG strictly worse). All state splits two ways: Postgres for things that must be queryable (sessions, transcripts, token accounting), Redis for things that must be correct *right now* (counters). Everything else — admin dashboard, plain-HTML fallback, status banner, eval harness surfacing — is small engineering that contributes disproportionately to the portfolio signal for AI-savvy viewers. The architecture is smaller than it looks on a diagram; the discipline required to ship it without any of the three fatal failures is what separates this from a weekend widget.

---

## Key Findings

### Recommended Stack

The spec's pre-committed stack is validated without substitution. Research adds the supporting libraries the spec left at "TBD." Nothing needs to be re-argued at roadmap time — the toolchain is locked.

**Core (locked, do not re-litigate):**
- **Next.js 16.2 (App Router) + React 19.2 + TypeScript 5.7** — only credible 2026 default for streaming LLM UI on Vercel.
- **Vercel AI SDK v5** (`ai` + `@ai-sdk/anthropic`) — streaming + tool-calling + `useChat`; saves ~200 LOC vs. hand-rolled SSE; `providerOptions.anthropic.cacheControl` is the exact mechanism for prompt caching.
- **`@anthropic-ai/sdk` 0.90** — kept alongside AI SDK specifically for the Haiku classifier and the Haiku sub-call inside `design_metric_framework` (one-shot, non-streaming JSON).
- **Claude Sonnet 4.6** ($3/$15 per MTok) main agent; **Claude Haiku 4.5** ($1/$5) classifier + metric sub-call.
- **Supabase** (Postgres + Auth/GitHub OAuth for admin) — free tier comfortable; use **`@supabase/ssr`** (not the deprecated auth-helpers); use **`auth.getClaims()`**, never `getSession()` in server code.
- **Upstash Redis + `@upstash/ratelimit`** — only serverless-safe Redis option; HTTP-based works in edge runtime.
- **Exa** (not Brave) for `research_company` — embeddings-first search returns URLs + content in one call; $10 free credits; <1k total calls expected.
- **Tailwind v4** + **shadcn/ui** (vendored) — CSS-first config via `@theme` in `globals.css`.

**Supporting (spec gaps now filled):**
- **Zod 4** — schema validation for tool arguments and env vars; AI SDK's `tool({ inputSchema })` expects it.
- **Resend + React Email** — 3k/mo free tier; per-session and digest notifications to Joe.
- **Pino 9** — JSON-to-stdout structured logging; **no pino-pretty transports in prod** (Vercel worker-thread instability).
- **Vitest** (unit + eval harness) + **Playwright** (eval cat 6 UX smoke).
- **`cron-job.org`** (free) — unlimited scheduled jobs; Vercel Hobby allows only 1 cron, but the spec implies 3 (daily digest, health heartbeat, weekly clustering).
- **`nanoid`** for session IDs, **`date-fns`** for date handling, **`@tailwindcss/typography`** for case-study prose rendering.

**What NOT to use (research-confirmed traps):**
- No RAG, no pgvector, no Pinecone. KB fits in cache; RAG at this scale produces "snippets, not stories."
- No `@supabase/auth-helpers-nextjs` (deprecated).
- No `ioredis` / `redis` (break on serverless).
- No `NEXT_PUBLIC_` prefix on anything secret — ever.
- No magic-link / password auth for the gate; no day-one CAPTCHA.
- No product analytics pixels (single conversion event; cookie banner harms the demo).
- No ORMs (Prisma/Drizzle) — schema is ~5 tables; `supabase-js` + generated types is enough.

**Hosting caveat:** Vercel Hobby is non-commercial-only. For a personal job-search portfolio this is fine; if Joe ever monetizes the project, +$20/mo Pro upgrade.

### Expected Features

FEATURES.md cleanly separates three buckets. The roadmapper should treat this as **MVP scope is non-negotiable; differentiators are where portfolio signal lives; anti-features are explicit guardrails against scope creep.**

**Must have (table stakes — cutting any = no launch):**
- Framing page with "I'm an AI, not Joe" disclaimer visible without scroll
- Streaming chat + "thinking/tool-using" indicator
- Grounded-only answers with rewarded "I don't know" behavior
- Refusal of counterfactual prompts (never narrate fictional projects)
- Suggested starter prompts / tool buttons (empty-state discovery)
- First-person voice that actually reads as Joe (the four-layer defense)
- Graceful failure messages (never a silent error)
- Single-field email gate (no password, no magic link)
- **Real tools, not mocked** — DevTools should show real network activity
- Mobile viewable (not optimized)
- Structured KB by topic slug (not a single sprawling file)
- Live source citations on the pitch tool
- Accurate, grounded handling of "tell me about X project" (the behavioral-interview question)

**Should have (differentiators — these are what make this a portfolio piece, not a widget):**
- **D1 — Tool-call trace panel.** The single highest-leverage differentiator for AI-savvy viewers. Reference points are Cognition Devin, Decagon Trace View, LangSmith. Asymmetric payoff: non-technical viewers ignore it, technical viewers recognize it instantly. Reads off AI SDK v5 `tool-<name>` parts; no separate store.
- **D2 — Structured metric card rendered as UI (not markdown blob).** Makes the metric tool read as *deliverable*, not chat output. The "medium is the message" move for PM audience.
- **D3 — Voice fidelity (four-layer defense).** The differentiator that everyone else skips because the content work is hard. This is where Joe-time bottlenecks, not engineering.
- **D4 — Admin dashboard** (GitHub-OAuth-gated) with sessions/transcripts/cost/abuse log. Demonstrates "I instrument my own product" + gives Joe actual interview ammunition.
- **D6 — Plain-HTML fallback at the same URL.** Nobody builds this. Degraded-path thinking is a distinct PM signal.
- **D8 — Per-session email to Joe with company-domain priority flag.** Doubles as Joe's own lead-qualification workflow.
- **D9 — Tailored pitch that cites *specific recent* company signals.** Quality bar: recruiter thinks "it correctly cited our Series C last month," not "generic AI cover letter."
- **D10 — Eval suite surfaced publicly** (footer line mentioning "~40 evals run on every deploy"). Measurement discipline as portfolio signal.

**Defer (post-launch, within 2 weeks):**
- D5 end-of-session feedback prompt
- Weekly question-clustering job
- Daily digest email

**Cut under severe pressure (priority order is A→B→D):**
- If content acquisition slips, the metric-framework tool (Tool D) is the first to drop. Tool A (pitch) demonstrates external-research judgment; Tool B (case study) handles the #1 recruiter question; Tool D is beautiful but optional. **This ordering is a roadmap scope-change trigger.**

**Anti-features (explicitly do not build — scope creep killers):**
- Voice/audio chat, talking-head avatars (creepy on first recruiter contact)
- Bot "personality" emoji/enthusiasm layer
- Full RAG / vector DB
- Magic link, password, or day-one CAPTCHA
- Third-party identity enrichment (Clearbit/Apollo) — "knowing uninvited = creepy"
- Product analytics (single conversion event; cookie banner harms demo)
- A/B testing framework (one version at a time)
- SMS notifications (abuse cost vector)
- CSV upload / roadmap critique / "interview me" tools (parked)
- Auto-generated downloadable cover letters (crosses line from demo to ops tool)
- System prompt / KB verbatim dump on request
- Self-rated match scores

### Architecture Approach

A single Next.js app on Vercel. One durable HTTP surface (`/api/chat`) handles streaming; everything else is short-lived. All LLM work lives behind one "agent" module wrapping `streamText`. KB is flat markdown in git, loaded once per process at cold start and inlined into a **cached** system prompt (byte-identical between requests — any drift silently invalidates Anthropic's cache prefix). Two stateful dependencies only: Postgres (Supabase) for queryable state, Redis (Upstash) for ephemeral counters. No vector DB. No queue. No separate Python service.

**Major components:**

1. **Framing page + email gate** (`app/page.tsx`) — validates email, creates session, fires `waitUntil` notification to Joe. Never calls Anthropic directly.
2. **Chat UI + Trace Panel + Metric Card** (`app/chat/*`) — owns `useChat` hook; trace panel reads `message.parts.filter(p => p.type.startsWith('tool-'))`; metric card renders the structured `design_metric_framework` result as UI.
3. **`/api/chat` hot path** — orchestrates preflight (Upstash rate-limit + spend cap) → Haiku classifier → `streamText(Sonnet)` with 3 tools → `onFinish` persistence. Must be Node runtime (not Edge) for tool-using agents.
4. **`lib/` layer** — `anthropic.ts`, `supabase.ts`, `redis.ts`, `kb-loader.ts`, `system-prompt.ts`, `classifier.ts`, `tools/*`, `persistence.ts`, `notify.ts`. `app/` imports from `lib/`; `lib/` never imports from `app/`.
5. **Three tools** — `research_company` (Exa → top 2-3 → fetch → Haiku summarize → structured JSON); `get_case_study` (KB lookup by slug, already in memory); `design_metric_framework` (Haiku sub-call with rigid schema, returns structured JSON for card render).
6. **Admin dashboard** (`/admin/*`) — GitHub-OAuth-gated via Supabase Auth; sessions/transcripts/cost/abuse log/tool-health; allowlist enforced at middleware, not just UI.
7. **Health + fallback** (`/api/health`, static HTML fallback) — per-dependency pings; status banner on framing page; plain-HTML at same URL when `/api/chat` is 500ing.

**Load-bearing patterns to follow:**
- **KB frozen into the cached system prompt prefix.** Dynamic content (timestamp, session ID, anything per-request) *never* goes inside the cached block — belongs in the `messages` array. A single stray `Date.now()` in the system string kills cache hit rate and 10-20x's cost silently.
- **Classifier as synchronous preflight, not a tool.** If Sonnet could decide whether to call it, injection attacks would just ask it not to.
- **`stopWhen: stepCountIs(5)`** on `streamText` — safety cap, not an expected depth. Real turns use ≤2 tool calls.
- **Persist in `onFinish`, not during streaming.** Use the `usage` object for authoritative token counts and cost. Generate your own UUIDs; don't use AI SDK message IDs as primary keys (documented desync issue `vercel/ai#4845`).
- **`waitUntil` for email side effects** — recruiter must not wait on SMTP.
- **Read-only tools only.** All writes in `onFinish`. No side effects in tool `execute` functions.

**Anti-patterns research explicitly flags:**
- Edge runtime for `/api/chat` — tighter CPU, missing Node APIs Anthropic/Supabase SDKs reach for.
- Assuming the Anthropic 5-min prompt cache TTL helps at this project's traffic (3 visits/day spaced hours apart → every first turn is a cache miss). Plan the cost model for worst-case uncached first-turn; cache only helps on turns 2-N within a 5-min window. Consider the 1-hour extended-cache beta if cost actually matters.
- Persisting tool calls from streaming chunks (ID mismatch with `onFinish` reconciliation → duplicate/orphaned rows).

### Critical Pitfalls

The pitfalls research identified **four unrecoverable (critical)** failure modes and eight moderate ones. The four critical pitfalls are the project's real risk surface; everything else is cleanup.

1. **Fabrication about Joe's background** (career-damaging; Air Canada legal precedent applies). The system-prompt instruction profile of "warm + specific + first-person" is exactly what maximizes confabulation. Defenses: trap prompts in eval cat 1 (15/15 hard gate), deterministic name-token allow-list check (not just LLM-judge — self-preference bias hides regressions), slug-citation requirement, few-shot "I don't know" examples, non-Sonnet judge for fidelity evals.

2. **Cost runaway from tool loop or silent prompt-cache regression** (documented: Anthropic autocompacting loop Oct 2025; Anthropic cache-TTL silent drop March 2026 spiked costs 20-32%). Message-count rate limits don't help — a single abuse session or cache regression stays at 1 "message" while costing 30x. Defenses: **token-cost-based** rate limiting in Upstash (not message count); spend-cap check **before** the Anthropic call (not after); explicit `cache_control` TTL (never default); `cache_read_input_tokens` monitor with alarm if <70% for 3 consecutive calls; tool-call depth cap (3); stop-sequence on duplicate-arg tool calls; synthetic spend-cap test in the eval suite.

3. **Generic ChatGPT voice** (quiet failure — nothing errors, pitch dies). Defaults are corporate by construction. Defenses: voice samples from **unfiltered** sources only (Slack, texts, voice memos — LinkedIn/PRDs banned); explicit banned-vocab list ("leverage," "robust," "comprehensive," "holistic," "Great question," bullet-list fallbacks, unsolicited headers); stances must be disagreeable (test: "could a senior PM Joe respects read this and say 'I disagree'?"); case studies drafted **voice-first** (cadence baked in first draft — voice-passing at end never works); blind A/B friend test is the launch gate (<70% identification), not LLM-judge alone (self-preference bias); non-Sonnet judge model; response length cap (<120 words default).

4. **Prompt injection succeeds in front of a recruiter** (OWASP LLM01:2025; appears in >73% of 2025 production deployments; Chevrolet $1 Tahoe precedent). Defenses: Haiku classifier as preflight (not a tool Sonnet chooses to call); system-prompt refusal rule that does not depend on the classifier (defense in depth); hard rule against repeating system-prompt/KB/guardrails verbatim; eval cat 5 with current OWASP jailbreak corpus (DAN, grandma, academic-paper, Base64, ASCII-art, translation) refreshed quarterly; fetched Exa content treated as data not instructions; no "repeat/echo" capabilities; identity-swap refusal as first-line rule; classifier returns `{label, confidence}` with borderline (<0.7) routed to clarify template; Turnstile feature-flagged and ready to flip in <10 minutes.

**Moderate pitfalls (well-known mitigations exist):**
- Dependency outage during a high-value recruiter visit → plain-HTML fallback at same URL + per-dependency graceful degradation + synthetic monitor from outside Vercel.
- Gimmicky feel (portfolio chatbot reads as toy) → engineered framing copy (no "Meet my AI!" breathlessness); tool outputs must be screenshot-worthy PM deliverables; non-PM friend-tester has veto.
- Eval suite false confidence → human baseline calibration monthly; non-Sonnet judges; expand cases from real sessions; regression-on-real-transcripts weekly; version-pin judge models.

**Minor (technical hygiene):** env-var leak via `NEXT_PUBLIC_*` prefix; rate-limit bypass via spoofed `X-Forwarded-For` (use Vercel's `ipAddress()` helper); streaming truncation in prod (declare `maxDuration` explicitly; log `stop_reason`; Playwright long-response test); resume/KB drift (declare `resume.md` as SSOT; PDF generated from it).

---

## Cross-Cutting Tensions (Read This)

Where two dimensions disagree or where a pitfall threatens a differentiator. These need explicit handling in the roadmap, not hand-waving.

1. **"Warm + specific + first-person voice" (D3) structurally increases fabrication risk (Pitfall 1).** The voice defense and the fabrication defense pull in opposite directions. Resolution: both defenses must ship together; neither is optional. Voice without fabrication discipline = career-ending. Fabrication discipline without voice = generic ChatGPT. This is why eval cat 1 AND cat 4 are joint launch gates.

2. **Tool-call trace panel (D1) depends on real tools (T10) which depend on Exa content quality (D9).** Tracing fake calls is negative signal. A pitch tool that returns generic Exa filler reads as gimmicky (Pitfall 6). The quality of Exa's results for a given company is the load-bearing unknown — validate with real queries before committing the roadmap to Exa. If Exa quality is poor for Joe's target companies, Brave fallback must be swappable.

3. **Prompt caching is the cost model, but the traffic pattern defeats the cache.** 3 visits/day spaced hours apart means most sessions are cache-miss on turn 1 (Anthropic 5-min default TTL, dropped silently in March 2026). The 1-hour extended-cache beta exists but has higher write cost. Roadmap implication: **do not over-count cache savings in budget planning**; plan cost for worst-case uncached first-turn. Alternatively, use extended cache + pre-warm cron hitting a synthetic request during peak recruiter hours to keep the cache hot.

4. **Vercel Hobby's 1-cron limit conflicts with the spec's three scheduled jobs.** Use `cron-job.org` (free, unlimited) hitting protected API routes with a shared secret. Do not upgrade to Pro for this alone.

5. **Edge runtime helps cold starts (Pitfall 5) but breaks tool-using agents (Architecture Anti-Pattern 2).** Resolution: **Node runtime for `/api/chat`**; Edge only for `/api/health` and static surfaces. Accept ~1s cold start on first recruiter of the day; mitigate with a pre-warm heartbeat cron every 5 min during business hours.

6. **Admin dashboard is a differentiator (D4) AND the highest-privilege surface (critical security pitfall).** Allowlist enforcement must be at API middleware, not just UI. Supabase service-role key must never leave migrations/scripts. Include a negative auth test in eval cat 6 (non-admin GitHub account → 403).

7. **Email gate is deliberately soft (T9) but is also the rate-limit identity key.** Email alone is a weak identity (throwaways). Multi-key strategy required: per-IP (using Vercel's `ipAddress()`, not raw `X-Forwarded-For`) AND per-email AND per-session, PLUS a global rate limit as safety net.

---

## Implications for Roadmap

The architecture research's 9-phase ordering (P0 scaffold → P9 evals + launch) is a strong starting point. Research across all four dimensions agrees on one critical re-ordering: **cost and abuse controls must land earlier than they feel natural** — before any public URL exists, ideally right after the base streaming loop works. The reason: a 60-second public outage is recoverable; a single runaway-cost day burns two days of cap silently.

### Phase 1 — Scaffold + KB + System Prompt (foundation)

**Rationale:** Every downstream component depends on (a) the shell existing and (b) the system prompt being byte-identical between requests. Building the KB loader and system-prompt assembler with unit tests for determinism *before* any streaming code prevents the #1 silent cost trap (Pitfall 2).
**Delivers:** Next.js scaffold with TS/Tailwind/Vitest/Playwright; `.env.example`; Supabase + Upstash projects created; `kb/` with placeholder files; `lib/kb-loader.ts` + `lib/system-prompt.ts` with determinism tests; pre-commit secret-scanning hook.
**Addresses:** Table stakes T12 (structured KB); architecture pattern 1 (frozen-prefix caching); Pitfall 8 (env-var leak); technical-debt "hardcoded model string" (single config module from day 1).
**Avoids:** Cache invalidation from dynamic content in system prompt (Pitfall 2); later grep-and-replace pain on model version bumps.
**Watch-outs:** `resume.md` declared as SSOT for the resume (PDF generated from it) — addresses Pitfall 11 (KB drift).

### Phase 2 — Content acquisition (the real critical path)

**Rationale:** This is a Joe-time phase, not engineering. Content is the single largest bottleneck — engineering cannot fix thin voice samples or generic case studies later. Features research flags this as the critical path; pitfalls research flags voice-first drafting as the load-bearing quality move. Roadmapper should **schedule this in parallel** with Phases 1 and 3 — it is 10-14 hours of Joe time spread over 1-2 weeks.
**Delivers:** Populated `kb/` — `resume.md`, `profile.md`, `about.md`, `management-philosophy.md`, `voice.md` (from **unfiltered** sources — Slack DMs, texts, voice memos, unpolished drafts; LinkedIn/PRDs banned), `stances.md` (disagreeable positions), `faq.md`, `guardrails.md`, and 4-6 case studies drafted **voice-first**.
**Addresses:** T7/T14 voice + case-study Q&A (table stakes); D3 voice fidelity (differentiator); Pitfall 1 (fabrication — structured slugs enable citation discipline); Pitfall 3 (voice — the defense must be content-first, not engineering-first).
**Avoids:** The most common failure mode for portfolio chatbots — LinkedIn-register writing samples, voice-passed-at-the-end case studies, non-disagreeable stances.
**Watch-outs:** **This phase has no code deliverable.** Engineering phases do not block on it, but launch does. Mark it explicitly so it isn't skipped under sprint pressure.

### Phase 3 — Session + email gate (no chat yet)

**Rationale:** Proves out Supabase schema and the persistence layer without incurring any Anthropic cost. You can demo the landing-flow to a friend before a single LLM call exists.
**Delivers:** Supabase schema (`sessions`, `messages`); `/api/session`; `EmailGate.tsx`; framing page with engineered (not breathless) copy; `waitUntil` notification stub to Resend.
**Addresses:** T9 soft email gate; D8 new-session email + company-domain priority; D11 "Joe gets notified" honest disclosure.
**Avoids:** Pitfall 6 (gimmicky framing copy — landing tone is set here, not later).

### Phase 4 — Local-only chat happy path (base streaming loop)

**Rationale:** Prove the streaming loop works end-to-end with the real system prompt before adding the three largest integration risks (tools, classifier, spend cap). Lets content (Phase 2) be validated against real agent output early, which is essential feedback for voice tuning.
**Delivers:** `/api/chat` calls Sonnet via `streamText` with system prompt + messages (no tools, no classifier, no rate limit yet); `ChatUI.tsx` using `useChat` with thinking indicator; manual token counting in `onFinish`; assistant message persistence with own-UUID primary keys.
**Addresses:** T2/T3 streaming + thinking indicator; architecture patterns 5 (`onFinish` persistence), 6 (`waitUntil` for side effects).
**Avoids:** Pitfall 10 (streaming truncation — declare `maxDuration` explicitly, log `stop_reason`); AI-SDK ID desync (generate own UUIDs).

### Phase 5 — Cost + abuse controls (promoted earlier than intuitive)

**Rationale:** This phase must land **before Phase 6 (tools)**, not after. Tools are the largest cost vector; turning them on without the guardrails in place is a 20-minute-to-cap scenario. Pitfalls research is explicit: cost checks must run **before** the Anthropic call, not after. All four critical pitfalls are partially addressed here.
**Delivers:** `lib/redis.ts` with `checkRateLimits(ip, email, session)` and `incrementSpend(usdCents)`; token-cost-based rate limiting (not message-count); spend-cap preflight in `/api/chat`; Haiku classifier (`lib/classifier.ts`) as synchronous preflight; max output tokens + max conversation length enforced in code; graceful 429 deflection in-character SSE responses; explicit `cache_control` TTL on system prompt; `cache_read_input_tokens` logging.
**Addresses:** Pitfall 2 (cost runaway — all vectors); Pitfall 4 (prompt injection — classifier layer); Pitfall 9 (rate-limit bypass — use Vercel `ipAddress()` helper, multi-key strategy); architecture pattern 2 (classifier as preflight, not tool).
**Avoids:** Public-URL-ready before guardrails exist. This is a hard-dependency on not shipping.
**Watch-outs:** Synthetic spend-cap test (mock Redis counter past threshold) must pass in this phase, not deferred to eval phase.

### Phase 6 — Three tools + trace panel + metric card

**Rationale:** Largest integration risk; do it once the base loop is stable AND guardrails are live. The metric card and trace panel are the two highest-leverage differentiators; they must ship with tools, not be bolted on.
**Delivers:** `lib/tools/index.ts` with three tool modules; `research_company` (Exa + Haiku summarization with 90-day freshness filter); `get_case_study` (in-memory KB lookup); `design_metric_framework` (Haiku sub-call with rigid schema); `TracePanel.tsx` reading AI-SDK v5 tool parts; `MetricCard.tsx` rendering structured result as card (not markdown blob); tool-call depth cap of 3; stop-sequence on duplicate-arg calls.
**Addresses:** T10 real tools, T13 source citations, T14 case-study Q&A; D1 trace panel, D2 metric card, D9 tailored pitch with company signals.
**Avoids:** Pitfall 4 (fetched Exa content treated as data, not instructions); Pitfall 2 (tool-call loops — hard depth cap, not model self-limit).
**Watch-outs:** **Validate Exa result quality before committing.** Run `research_company` against Joe's top 10 target companies; if results are thin, switch to Brave (swappable design). This is a research flag — see below.

### Phase 7 — Persistence polish + health + fallback

**Rationale:** Small engineering, disproportionate portfolio signal. Can land any time after Phase 4. Pitfalls research: the status banner and plain-HTML fallback are the spec's degraded-path PM signal, not polish.
**Delivers:** Full `onFinish` pipeline (message rows, tool-call rows, token/cost fields, classifier verdict, latency_ms); session-ended handling; 180d hot + cold retention policy implemented; `/api/health` pinging all four dependencies; status banner on framing page; plain-HTML fallback at same URL under induced `/api/chat` 500; honest in-character tool-failure messages; retry w/ backoff on Anthropic 529 and Exa 502.
**Addresses:** T8 graceful failure; D6 plain-HTML fallback; Pitfall 5 (dependency outage during recruiter visit); pitfall integration gotchas (retry policy).

### Phase 8 — Admin dashboard + synthetic monitors

**Rationale:** Differentiator (D4) and cheap on free-tier stack. Not blocking for MVP demo to a single recruiter, but ships before public launch.
**Delivers:** Supabase Auth + GitHub OAuth; `/admin/sessions`, `/admin/costs`, `/admin/abuse`, `/admin/tool-health`; transcript viewer with trace replay; abuse log renderer (classifier-flagged categories); BetterStack/UptimeRobot synthetic monitor from outside Vercel; scheduled jobs via `cron-job.org` (daily digest, 5-min pre-warm heartbeat, weekly question clustering).
**Addresses:** D4 admin dashboard; D7 abuse log surfaced; keep-alive cron addresses Supabase 7-day auto-pause.
**Avoids:** Pitfall 5 (external monitor catches Vercel-originated outages Vercel itself can't see); security mistake (allowlist enforced at middleware, not just UI — include negative auth test in eval cat 6).

### Phase 9 — Eval harness + friend-test gate + launch prep

**Rationale:** Launch gate per spec §7. Eval cat 1 (fabrication) and cat 4 (voice fidelity w/ blind A/B) are hard gates; everything else can be iterative.
**Delivers:** ~40-case eval harness across 6 categories; non-Sonnet judge for voice + fidelity (Haiku or GPT-4o-mini); deterministic name-token check against `profile.yml` allow-list; blind A/B friend-test protocol (3 testers incl. ≥1 PM and ≥1 non-PM); human baseline calibration vs. LLM-judge; CI gate blocking promote-to-prod on fail; version-pinning on judge models; "Looks done but isn't" pre-launch checklist walked.
**Addresses:** Pitfall 1 (zero-fabrication launch gate); Pitfall 3 (voice fidelity gate); Pitfall 4 (injection corpus); Pitfall 7 (false-confidence mitigation via human baseline + non-Sonnet judge); D10 eval surfacing.
**Watch-outs:** Gimmickiness veto — non-PM friend-tester must answer "feels substantive" as yes. This is a human gate, not a scored one.

### Phase Ordering Rationale

- **Content acquisition runs in parallel, not sequentially.** It is the true critical path but has no code dependency on engineering. Schedule as a parallel track; do not block engineering phases on it, but do block launch on it.
- **Cost + abuse controls moved earlier than the architecture doc's original ordering.** Tools are the largest cost vector — turning them on without guardrails is not acceptable. Phase 5 (controls) precedes Phase 6 (tools).
- **Persistence polish + health + fallback (Phase 7) can float.** Once Phase 4 is done, Phase 7 can ship any time. Do not save it for the end — the fallback is pitched as a differentiator, not polish.
- **Admin dashboard (Phase 8) is not blocking for MVP demo.** You can demo to a single recruiter without it. Ship before public launch but not before first friend-test.
- **Evals + friend-test (Phase 9) is the launch gate.** Do not promote to prod without cat 1 (fabrication) 15/15, cat 4 (voice) blind A/B <70% ID, and a non-PM "feels substantive" yes.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 6 (tools) — Exa result quality for Joe's target companies.** Research recommends Exa over Brave for fit and cost (<1k calls expected), but this was a desk decision. Pilot Exa against Joe's actual top 10 target companies before committing; if results are thin, design for swappable Brave fallback. `/gsd-research-phase` recommended.
- **Phase 9 (eval harness) — non-Sonnet judge selection.** Pitfalls research flags self-preference bias as a load-bearing issue for voice/fidelity evals but leaves judge-model selection open. Candidates: Haiku 4.5 (cheap, same provider), GPT-4o-mini (cross-provider, better for self-preference mitigation), local model (free but complexity). Pilot in Phase 9 planning with a subset of eval cases.
- **Phase 2 (content acquisition) — voice sample extraction protocol.** Spec §4 Mode 3 names "selection session + Claude-led case-study interviews + voice interview," but the interview prompts themselves are not written. Worth a focused planning pass — this is Joe-time-expensive and cannot be redone cheaply.

Phases with standard patterns (skip research-phase; spec + research suffice):

- **Phase 1 (scaffold + KB loader)** — well-documented Next.js + Vitest patterns.
- **Phase 3 (session + email gate)** — standard Supabase schema + Resend transactional.
- **Phase 4 (base streaming loop)** — Vercel AI SDK v5 canonical pattern.
- **Phase 5 (cost + abuse controls)** — Upstash `@upstash/ratelimit` is the well-documented path; classifier is a single Haiku call.
- **Phase 7 (persistence polish + health + fallback)** — standard engineering.
- **Phase 8 (admin dashboard + synthetic monitors)** — standard Supabase Auth + external-monitor setup.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every spec decision verified against primary sources (Next.js 16 notes, AI SDK 5 blog, Anthropic docs, Supabase docs, Upstash docs, Vercel pricing). Versions current as of April 2026. Only open decision (Exa vs. Brave) resolved to Exa with rationale. |
| Features | HIGH | Cross-referenced 20+ sources across three feature-set categories (generic chat-with-resume widgets, developer-built digital twins, agentic-AI observability demos). Table stakes / differentiators / anti-features cleanly separated with cited reasoning. |
| Architecture | HIGH | Verified against AI SDK v5 release notes, Anthropic prompt-caching docs, AI SDK tool-calling docs, Vercel function limits, Upstash ratelimit docs. Integration gotchas cross-referenced against AI SDK GitHub issues (#2993, discussion #4845) and Vercel community threads. |
| Pitfalls | HIGH on technical; MEDIUM-HIGH on voice/UX | Technical pitfalls (cost runaway, prompt injection, streaming truncation, env leak) verified against real 2024-2026 incidents with citations (Air Canada, Chevrolet $1 Tahoe, Anthropic autocompacting loop, Anthropic cache TTL regression, CamoLeak CVE, Moffatt case). Voice and gimmickiness pitfalls synthesized from developer reports + writing-style articles; inherently subjective but cross-referenced enough to be actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- Exa result quality for Joe's specific target companies (pilot in Phase 6).
- Judge-model choice for voice/fidelity evals (pilot in Phase 9).
- Voice-interview protocol and content-acquisition interview prompts (Phase 2 planning).
- Trace-panel verbosity default (friend-test to validate).
- End-of-session feedback trigger (N-turns vs. `visibilitychange`).
- 1-hour extended-cache beta vs. default 5-min TTL (decide in Phase 5).
- Anthropic org-level spend limit (operational task before first public URL).

---

## Sources

Full source lists in STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md. Top signals synthesized here:

### Primary (HIGH confidence)

**Next.js / Vercel / Vercel AI SDK:** Next.js 16 release notes; AI SDK 5 blog; AI SDK Anthropic provider docs; AI SDK dynamic prompt caching cookbook; AI SDK Tool Calling reference; AI SDK streamText reference; Vercel Hobby plan limits; Vercel cron pricing; Vercel function limits; Streaming from serverless Node/Edge on Vercel.

**Anthropic:** Sonnet 4.6 launch; Haiku 4.5; prompt caching docs.

**Supabase / Upstash:** Supabase pricing, SSR docs, migration from auth-helpers; Upstash Ratelimit docs, ratelimit-js GitHub.

**Real-world incidents / pitfall evidence:** Moffatt v. Air Canada chatbot hallucination case; Chevrolet $1 Tahoe incident (Incident Database 622); Anthropic Claude Code autocompacting loop Oct 2025 (#9579); Claude Code usage-limit drain crisis March 2026 (The Register); Anthropic prompt cache TTL silent regression March 2026; OWASP LLM01:2025 Prompt Injection; Self-Preference Bias in LLM-as-a-Judge (arXiv 2410.21819).

### Secondary (MEDIUM confidence)

Feature landscape: Collardeau, Cusentino portfolio-chatbot retrospectives; Optimly persona-agent guide; Decagon Trace View; Cognition Agent Trace; Langfuse + AI SDK integration; Junia.ai LLM Default Voice; AI Competence uncanny valley of chatbot voice.

Architecture gotchas: AI SDK issue #2993 (onFinish persistence); AI SDK discussion #4845 (persisting messages, ID mismatch); Vercel community tool-execution unreliable thread; AI streaming cutoff local-vs-prod thread.

Stack alternatives: Exa vs. Brave comparison (Firecrawl); Zod v4 vs Valibot 2026 (Pockit); Pino structured logging for Next.js (Arcjet).

### Project-internal

- `.planning/PROJECT.md`
- `docs/superpowers/specs/2026-04-21-resume-agent-design.md`
- `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`

---
*Research completed: 2026-04-21*
*Ready for roadmap: yes*
