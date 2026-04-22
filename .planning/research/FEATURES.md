# Feature Landscape

**Domain:** Public hiring-manager-facing personal-representation agent tied to a PM's resume
**Researched:** 2026-04-21

## Executive framing

Three adjacent feature sets inform this project:
1. **Generic "chat with my resume" widgets** (ByAgentAI, Klyro, Dante AI, Streamlit portfolios, Chainlit bots). These set the table-stakes bar.
2. **Developer-built "digital twin" portfolio chatbots** (Cusentino, Collardeau, Syed — see Sources). These surface the real failure modes.
3. **Agentic-AI demos under evaluation** (ReAct traces, LangSmith/Langfuse observability patterns, Cognition Devin's trace UX, Decagon Trace View). These define what "impressive in 2026" looks like for the AI-savvy segment of Joe's audience.

Joe's project sits at the intersection of all three. Because the audience *is itself the evaluator of the agent's engineering*, feature decisions are load-bearing twice: they both serve the recruiter's information need and are themselves the artifact being judged.

A recurring theme across the sources: **guardrails and scope discipline are more important than clever prompts or flashy surfaces** (Cusentino). The portfolio chatbots that publicly "failed" confidently answered questions they shouldn't have. The ones that shipped well were narrow and honest.

---

## Table Stakes

Features users (recruiters) expect. Missing any of these and the demo feels incomplete, broken, or naive — and the agent *itself* is the portfolio, so "incomplete" reads as "this PM can't ship AI."

| # | Feature | Why expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| T1 | **Clear "I'm an AI agent, not Joe" framing on landing** | Every credible personal-agent post-mortem (Cusentino, Klyro docs, persona-agent guide) cites honesty about bot nature as non-negotiable. Framing belongs on the landing page, not buried in chat. | Low | Spec §1 already covers this. Text must be visible without scrolling. |
| T2 | **Streaming chat responses (token-by-token)** | Non-streaming LLM chat now reads as stale/broken in 2026. Users unconsciously benchmark against ChatGPT/Claude.ai latency. | Low | Vercel AI SDK native. |
| T3 | **"Thinking" / "Using tool" indicator during streaming** | Without it, 2-5 second tool-call latencies look like "is this hung?" Turns waits into signal. | Low | Vercel AI SDK `AI_STATE_THINKING` / typed tool parts handle this. |
| T4 | **Grounded-only answers with explicit "I don't know"** | The single largest documented failure mode: bot "confidently answered a personal question it didn't actually know" (Cusentino's rewrite moment). For a job-search agent, one fabricated claim is career-damaging. | Medium | Spec §5 and eval cat 1 already address. Prompt discipline + evals do the work. |
| T5 | **Refusal to narrate nonexistent projects / counterfactual prompts** | Trap prompts ("tell me about the time Joe led the Kubernetes migration at Google") must be refused cleanly, not glossed over with plausible-sounding prose. | Medium | Covered by spec §3 Tool B guardrail + eval cat 1. Load-bearing. |
| T6 | **Suggested starter prompts / pre-populated "Try X" buttons** | Empty-state best practice: "Empty states should actively suggest the next step, not leave users hanging" (NN/G, LogRocket). Recruiters in 7-30s attention windows (Ladders) won't formulate an opening question — they need rails. | Low | Spec §1 has three tool buttons; add 2-3 example Q&A starters too ("What's Joe's strongest leadership story?" / "Why a data-analytics PM?"). |
| T7 | **First-person voice, conversational register** | Third-person narration is "awkward in every sentence" (spec §1 already acknowledges). Also: a bot that writes PRDs at recruiters reads as RLHF-mid. | Medium | Handled by four-layer voice defense (§4). |
| T8 | **Graceful failure messages** (no silent errors) | Cusentino's "perfect chatbot wasn't one that never made mistakes, but one that handled its limitations gracefully." Spec §3 already covers. | Low | |
| T9 | **Email gate that is *genuinely* soft (single field, no password, no magic link)** | 2026 SaaS trend: "Users no longer want to provide their email just to 'Book a Demo'" (multiple sources). Field reduction 11→4 = +160% conversion. Single email field is near the minimum viable gate. | Low | Spec §2 aligned. Any heavier gate is a defect. |
| T10 | **Real working tools, not mocked** | "Any technically-inclined hiring manager who opens DevTools should see real network activity" (spec §2 already calls this out). Faked/stubbed tools in a demo built to demonstrate agentic judgment is a critical failure. | High | Real Exa/Brave API integration, real Haiku sub-call. |
| T11 | **Mobile viewability (not optimized, but not broken)** | Recruiters forward links. Someone will open on phone. A broken mobile layout on a PM's portfolio undercuts the whole premise. Spec out-of-scope says "responsive baseline only" — honor that baseline. | Low | Tailwind + sensible layout is enough. Do NOT promote to full mobile-optimized. |
| T12 | **Structured KB over freeform "stuff I want the bot to know"** | Every source emphasizes focused documents by topic, not sprawling single files (Optimly guide, Cusentino, Collardeau). Spec §4 structure matches best practice. | Low | |
| T13 | **Visible source links on web-research tool** | Citation-based transparency is the primary trust pattern for AI outputs in 2026. Claim without a link = suspicion. Live-clickable footer URLs on the pitch tool. | Low | Spec §3 Tool A has this. |
| T14 | **Accurate, grounded handling of "tell me about X project"** (the behavioral-interview question) | This is the single most common recruiter question in any hiring conversation. An agent that can't handle it well is disqualifying for Joe's specific use case. | Medium | Spec §3 Tool B + KB case studies is exactly this. |

### Anti-example that violated table stakes
McDonald's McHire / Olivia chatbot (2025): couldn't answer basic questions about the application process, which was its entire job. The lesson isn't "chatbots are bad" — it's that shipping a chatbot that fails at its core job is worse than shipping no chatbot. For Joe, the equivalent failure would be: the agent can't answer a behavioral question about one of the case studies it's supposed to know.

---

## Differentiators

Features that raise the quality bar meaningfully. Not expected — but each one is a genuine signal of product judgment. Build the ones that survive the cost/complexity filter.

| # | Feature | Value proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Tool-call trace panel ("See what I did")** | This is THE differentiating feature for the AI-savvy audience segment. Cognition Devin, Decagon Trace View, LangSmith traces are the 2026 reference points for "I take agentic engineering seriously." A collapsible inline trace shows: which tool fired, what arguments, what the tool returned. Non-technical viewers ignore it; technical viewers discover it and know immediately that the author understands the domain. Asymmetric payoff. | Medium | Spec already plans this. Design the trace readable, not a raw JSON dump — label sections (input args, tool output, reasoning). Consider a "copy as cURL" affordance for the most sophisticated audience. |
| D2 | **Structured metric-framework card (rendered UI, not a blob of markdown)** | Blob markdown = generic LLM output. Structured card with labeled sections (North Star / Inputs / Counters / Guardrails / Experiment) reads as *deliverable*, not chat. This is the spec's single strongest "the medium is the message" move for PM audience. | Medium | Spec §3 Tool D covers. UI render is the payoff — don't ship this tool without the card. |
| D3 | **First-person voice that actually sounds like Joe** (four-layer defense) | The "sounds like generic ChatGPT" risk is the single largest quality risk (spec §7 risk #3). Successfully clearing this risk IS the differentiator — it's what everyone else's personal-AI widget can't do because they skip the content work. Every source agrees: most portfolio chatbots fail here by using LinkedIn-register writing samples. | High (content work) | Joe-time investment is the bottleneck, not engineering. Spec §4 content plan is sound. Measure with eval cat 4 blind A/B. |
| D4 | **Admin dashboard with sessions/transcripts/cost/abuse log** | For the AI-savvy segment: demonstrates "I instrument my own product." For Joe directly: gives him actual ammunition in interviews ("17 recruiters have hit this, here's what they asked"). Signal compounds over time. | Medium | GitHub-OAuth-gated, free stack. Don't gold-plate; audience is one. |
| D5 | **End-of-session feedback prompt** | Low response rate is fine — the *presence* of it is the signal. "PM-coded design choice" (spec §6). Cheap to build, reads as obvious product-thinking. | Low | Inline, not modal. One line. Optional. |
| D6 | **Plain-HTML fallback when `/api/chat` fails** | Nobody builds this. Recruiter-in-the-moment degraded-path thinking is a distinct PM signal separate from everything else. Works even if the fallback is static bullet points of Joe's background. Mention it in the admin dashboard or in a "how this was built" footer for added signal. | Low-Medium | Vercel static + `getStaticProps` or similar. |
| D7 | **Prompt-injection / abuse classifier visible as a category in the admin log** | For AI-savvy hiring managers specifically: abuse log entries are evidence of defense-in-depth. An entry like "blocked: system-prompt exfil attempt from 1.2.3.4" is a more credible artifact than any PRD bullet. | Medium | Spec §5 Haiku classifier already covers. Just make sure the admin dashboard renders it legibly. |
| D8 | **New-session email with company-domain priority flag** | Turns the agent into Joe's own lead-qualification workflow. It's the "I instrument what matters" signal, and it has direct utility for Joe's job search (prioritize real-company emails over noise). | Low | Spec §6 covers. Domain matcher is <20 LOC. |
| D9 | **Tailored pitch that actually calls out specific recent company signals** (not generic) | 80% of hiring managers dislike AI-generated applications; 74% can spot them. The differentiator isn't "AI wrote a pitch" — it's "AI wrote a pitch that correctly cites our Series C last month." ¶1 citing specific recent signals is what separates this from a cover letter generator. | High | Spec §3 Tool A already prescribes this. Quality of Exa/Brave results is load-bearing — validate in evals. |
| D10 | **Eval suite existence, publicly referenced** | Mention in the admin dashboard and/or footer: "This agent runs ~40 evals on every deploy, including a blind voice-fidelity A/B." For AI-sophisticated viewers: proof of measurement discipline. Nobody expects this on a personal site, which is why including it is the signal. | Medium (build), Low (surface) | Spec §7 covers the build. The surfacing is the differentiator move. |
| D11 | **"Joe gets notified when you chat" honest disclosure** | Subtle indicator, not scary. Converts a mild "is this being logged" concern into a PM-judgment signal: "of course it's logged; I'm honest about it." | Low | Spec §1 covers. Wording matters — keep light. |
| D12 | **Warm "I don't know" handoff to email** | When the agent refuses or hits a scope edge, offer the email escape hatch ("that's a better question for Joe directly — email is X"). Every hallucination defense guide calls for human-handoff; few personal agents actually wire it. | Low | One line in the system prompt + a guardrail-category refusal template. |

---

## Anti-Features

Features to deliberately NOT build. Each has been brainstormed or is a common pattern in adjacent products but would hurt more than help in this specific context.

| # | Anti-feature | Why not | Do this instead |
|----|-------------|---------|-----------------|
| A1 | **Voice/audio chat (TTS of Joe's voice, STT input)** | High creepy-factor on first contact with a recruiter. Voice cloning is associated in public mind with fraud/scams. Spec out-of-scope correctly excludes. | Text chat with strong voice-in-writing. |
| A2 | **Avatar video of Joe / talking head** | Same creepy axis as voice. Also actively worse: talking-head avatars in 2026 signal "I built this with a no-code wrapper," not "I engineered this." Digital-twin family-legacy products are trending here; personal-hiring agents should not. | Photo of Joe as chat header; text responses. |
| A3 | **Gimmicky bot "personality" layered over Joe** (emojis, fake enthusiasm, "🚀 Great question!") | Spec §4 Layer 2 banned vocab catches most of this, but worth calling out explicitly. "Great question!" openings are universally recognized as LLM-tells; any one of them in front of a senior PM is a credibility tax. | Banned vocabulary list in system prompt. Enforced in eval. |
| A4 | **Full RAG with vector DB / embeddings** | KB is <50k tokens; in-prompt caching at ~80% hit rate outperforms RAG at this scale (fewer moving parts, better context, cheaper). Collardeau explicitly documents RAG chunking producing "snippets, not stories" for portfolio use cases. Spec §2 already decided this. | In-prompt KB with Anthropic prompt caching. |
| A5 | **User accounts / magic links / passwords** | Any auth heavier than a single email field pushes the conversion funnel below 50% (multiple SaaS-gating sources). This is a 2-minute demo; auth friction kills it. | Single email field. Session cookie for continuity. |
| A6 | **Day-one CAPTCHA** | Visible friction for the 99% of legitimate recruiters to defend against the <1% abuse case that hasn't materialized yet. Turnstile available as a later lever. Spec already right. | Spend cap + rate limits. Turnstile behind a feature flag for emergencies. |
| A7 | **Third-party identity enrichment (Clearbit, Apollo, etc.)** | Surfacing "I looked you up on the internet" on first contact is exactly the pattern cited across the CX literature as "bot knowing info uninvited = creepy." Net-negative. | Company-domain priority based on email-domain match only. |
| A8 | **Product analytics (PostHog, GA, Amplitude)** | Cookie banner alone hurts the demo before the first message. There's one conversion event (chat started). A single DB row in Supabase is sufficient. | Session row in Supabase with basic timings. |
| A9 | **A/B testing framework** | One audience, one version at a time. Ship, observe, iterate. Spec correctly excludes. | Observe via admin dashboard; iterate on content in git. |
| A10 | **SMS notifications via Twilio** | Volume doesn't justify cost, and even $0.01/msg creates a real abuse-cost vector ("SMS bomb Joe's phone"). Email to Joe is sufficient. | Email per new session. |
| A11 | **"Chat with my CSV" / data upload tool** | Brainstormed and parked. UX is finicky, overlap with metric tool is ~60%, and it opens abuse surface (user uploads 50MB file). Appendix B in spec. | Metric-design tool demonstrates the same analytical-PM signal. |
| A12 | **Roadmap critique tool** | Similar overlap issue; also triggers awkwardness ("your roadmap is bad, but here's mine"). | Pitch tool's ¶3 ("first problem I'd dig into") covers this use case. |
| A13 | **"Interview me" tool that asks the recruiter questions** | Inverts power dynamic at the wrong moment; feels like the candidate is being cute. | Session feedback prompt at the end is the right shape of this instinct. |
| A14 | **Open-ended "chat about anything"** without topic-classifier gating | Off-topic abuse and jailbreak surface. Also: if the agent will discuss the Israel-Palestine conflict, every recruiter who asks will assume those are Joe's views. Scope discipline matters. | Haiku classifier + warm in-character refusals, spec §5. |
| A15 | **Auto-generated cover letters the recruiter can download** | Crosses the line from "demo of agentic judgment" to "recruiter-facing ops tool." Hiring managers see 68% generic AI cover letters; being the source of one is -EV. | Pitch tool renders as chat response, not downloadable artifact. |
| A16 | **Comprehensive i18n / WCAG audit** | Audience is English-speaking US/Western recruiters; WCAG-full would be weeks for marginal gain. Semantic HTML baseline is enough. Spec excludes correctly. | Semantic HTML + Tailwind defaults. |
| A17 | **Heavy animation / "wow-factor" splash page** | Recruiter spends 30s-2min. Every second of splash eats the interaction budget. Every source: welcome screen must quickly communicate value, not entertain. | Minimal framing page, direct into chat. |
| A18 | **Sharing / public session transcripts** | Privacy problem (recruiter emails leaked) and abuse vector (screenshots weaponized). Keep sessions private to Joe. | Admin-only dashboard. |
| A19 | **Showing system prompt or KB verbatim when asked** | Obvious exfiltration vector. Agent should summarize at high level ("I have a resume, case studies, and a voice profile") but never dump. | Classifier category + system-prompt directive. |
| A20 | **"AI-detected: Joe is a strong match for Role X"-style confident scoring** | Overclaims what the agent can know. Self-rated match scores on a portfolio agent read as desperate. | Let the pitch tool's actual content speak. No score. |

---

## Feature Dependencies

Rough DAG for sequencing (roadmapper — these are hard dependencies, not suggestions):

```
                          ┌──> T7 First-person voice
                          │
KB content acquisition ───┼──> T14 Case-study Q&A
 (spec §4 Mode 3)         │
                          ├──> T5 Refusal/no-fabrication discipline
                          │
                          └──> D3 Voice-fidelity (four-layer)

Streaming chat (T2) ──> T3 Thinking indicator ──> D1 Trace panel
                    └─> T11 Mobile viewability (CSS only)

Real tools (T10) ──> D2 Metric card (needs structured schema)
                 ├─> D9 Tailored pitch (needs Exa/Brave wired)
                 └─> T13 Source citations

Email gate (T9) ──> D8 New-session email ──> D4 Admin dashboard
                                         └─> D11 "Joe gets notified" disclosure

Haiku classifier ──> T5 Refusal behavior
                 ├─> D7 Abuse log in admin
                 └─> A14/A19 avoided (by being gated)

D4 Admin dashboard ──> D10 Eval-status surfacing

T8 Graceful failure ──> D6 Plain-HTML fallback (deeper degradation)

Eval suite (all 6 categories) ──> gates launch
                              └─> D10 public mention
```

**Critical path (what has to work first):** KB content acquisition → real tools wired → four-layer voice → eval cat 1 (fabrication) + cat 4 (voice) passing. Everything else can slip without blocking launch; these four cannot.

**Things that look independent but aren't:**
- D1 (trace panel) depends on T10 (real tools) — tracing fake calls is negative signal.
- D3 (voice) depends on T7 (first-person) but ALSO on content quality in `voice.md` and stances; engineering can't fix thin content.
- D9 (tailored pitch quality) depends on whichever search API (Exa vs Brave) returns usable recent content; validate before committing.

---

## MVP Recommendation

If schedule forces cuts, the minimum viable launch is:

**Must ship (cutting these = no launch):**
1. T1 framing page with disclaimer
2. T2 streaming chat + T3 thinking indicator
3. T4, T5 grounded answers + refusal discipline
4. T7 first-person voice + D3 four-layer defense
5. T9 soft email gate
6. T10 real tools (all three, even if modest quality)
7. T13 source citations on pitch tool
8. T14 case-study walkthrough
9. Eval cat 1 (fabrication) + cat 4 (voice) passing

**Should ship (the differentiators that make it a portfolio piece, not a widget):**
- D1 trace panel
- D2 structured metric card
- D4 admin dashboard (even minimal)
- D8 new-session email to Joe
- D6 plain-HTML fallback

**Defer (can ship within 2 weeks post-launch):**
- D5 end-of-session feedback
- D10 public eval-status surfacing
- Weekly question-clustering job
- Daily digest

**Cut under severe pressure:**
- The metric-framework tool is the most complex of the three. If content-acquisition slips badly, the first thing to parachute-out is Tool D (not A, not B). A→B→D is the priority order because A demonstrates external-research judgment and B demonstrates core behavioral-interview Q&A, which is the #1 thing any recruiter will ask. D is beautiful but optional. This ordering is a change-in-scope trigger the roadmap should flag.

---

## Specific open questions for requirements-definition phase

1. **Should the three tool buttons be always-visible or surfaced contextually?** Literature is split — always-visible reduces discovery cost but crowds the framing; contextual is cleaner but risks recruiters never discovering them. Defaulting to always-visible but validate in friend-testing.
2. **How verbose should the trace panel be?** Minimum (function name + args + truncated output) vs. full (timing, token counts, prompt caching stats). Recommend minimum-by-default with a "show full" expand for the sophisticated segment. Don't auto-expand — full-trace noise hurts the non-technical viewer.
3. **Should the agent ever proactively offer tools?** ("Want me to look up your company?") Spec says "call tools when they'd help, not every turn." This is a good rule but mid-turn offers to invoke a tool are a UX pattern worth defining: preferred implementation is buttons appearing in-chat ("Research [Company]?" as a clickable affordance), not the agent asking.
4. **Does the "end-of-session" feedback trigger at N turns or on user-leave detection?** N=5 turns is a reasonable default; user-leave via `visibilitychange` is fragile but the signal is richer when it does fire. Start with N-turns, instrument, iterate.

---

## Sources

- [Building My Digital Twin — Thomas Collardeau](https://medium.com/@collardeau/building-my-digital-twin-the-making-of-a-portfolio-chatbot-3e7378993ea7)
- [I Built a Portfolio Chatbot (And Learned a Lot Along the Way) — Daniele Cusentino](https://www.danielecusentino.com/blog/articles/i-built-a-portfolio-chatbot-and-learned-a-lot-along-the-way/)
- [I Was Tired of Repeating Myself, So I Built an AI Version of Me — Areef Syed](https://dev.to/areef_syed_71a7be71fe79a3/i-was-tired-of-repeating-myself-so-i-built-an-ai-version-of-me-1hg7)
- [Build a Persona Agent for Your Portfolio — Optimly Docs](https://docs.optimly.io/blog/build-your-portfolio-persona-agent)
- [ByAgentAI — Resume to Website](https://byagentai.com/)
- [Turning Your Resume into an Interactive AI Chatbot — Akshay Kokane](https://medium.com/data-science-collective/turning-your-resume-into-an-interactive-ai-chatbot-using-chainlit-semantic-kernel-f83d762aa303)
- [Stop AI Agent Hallucinations: 4 Essential Techniques](https://dev.to/aws/stop-ai-agent-hallucinations-4-essential-techniques-2i94)
- [Trace View: AI agents shouldn't be black boxes — Decagon](https://decagon.ai/resources/decagon-trace-view)
- [Agent Trace: Capturing the Context Graph of Code — Cognition](https://cognition.ai/blog/agent-trace)
- [Observability and Tracing for the Vercel AI SDK — Langfuse](https://langfuse.com/integrations/frameworks/vercel-ai-sdk)
- [How Citation-Based AI Agents Build Enterprise Trust — Seekr](https://www.seekr.com/blog/how-citation-based-agents-build-trust/)
- [The Chat Crash — When a Chatbot Fails — Toptal](https://www.toptal.com/designers/ux/chatbot-fails)
- [Why chatbots fail — UX Collective](https://uxdesign.cc/why-chatbots-fail-2bb6e5ce1434)
- [Prompt Controls in GenAI Chatbots — NN/G](https://www.nngroup.com/articles/prompt-controls-genai/)
- [Empty states in UX done right — LogRocket](https://blog.logrocket.com/ux-design/empty-states-ux-examples/)
- [You have 7.4 seconds to make an impression — The Ladders](https://www.theladders.com/career-advice/you-only-get-6-seconds-of-fame-make-it-count)
- [Portfolio That Impresses AI Product Management Recruiters — Resumly](https://www.resumly.ai/blog/how-to-build-a-portfolio-that-impresses-ai-product-management-recruiters)
- [Only 17% of PMs Have a Portfolio — Aakash Gupta](https://aakashgupta.medium.com/only-17-of-pms-have-a-portfolio-heres-how-to-build-one-that-actually-gets-you-hired-3fed3e2f438a)
- [AI Digital Twins Raise High-Stakes Identity Risks — TechNewsWorld](https://www.technewsworld.com/story/digital-twins-and-the-risks-of-ai-immortality-180273.html)
- [UI guidelines – Apps SDK — OpenAI Developers](https://developers.openai.com/apps-sdk/concepts/ui-guidelines)
- [Chatbot Tool Usage — Vercel AI SDK UI](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-with-tool-calling)
- [Fooling AI Agents: Web-Based Indirect Prompt Injection — Palo Alto Unit 42](https://unit42.paloaltonetworks.com/ai-agent-prompt-injection/)
- [LLM01:2025 Prompt Injection — OWASP](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Best SaaS Landing Page Examples — Swipe Pages](https://swipepages.com/blog/12-best-saas-landing-page-examples-of-2026/)
- [McDonald's McHire / Olivia chatbot coverage — referenced via chatbot-failures analyses in sources above]
