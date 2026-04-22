# Resume Agent — Design Spec

**Author:** Joe Dollinger
**Date:** 2026-04-21
**Status:** Draft — pending user review

## Summary

A public, QR- and URL-linked chat agent attached to Joe's resume that lets hiring managers (a) ask questions about his background, and (b) invoke three agentic "superpower" tools that demonstrate PM thinking. The project itself is the portfolio artifact: the interaction *is* the evidence of Joe's ability to thoughtfully product-manage agentic AI.

Joe's background: 15 years in business intelligence, 6 years in product management. Target roles: data/analytics PM and senior/staff/leadership PM.

## Goals

1. Give a recruiter a distinctive, memorable 2-5 minute interaction that differentiates Joe from a PDF resume.
2. Demonstrate hands-on judgment with agentic AI — real tool use, real retrieval, real cost/abuse engineering — not just an LLM wrapper.
3. Produce three concrete agent-driven deliverables on demand: a company-tailored pitch, a narrated case study, and a PM-flavored metric framework.
4. Maintain >99% uptime during job-search window without creating financial or reputational risk.

## Non-goals

- Full replacement for Joe's resume or LinkedIn.
- Public chat open to the general internet (it's recruiter-facing, with a soft email gate).
- Mobile-optimized UX, full WCAG accessibility audit, i18n.
- Voice/audio chat, image generation, CSV/data upload tools.
- General LinkedIn-style networking features.
- A/B testing framework, product analytics platform integration.

## Audience & use cases

**Primary:** Technical and non-technical hiring managers, recruiters, and founders evaluating Joe for PM roles (especially data/analytics PM, senior PM, staff PM).

**Primary use cases:**
1. *Q&A proxy.* "What's Joe's experience with X?" → grounded answer from KB.
2. *Tailored pitch.* "I'm from Company X — why would Joe fit here?" → real-time research + tailored pitch.
3. *Case study narration.* "Walk me through a project" → structured first-person narration of a real past project.
4. *Metric design demo.* "How would you measure Y?" → PM-flavored metric framework as a structured deliverable.

**Secondary:** AI-savvy hiring managers evaluating Joe's agentic-AI judgment specifically — for them, the implementation details (tool tracing, cost controls, evals) are themselves the pitch.

## Section 1 — Recruiter's Journey

1. Recruiter scans QR on paper resume (or clicks link on PDF/LinkedIn/website) → lands on the agent page.
2. **Framing page** explains: "I'm Joe's agent. I know his background and can do three things most resume sites can't. Ask me anything, or try Pitch / Walkthrough / Metric Design." Includes the disclaimer: "This is an AI agent grounded on Joe's background, not Joe in real time."
3. **Soft email gate:** "Who are you? (So Joe can follow up if you're hiring.)" Email field only, no password, no magic link. Submitting unlocks chat. Joe is notified via email (see §6).
4. **Chat UI** with three visible "Try" buttons for the superpower tools, plus free-form input.
5. **Free chat** answers questions about Joe's background, cites specific projects/roles from the KB, refuses/deflects when it doesn't actually know (no fabrication).
6. **Pitch button** → prompts for company name (+ optional URL) → calls `research_company` → streams a 3-paragraph tailored pitch with live source links.
7. **Walkthrough button** → offers 4-6 case studies by one-line hook → recruiter picks one → agent narrates it in first person, ~400 words, with Context / Decision / Outcome / Retro structure.
8. **Metric Design button** → recruiter describes a feature or product → calls `design_metric_framework` → renders a structured card with commentary above.
9. **End-of-session feedback prompt** (optional, one-line): "Was this useful? Anything Joe's agent should do better?"
10. Throughout: a subtle "Joe gets notified when you chat" indicator — honest, and a product-thinking signal. Transcript + email are logged for Joe's review.

**Voice:** First-person as Joe ("I shipped X in 2023…"). Framing page carries the "this is an AI agent, not Joe" disclaimer. First-person is warmer and makes chat feel like a conversation with Joe; third-person narration is awkward in every sentence.

## Section 2 — Tech Stack & Architecture

### Stack

- **Frontend & hosting:** Next.js (App Router) on Vercel. TypeScript. Tailwind. Vercel AI SDK for streaming UI.
- **LLM provider:** Anthropic Claude. Sonnet 4.6 for the main chat loop; Haiku 4.5 for the input classifier and for the metric-framework sub-call. Prompt caching on system prompt + KB (~80% cost reduction after first hit).
- **Knowledge base:** Static markdown + YAML in a `kb/` folder, versioned in git. Total size under ~50k tokens — loaded directly into the cached system prompt every turn. No vector DB, no embeddings, no chunking. RAG deferred until (and if) the KB outgrows the context window.
- **Agent tools (function calls):**
  - `research_company(name, website?)` — backed by Exa or Brave Search API; fetches and summarizes recent news, product updates, open roles, leadership signals.
  - `get_case_study(slug)` — returns structured case study record from the KB. Redundant with the in-prompt KB but exposing it as a tool makes the agentic pattern visible in traces.
  - `design_metric_framework(description)` — wraps a Haiku sub-call with a PM-flavored prompt template; returns a structured object the UI renders as a formatted card.
- **Storage:** Supabase (Postgres + Auth). Stores sessions, transcripts, email captures, rate-limit counters, eval run history.
- **Admin auth:** Supabase Auth with GitHub OAuth provider (free). Admin-only email allowlist enforced at the route level.
- **Gate:** Email-only (no password, no magic link). Format validation + Supabase write + notification email to Joe.
- **Rate limiting & abuse controls:** Upstash Redis (token-bucket). Cloudflare Turnstile deferred until abuse is observed.
- **Observability:** Supabase for session/cost logs; Vercel logs for server errors; synthetic cron-based health checks pinging Anthropic, Exa, and Supabase.
- **Deployment:** Vercel preview → evals must pass → promote to prod. No direct deploys to prod.

### Architecture diagram (textual)

```
[Recruiter browser]
     |
     v
[Next.js on Vercel]  <-- Turnstile (only if abuse detected)
     |
     |-- /api/session  -> Supabase (create session, capture email, notify Joe)
     |-- /api/chat     -> Upstash rate limit
     |                    -> Haiku classifier (abuse/injection/topic check)
     |                    -> Anthropic Sonnet (streaming, with tools)
     |                        |
     |                        |-- tool: research_company -> Exa/Brave -> summarize
     |                        |-- tool: get_case_study   -> KB (in-prompt)
     |                        |-- tool: design_metric    -> Anthropic Haiku
     |
     +-- /api/admin    -> GitHub-OAuth-gated dashboard (transcripts, usage, evals)
     +-- /api/health   -> Dependency status endpoint (used by status banner)
```

### Architectural decisions

1. **Single-model + prompt caching beats RAG at this scale.** The full KB fits in one cached system prompt. Simpler, cheaper, higher quality than vector search. RAG is only on the table if the KB outgrows ~100k tokens.
2. **Tools are real tools.** `research_company` genuinely calls a web search API and reasons over fresh results. Any technically-inclined hiring manager who opens DevTools should see real network activity and real structured responses. The demo has to hold up to scrutiny.
3. **Input classifier before the main model.** Every user message runs through a cheap Haiku pre-check for abuse/injection/topic. Adds ~$0.0005/message and ~100ms latency; accepted as the cost of a safety net.

## Section 3 — The Three Superpower Tools

### Tool A — `research_company` (Pitch button)

**Trigger:** Recruiter clicks button or writes a variant of "I'm from X."

**Flow:**
1. Agent prompts for company name (+ optional URL) if not provided.
2. Calls `research_company(name, website?)`.
3. Tool queries Exa/Brave for recent news (90d), product updates, engineering/PM postings, leadership signals; fetches top 2-3 pages; returns structured JSON:
   ```
   { company, one_liner, recent_signals: [...], open_roles: [...], product_themes: [...], sources: [urls] }
   ```
4. Agent streams a 3-paragraph tailored pitch:
   - ¶1: Specific observations from the research (proves it's real).
   - ¶2: Concrete connections between the company's work and Joe's background (specific roles, projects).
   - ¶3: "If I were in the room next week, here's the first problem I'd want to dig into" — demonstrates POV, not just fit.
5. Source URLs rendered as footer, live clickable.

**Non-goals:** Not a cover letter. Not a resume rewrite. ≤300 words.

### Tool B — `get_case_study` (Walkthrough button)

**Trigger:** Recruiter clicks button or asks behavioral-style questions ("tell me about a time…").

**Flow:**
1. Agent presents a menu of 4-6 case studies by one-line hooks.
2. Recruiter picks one (button or free text).
3. Agent calls `get_case_study(slug)` → structured KB record (context, users, options, decision + reasoning, outcome + metrics, retro).
4. Narration: ~400 words, first person, subtle section markers (Context / Decision / Outcome / Retro) rather than heavy headers. Reads like a behavioral-interview answer, not a slide deck.
5. Ends with: "Want to go deeper on the decision, or hear a different story?"

**Guardrail:** Agent is prompted hard to refuse to narrate stories not in the KB; when asked about a nonexistent project, it says so plainly and offers the closest real one. This is the single most important honesty rule in the system.

### Tool D — `design_metric_framework` (Metric Design button)

**Trigger:** Recruiter clicks button or asks "how would you measure X?"

**Flow:**
1. Recruiter describes a feature, product, or business goal.
2. Agent calls `design_metric_framework(description)` — a Haiku sub-call with a rigid PM-flavored template returning:
   ```
   {
     north_star: { metric, why, formula },
     input_metrics: [...],
     counter_metrics: [...],
     guardrails: [...],
     proposed_experiment: { hypothesis, unit, mde, duration, risks },
     open_questions: [...]
   }
   ```
3. UI renders this as a **formatted card with labeled sections** — visually distinct from a normal chat bubble so it reads as a deliverable.
4. Sonnet adds a short commentary above the card: "Here's how I'd frame it. A few things I'd want to validate before committing: …" — this is where Joe's judgment shows.

**Why the sub-call:** Forces structure, prevents rambling, demonstrates orchestration (Sonnet routes, Haiku generates, Sonnet comments).

### Cross-cutting behavior (all three tools)

- **Trace visibility:** Collapsible "See what I did" panel under each tool result showing the tool call, arguments, and raw response.
- **Graceful failure:** Tool errors produce honest in-character messages ("The research tool is having a moment — try again, or ask me about my background directly"). No fake-it.
- **No reflexive chaining:** Agent calls tools when they'd help, not every turn. A simple bio question answers directly.

## Section 4 — Knowledge Base & Interview Capture

### KB structure

```
kb/
  profile.yml               # name, location, YoE, target roles, links, contact prefs
  resume.md                 # cleaned markdown of resume (source of truth for roles/dates)
  linkedin.md               # additional context not on resume
  github.md                 # repo list with one-line summaries; which are "real" vs. toy
  about_me.md               # personal layer — why PM, what energizes Joe, what he's
                            # looking for, interests outside work (400-600 words)
  management_philosophy.md  # opinionated, concrete beliefs about building teams,
                            # coaching, feedback, hiring, disagreement, org design
                            # (600-1000 words)
  voice.md                  # 8-12 short authentic writing samples the agent mimics
  stances.md                # 8-12 opinions/hot takes that are durably "Joe"
  faq.md                    # 15 canned answers: visa, remote, timezone, interests, etc.
  guardrails.md             # banned topics, banned behaviors, fabrication rules
  case_studies/
    killing-the-feature.md
    bi-migration.md
    onboarding-ab-test.md
    ... (4-6 total)
  brainstorm/
    case-study-candidates.md  # working doc: 8-10 candidates, pruned to 4-6
```

### Case study template

Each case study is YAML-fronted markdown following this template:

```yaml
---
slug: killing-the-feature
hook: "Killing a feature after 18 months of usage data"
role: "Senior PM, Analytics Platform"
timeframe: "2023 Q2 – 2024 Q1"
confidential: false   # if true, agent swaps names for placeholders
---

## Context
<business context, who the users were, what problem we thought we were solving>

## Options considered
- <option 1, why it looked attractive, why we didn't pick it>
- <option 2, ...>
- <option 3, ...>

## Decision & reasoning
<what we picked and the 2-3 key factors that tipped it>

## Outcome
<quantified where possible, specific where not>

## Retrospective
<what I'd do differently — this is the "senior" tent pole of the whole story>

## Likely recruiter follow-ups (and my answers)
- Q: <...>
  A: <...>
```

### Brainstorming template (`case-study-candidates.md`)

```
## Candidate: <working title>
- **Role / timeframe:**
- **One-line hook (what a recruiter would remember):**
- **Why this one? (what skill or trait does it showcase):**
- **Rough outcome (numbers if available, qualitative if not):**
- **Confidentiality concerns:**
- **Freshness (how recent):**
```

**Coverage rubric** (applied when pruning from 8-10 to 4-6):
- At least one failure or killed project
- At least one leadership-without-authority story
- At least one data-rooted decision
- At least one cross-functional conflict
- At least one story showing recent (<2y) work
- At least one longer-arc (>12 month) story

### Content acquisition plan (Mode 3 — hybrid)

1. **Selection session (~30 min):** Working session between Joe and Claude to produce the `case-study-candidates.md` file with 8-10 candidates, then prune to 4-6 using the coverage rubric.
2. **Interview sessions (4-6 × ~45 min):** One Claude-led interview per chosen case study. Claude asks 15-20 probing follow-up questions, then drafts the case-study markdown. Joe edits to taste.
3. **Voice interview (~30 min):** Dedicated recorded/transcribed session where Claude asks voice-eliciting prompts (e.g., "what annoys you about the way most teams use OKRs?"). Transcript becomes seed material for `voice.md` and 2-3 stances.
4. **Self-authored content (~4-6h):** Joe writes `about_me.md`, `management_philosophy.md`, stances, FAQ, and guardrails directly (with optional Claude assist).
5. **Voice-pass edits:** After all case studies drafted, a final pass ensures each reads in Joe's voice rather than corporate register.

**Total Joe time investment:** ~10-14 hours spread over 1-2 weeks.

### Voice defense — four-layer stack

The "sounds like generic ChatGPT" risk is the single largest quality risk. Mitigated with four compounding layers (see §7 for the eval that verifies it).

**Layer 1 — Authentic voice samples.** `voice.md` must pull from Slack DMs, texts, unfiltered emails, voice-memo transcripts, beta feedback, unpolished drafts — *not* from PRDs or LinkedIn posts. Target 8-12 short samples (2-4 sentences) spanning casual, decisive, annoyed, curious, and teaching registers.

**Layer 2 — Negative tonal directives in system prompt.** Enumerated anti-patterns in plain language:
- Never open with "Great question" or any compliment to the asker.
- Banned vocabulary: leverage, robust, comprehensive, holistic, synergy, align (verb), drive (verb).
- No bulleted lists unless explicitly asked for a list.
- No markdown headers in chat replies.
- Always use contractions.
- Take positions; "I think X" not "some people might argue X."
- Say "I don't know" — never "it depends."
- Vary sentence length deliberately.
- Default to <120 words per reply; go longer only when the user asks for depth.

**Layer 3 — Stances as actual opinions.** Each entry in `stances.md` must take a position a reasonable PM could disagree with. Test: "Could a senior PM I respect read this and say 'I disagree'?" If no → rewrite or cut. Examples:
- ❌ "Measurement matters at every stage."
- ✅ "Most teams instrument too early. Before 50 users, dashboards are a way to feel busy. I'd rather have 10 qualitative interviews than a funnel."

**Layer 4 — Case studies in voice, not register.** Drafts should read like stories told to a trusted peer, not performance-review prose. Grammar cleanup happens after; rawness doesn't survive being added in later.

### Pre-launch KB checklist (definition of done)

- [ ] `profile.yml` complete
- [ ] `resume.md` fully transcribed with no gaps
- [ ] `linkedin.md` has supplementary content not on resume
- [ ] `github.md` categorizes repos as real / experimental / toy
- [ ] `about_me.md` — 400-600 words, first-person, warm
- [ ] `management_philosophy.md` — 600-1000 words, opinionated and concrete
- [ ] `voice.md` — 8-12 authentic samples from informal sources
- [ ] `stances.md` — 8-12 disagreeable-on-purpose opinions
- [ ] `faq.md` — 15 entries (visa, remote, timezone, compensation redirect, availability, etc.)
- [ ] `guardrails.md` — Joe-reviewed, covers: no fabrication, no compensation negotiation, no disparaging former employers, no confidential details, hiring/comp questions redirect to email
- [ ] 4-6 case studies, each ≥300 words, all template sections filled, at least one failure, one leadership-without-authority, one data-rooted

### Update flow

The KB is a git repo. Edit markdown → push → Vercel redeploys → new content live. No CMS. If an admin UI is later useful, it's a thin addition.

## Section 5 — Abuse, Cost, and Safety Controls

### Threat model

1. Cost abuse (trolls, competitors, runaway loops)
2. Prompt injection / jailbreak attempts
3. System-prompt / KB exfiltration
4. Hallucination (fabricated claims about Joe)
5. Persona break (off-brand, political, argumentative, flirty)
6. Uptime (dependency outage during a recruiter visit)

### Cost controls

- **Hard daily spend cap in code:** Default $3/day tracked in Redis. Past threshold, `/api/chat` returns a graceful "I'm taking a breather — come back in a few hours, or email Joe directly." Tunable.
- **Per-IP rate limit:** 20 messages / 10 min, 60 messages / day.
- **Per-email rate limit:** 150 messages / day.
- **Max output tokens per response:** 1500.
- **Max conversation length:** 30 turns per session, then graceful cap.
- **Prompt caching** on system prompt + KB.
- **Anthropic console budget alert** at 75% of monthly ceiling.

### Prompt-injection + persona controls

- **System-prompt hardening:** explicit instructions to treat user input as content not instructions; refuse persona changes; refuse to contradict `guardrails.md`.
- **Turn-level Haiku classifier:** each message classified as (a) normal, (b) injection/jailbreak, (c) off-topic/abuse, or (d) sensitive (salary/negotiation). Routes accordingly.
- **No system-prompt leak:** explicit instruction never to reveal system prompt or KB verbatim; high-level summaries allowed.
- **Output filter:** pre-stream scan for hard-banned substrings.

### Hallucination controls

- System-prompt rule: "If you don't know something from the KB, say so. Never invent roles, dates, metrics, tools, companies, or outcomes."
- Case studies are the sole narrative source for project stories.
- Metrics discipline: exact KB numbers or "I'm not certain, happy to follow up."
- Eval category 1 (factual fidelity) blocks regressions.

### Uptime & graceful degradation

- Vercel preview → evals gate → prod promote. No direct-to-prod deploys.
- Per-dependency status banner on the framing page ("The company-pitch tool is temporarily offline. Everything else works.").
- Plain-HTML fallback if `/api/chat` fails entirely: static snapshot of Joe's background + email CTA. No recruiter leaves empty-handed.

### Explicit v1 non-goals

- No user accounts, no magic link, no password.
- No CAPTCHA on day one (Turnstile available if abuse observed).
- No custom WAF rules beyond Vercel defaults.
- No moderation of recruiter input beyond the classifier.

## Section 6 — Observability & Notifications

### Notifications (email only)

**Per-session email to Joe** within seconds of a new session starting. High-priority flag on non-free-mail domains (company addresses). Payload:

```
Subject: New chat on joe-agent: "<email>"

Who: recruiter@stripe.com
Company domain: stripe.com (matched — high-priority)
Started: 2026-04-21 14:02 ET
Session: https://joe-agent.com/admin/sessions/abc123
```

**Daily digest email** (9am ET):
- Session count, unique emails, top 3 questions
- Classifier-flagged abuse attempts
- Spend-cap hits

**Alarm email:**
- Hard spend cap triggered
- Error rate >2% over 10 min
- Dependency (Anthropic / Exa / Supabase) down
- ≥5 unique IPs hitting rate limits in an hour

### Admin dashboard (`/admin`)

GitHub-OAuth-gated (via Supabase Auth GitHub provider, free), admin email allowlist enforced. Single page, audience of one. Sections:

1. **Sessions table** — last 100 sessions, sortable. Click row → full transcript with tool-call traces inline. Star/flag for reference.
2. **Cost tracker** — rolling 24h/7d/30d spend, per-tool breakdown, prompt-cache hit rate.
3. **Question clusters** — weekly Haiku-assisted clustering of recent user questions to surface KB gaps.
4. **Eval status** — pass/fail from last deploy, history of runs.
5. **Abuse log** — classifier flags + rate-limit hits with IP/email.
6. **Tool health** — ping results against Anthropic, Exa, Supabase.

### End-of-session feedback prompt

One optional line at session close: "Was this useful? Anything Joe's agent should do better?" Inline, not modal. Low response rate is fine; the signal is gold and the presence of it is itself a PM-coded design choice.

### Analytics non-goals

- No PostHog/Amplitude/GA.
- No third-party identity enrichment (Clearbit, etc.) — both for cost and because surfacing "I looked you up" on first contact would feel icky.
- No A/B framework.

### Retention

- Transcripts: 180d hot, then cold storage indefinitely.
- Captured emails: indefinite (lead list).
- Classifier flags: 90 days.

## Section 7 — Evals & Launch Criteria

### Eval suite (~40 cases)

Runs on every deploy + weekly scheduled run. CI blocks promotion if anything regresses.

**Category 1 — Factual fidelity (~15 cases).** Tests that the agent never fabricates about Joe. Includes trap prompts about fictional projects; agent must refuse to play along. LLM-judge scoring. **Threshold: 15/15 must pass — zero tolerance for fabrication.**

**Category 2 — Tool-use correctness (~9 cases).** Each of the three tools has happy-path, edge-case, and failure cases. Structural checks (tool call fired, schema valid) + LLM-judge quality scoring. **Threshold: all happy paths pass; all failures degrade gracefully.**

**Category 3 — Persona (~6 cases).** In-character deflection on jailbreak attempts, disparagement bait, identity-swap attempts, and compensation questions. LLM-judge. **Threshold: all pass; refusals read warm, not robotic.**

**Category 4 — Voice fidelity (promoted to its own category).** Two tests:
- *Blind A/B with friend.* Show 5 agent responses + 5 real Joe paragraphs, shuffled. Friend must correctly identify the AI responses at <70% to pass.
- *LLM-judge against `voice.md`.* Rubric: does this match cadence, register, opinion-density of the voice samples? 1-5 scale. **Threshold: ≥4.0 average.**

**Category 5 — Abuse resilience (~6 cases).** Rate-limit triggers, jailbreak refusals, system-prompt-extraction refusals. Deterministic checks. **Threshold: all pass.**

**Category 6 — UX smoke tests (~5 cases).** Playwright: email gate validation, each "Try" button fires the right tool and renders output, trace panel toggles, end-of-session feedback renders and submits, plain-HTML fallback renders on 500. **Threshold: all pass.**

### Eval run mechanics

- `npm run eval` runs all cases in parallel against a preview deploy. ~3-5 min, ~$0.50-1.00 per run.
- Results written to `/admin/evals/<run-id>`.
- Promote-to-prod is gated on passing run.
- Weekly scheduled run to catch drift.

### Launch criteria (definition of "ready to put on resume")

**Must-have (hard blockers):**
1. KB pre-launch checklist (§4) complete.
2. All ~40 evals passing, including voice fidelity with blind A/B ≤70%.
3. Cost controls verified via synthetic spend-cap test.
4. Uptime monitoring pinging and alerting correctly.
5. Three human friend-testers (including ≥1 PM and ≥1 non-PM) have completed a session and given feedback; any "that's awkward" issues fixed.
6. Admin dashboard functional; Joe has reviewed at least one full friend-test transcript end-to-end.
7. `guardrails.md` personally approved by Joe.

**Nice-to-have (can ship without; add within 2 weeks of launch):**
- Daily digest email.
- Weekly question-clustering job.
- End-of-session feedback prompt.
- Plain-HTML fallback tested under induced 500s.

**Explicit v1 non-goals** (as in §2 and §5).

### Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Agent fabricates a fact about Joe in front of a recruiter | Med | Critical | Eval cat 1; strong KB-only sourcing rule; first-person discipline |
| 2 | Cost spike from abuse | Med | High | Spend cap + IP/email rate limits + Anthropic alerts |
| 3 | Sounds like generic ChatGPT | High (default) | High | Four-layer voice stack (§4); eval cat 4 as launch gate |
| 4 | Dependency outage during a high-value recruiter visit | Low | Med | Graceful degradation + plain-HTML fallback |
| 5 | Feels gimmicky / hurts more than helps | Med | Critical | Friend-test gate before launch; end-of-session feedback for iteration |

## Open questions

*(None at spec approval time. Joe has confirmed each section as it was presented.)*

## Appendices

### A — External services summary

| Service | Purpose | Pricing posture |
|---|---|---|
| Vercel | Hosting, serverless functions | Free tier |
| Anthropic (Sonnet 4.6, Haiku 4.5) | LLM inference | Pay-as-you-go, hard-capped at $3/day |
| Exa or Brave Search | Web research for `research_company` | Pay-as-you-go (TBD — pick cheaper on implementation) |
| Supabase | Postgres, Auth (GitHub OAuth), Storage | Free tier |
| Upstash | Redis for rate limiting + cost tracking | Free tier |
| Cloudflare Turnstile | Optional CAPTCHA | Free (deferred to post-launch if needed) |
| GitHub | Source of truth, OAuth provider | Free |

### B — Out-of-scope ideas (parked)

- CSV / data upload tool ("c" in the original brainstorm) — strong PM signal but finicky UX and overlapping with what the metric tool demonstrates; revisit if a specific role calls for it.
- Roadmap critique tool ("e") — might add post-launch if session feedback shows recruiters asking for it.
- Interview-me tool ("f") — clever but overlaps with Pitch; parked.
- SMS notifications via Twilio — email-only suffices for launch.
- Mobile-optimized UX.
- Custom domain beyond the Vercel subdomain or Joe's existing personal domain (decision deferred).

### C — Decision log (brainstorm summary)

1. **Delivery mechanism:** QR on paper resume, URL as backup. Hosted web chat is the demo itself.
2. **Purpose:** Hybrid — grounded Q&A backbone + three agentic tools.
3. **Target audience:** Data/analytics PM and senior PM roles, given Joe's 15y BI + 6y PM background.
4. **Tool set:** Pitch (a) + Walkthrough (b) + Metric Design (d). CSV data analysis (c) and Roadmap critique (e) parked.
5. **Content acquisition:** Mode 3 (selection session + 4-6 Claude-led interviews + voice interview + self-authored about/philosophy).
6. **Deployment posture:** Resilient — full rate limiting, graceful degradation, plain-HTML fallback, spend cap — to carry the narrative that PM judgment includes abuse- and cost-aware product decisions.
7. **Admin auth:** GitHub OAuth via Supabase (free).
8. **Notifications:** Email only.
9. **Voice fidelity:** Promoted to its own eval category with blind A/B launch gate.
10. **End-of-session feedback:** Included.
