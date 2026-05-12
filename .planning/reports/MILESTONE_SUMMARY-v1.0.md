# Milestone v1.0 — Resume Agent Project Summary

**Generated:** 2026-05-12
**Status:** In flight (98% complete) — production deploy LIVE at [joe-dollinger-chat.com](https://joe-dollinger-chat.com); final friend-tester sign-off + QR-code launch (Plan 05-12) remain.
**Purpose:** Team onboarding and project review

---

## 1. Project Overview

**Resume Agent** is a public, QR- and URL-linked chat agent attached to Joe Dollinger's paper and digital resume. Hiring managers scan or click, land in a gated chat, and can both ask Q&A about Joe and invoke three PM-flavored agentic tools: tailored company pitch (`research_company`), case-study walkthrough (`get_case_study`), and metric framework design (`design_metric_framework`). **The agent itself is the portfolio artifact** — interacting with it is the evidence of Joe's ability to product-manage agentic AI.

**Core value:** A recruiter in under five minutes walks away with a distinctive, specific impression of Joe — grounded in real projects, free of fabrication, and delivered by an agent they can see was engineered (not just prompted) with cost, abuse, and hallucination controls.

**Audience:** Hiring managers, recruiters, founders evaluating Joe for senior/staff PM and data/analytics PM roles. Secondary audience: AI-savvy hiring managers who can read the tool traces, eval suite, and cost controls as the pitch.

**Three unrecoverable failure modes that drove the entire roadmap ordering:**
1. **Fabrication** about Joe's background (career-damaging) → zero-tolerance eval cat 1 (15/15 hard gate)
2. **Cost runaway** from a single abuse spike → spend cap + multi-key rate limits before any tools
3. **"Generic ChatGPT" voice** → four-layer voice defense + blind A/B friend test as launch gate

**Current state:** 6 of 7 phases closed; Phase 5 at 12 of 13 plans complete. Production deploy verified end-to-end (cat1=15/15 + cat4=5/5 on prod URL). Plan 05-12 LAUNCH-* is awaiting Google-Form responses from 3 friend-testers (sent 2026-05-11) before final sign-off and QR-code activation.

---

## 2. Architecture & Technical Decisions

**Top-line stack:** Next.js 16 App Router on Vercel + TypeScript + Tailwind v4. AI SDK v6 wraps Anthropic Sonnet 4.6 (main agent) and Haiku 4.5 (classifier + tool sub-calls). Supabase Postgres + Auth (GitHub OAuth for admin). Upstash Redis for rate limits + spend counter. Exa for `research_company`. Resend + React Email for notifications. Pino for structured JSON logging.

**Foundational decisions** (with phase that locked them):

- **Single-model + prompt caching, no RAG** — KB (`kb/*.md` + `profile.yml`, <50k tokens) loads as a byte-identical system-prompt prefix with `cache_control: ephemeral`. Cold→warm cost drops ~50% on a 19,814-token prompt. *Why:* vector DBs add indexing complexity, chunking risk, and retrieval-quality failure modes for zero benefit at this scale. *Phase:* 1 (deterministic loader + tests).
- **Haiku classifier as synchronous preflight** — every user message hits Haiku 4.5 BEFORE Sonnet; outputs `{label, confidence}`; routes injection/offtopic/sensitive to in-character deflections at <$0 Sonnet cost. Borderline (<0.7) routes to clarify template. *Why:* tool-based gating would let Sonnet see the abuse before deciding to refuse. *Phase:* 2.
- **Spend cap checked BEFORE the Anthropic call** — `$3/day` hard cap in Upstash Redis; tripped counter returns a graceful "come back in a few hours" message without any LLM call. *Why:* "after the bill" is too late. *Phase:* 2.
- **Six-gate request order, cheapest-first** — daily-IP → 10min-IP → email → session → spend-cap → classifier, each in-character deflection on trip. *Why:* a request that's going to be denied should cost as close to $0 as possible. *Phase:* 2.
- **First-person voice ("I shipped X…") + upfront "I'm an AI, not Joe" disclaimer** — *Why:* third-person is awkward; warmth + clear disclaimer outperforms strict technical accuracy. *Phase:* 1.
- **Four-layer voice defense** — (a) authentic samples from informal sources only (no LinkedIn polish), (b) negative directives (banned vocab, no "Great question", no markdown headers), (c) opinion-density stances (8-12 disagreeable positions), (d) voice-first case studies. *Why:* generic ChatGPT voice was the single largest quality risk. *Phase:* 1 (content) + 2 (system-prompt enforcement).
- **AI SDK v6 native tool-call streaming + `prepareStep`** — tools (`research_company`, `get_case_study`, `design_metric_framework`) stream as `tool-input-available` SSE chunks rendered in a collapsible "See what I did" trace panel. `stopWhen: stepCountIs(5)`, depth cap of 3, duplicate-arg detection. *Why:* the trace IS the demo for AI-savvy reviewers. *Phase:* 3.
- **Read-only tools; writes only in `onFinish`** — tool `execute` functions never mutate state; the six-gate order persists in `onFinish` after the stream finalizes. *Why:* tool retries / partial failures cannot corrupt state. *Phase:* 3.
- **Exa over Brave for `research_company`** — embeddings-first search + 90-day freshness filter + single-call full-content fetch. *Why:* Brave requires URL-list-then-fetch (2 round trips); Exa returns content in one call. *Phase:* 3.
- **Graceful degradation + plain-HTML fallback** — `/api/health` returns HTTP 200 always (deps encoded in body); StatusBanner renders yellow on degraded deps; persistent `/api/chat` 500s redirect to `/?fallback=1` which serves a static markdown snapshot of Joe's background with email CTA. *Why:* recruiter on a broken agent is the worst-case outcome; never leave them empty-handed. *Phase:* 3.
- **Two-layer perimeter for admin** — `src/proxy.ts` middleware redirects unauth → `/admin/login`; `requireAdmin()` per page enforces the allowlist server-side (NOT just UI). `(authed)/` route group inheriting layout-level auth. GitHub OAuth via `supabase.auth.getClaims()` (NOT `getSession()` — validates JWT signature in server context). *Why:* a UI-only gate is no gate. *Phase:* 4.
- **Atomic email idempotency** — `UPDATE sessions SET email_sent_at = now() WHERE id = $1 AND email_sent_at IS NULL` returning affected-rows; only one row can win the race. *Why:* `after()` callbacks can fire twice on retries. *Phase:* 4.
- **Per-condition alarm suppression in Redis NX** — `resume-agent:alarms:fired:<condition> EX 3600`; firing one condition does NOT suppress others; fail-open on Redis throw (better over-fire than drop). *Why:* a stuck dep should not silence a spend-cap alarm. *Phase:* 4.
- **Heartbeat cron pre-warms prompt cache** — `/api/cron/heartbeat` runs every minute during business hours; refreshes Redis heartbeat keys (`heartbeat:anthropic`, `heartbeat:classifier`, 120s TTL) AND keeps the Anthropic ephemeral cache warm. ~$15/business-week at default cadence with 85k cached tokens. *Why:* cold cache = +0.07¢ per request × every recruiter. *Phase:* 4.
- **Two-layer prod gate** — Layer 1 = GH branch protection (blocks merge to `main` on eval failure). Layer 2 = Vercel Deployment Checks (blocks prod alias even if `main` has bad code). `enforce_admins=true` (Joe also subject). *Why:* defense-in-depth on the launch gate. *Phase:* 5.
- **Anthropic native forced tool-use for eval judge** — `messages.create({ tools: [...], tool_choice: { type: 'tool', name: ... }, strict: true, additionalProperties: false })` for structured-output judge calls. *Why:* `@ai-sdk/anthropic` `generateObject` had ~47% schema-validation flakiness; native strict tool-use is materially more reliable. *Phase:* 5 (quick task 260509-sgn).

---

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
| 1 | Foundation & Content | ✅ Closed | Next.js scaffold, deterministic byte-identical system-prompt loader, email-gated landing page, ~10-14 hours of Joe-time content (resume, profile, voice samples, stances, FAQ, guardrails, 4-6 case studies) populated. |
| 2 | Safe Chat Core | ✅ Closed | Streaming chat with Sonnet 4.6, Haiku 4.5 classifier preflight, $3/day Redis spend cap checked before Anthropic, multi-key rate limits (per-IP/per-email/per-session/token-cost), 30-turn cap, prompt-cache cold→warm verified live (14¢→7¢). |
| 3 | Tools & Resilience | ✅ Closed | Three agentic tools (`research_company` via Exa, `get_case_study`, `design_metric_framework` via Haiku 4.5 forced tool-use), TracePanel + MetricCard UI, `/api/health` + StatusBanner, plain-HTML fallback at `/?fallback=1`, `error.tsx` safety net. |
| 4 | Admin & Observability | ✅ Closed | GitHub-OAuth `/admin` (two-layer perimeter), sessions list → transcript viewer with `alwaysExpanded` TracePanel admin variant, cost tracker (24h/7d/30d windows + cache-hit-rate), abuse log, 5-dep health grid, Resend per-session emails with `[PRIORITY]` for non-free-mail, 4-condition alarm dispatcher, heartbeat + archive crons (180d hot→cold gzip-JSONL). |
| 5 | Eval Gates & Launch | 🟡 In flight (12/13 plans) | ~40-case eval harness across 6 categories (cat1 fabrication 15/15 hard gate, cat2 tools, cat3 persona, cat4 voice via blind A/B + LLM-judge, cat5 abuse/OWASP LLM01, cat6 Playwright UX smoke); two-layer prod gate (GH branch protection + Vercel Deployment Checks); `/admin/evals` index + detail + calibrate with Cohen's kappa; weekly cron-job.org eval (schedule deferred). **Plan 05-12 LAUNCH-*** awaits friend-tester responses. |
| 5.1 | Eval Content Trust Restoration (INSERTED) | ✅ Closed PARTIAL | Decimal phase that closed deferred-items #6 (`scripts/reset-eval-rate-limits.ts` + npm alias), #7 (transient `data-deflection` SSE chunk; eval CLI distinguishes deflections from real responses), #8 (`HALLUCINATION_RULES` premise-smuggling rule + `kb/profile.yml` `counter_facts:` 10-entry block; cat1-fab-005 passes every post-fix run). cat1=15/15 D-B-01 stretch goal NOT met — surfaced classifier over-flagging (now Item #11). |
| 5.2 | Anthropic Chat Stream Design Port (INSERTED) | ✅ Closed | Visual-only port of four bundle features before LAUNCH-05: iMessage tail-corner radii (D-A-01), client-side 5-minute inter-group timestamps (D-A-02-AMENDED — `/api/chat` byte-identical), "Light Mode / Dark Mode" toggle pill (D-B-01..03), matrix-mode easter egg with canvas digital-rain (D-A-04, lazy-mounted via `next/dynamic({ ssr: false })`). Strict preservation of Phase 02 D-G byte-identical `/api/chat` contract; all data-testids preserved verbatim. |

---

## 4. Requirements Coverage

**Total: 94 v1 requirements across 8 categories.** Snapshot at 2026-05-12:

- ✅ **Chat Core (CHAT)** — 12/14 Complete; CHAT-03/04/05 marked Pending in `REQUIREMENTS.md` traceability table but functionally validated in Phase 2 close-out (kb-loader determinism test + live cache-hit log).
- ✅ **Tools (TOOL)** — 11/11 Complete. Live runtime smoke for `research_company` DevTools observation pending in 03-HUMAN-UAT (post-deploy).
- 🟡 **Safety, Cost & Abuse (SAFE)** — 11/15 Complete. SAFE-12 (Anthropic org-level $20/mo spend cap) shipped via screenshot evidence at `.planning/phases/05-eval-gates-launch/safe-12-evidence.png`. SAFE-11/14/15 status mixed in traceability table but validated in commits.
- ✅ **Admin & Observability (OBSV)** — 16/16 Complete. Live OAuth round-trip + email observation + cron-job.org schedules pending in 04-HUMAN-UAT (operational, not code).
- ✅ **Knowledge Base & Voice (VOICE)** — 12/12 Complete (Phase 1 content acquisition delivered).
- 🟡 **Gate & Session (GATE)** — 5/5 functionally Complete; marked Pending in traceability table (pre-validation tracking artifact, not a gap).
- 🟡 **Eval (EVAL)** — 12/14 Complete; EVAL-01 / EVAL-02 / EVAL-11 marked Pending pending Plan 05-12 LAUNCH-05 prod-URL final verification + cron-job.org schedule activation.
- 🔴 **Launch (LAUNCH)** — 0/7 Complete; ALL are Plan 05-12 deliverables awaiting friend-test responses + final sign-off. The production deploy itself is LIVE; the remaining items are operational (QR-code print, LinkedIn/PDF URL paste, friend-test scoring, checklist signature).

**v2 deferrals captured in `REQUIREMENTS.md`:**
- OBSV-D1 (daily digest), OBSV-D2 (weekly question-clustering), OBSV-D3 (end-of-session feedback prompt), CHAT-D1 (1-hour extended-cache beta), LAUNCH-D1 (custom domain beyond Vercel subdomain).

---

## 5. Key Decisions Log

**Cross-phase decision themes** (full list in `STATE.md` § Decisions, ~90 entries):

| ID | Decision | Phase |
|----|----------|-------|
| Architecture | Single-model + prompt caching instead of RAG | 1 |
| Architecture | Hybrid Q&A + three agentic tools (pitch / walkthrough / metric) | spec |
| Voice | First-person voice with upfront "I'm an AI, not Joe" disclaimer | 1 |
| Voice | Four-layer voice defense (samples / negative rules / stances / voice-first case studies) | 1+2 |
| Safety | Classifier as synchronous preflight (NOT a Sonnet-chosen tool) | 2 |
| Safety | Six-gate request order cheapest-first; spend cap checks BEFORE Anthropic call | 2 |
| Safety | $3/day default spend cap (Redis); rate limits per-IP / per-email / per-session / token-cost | 2 |
| Tools | Read-only tool `execute` functions; all writes in `onFinish` | 3 |
| Tools | `prepareStep` + `stopWhen: stepCountIs(5)` + depth cap 3 + duplicate-arg stop | 3 |
| Resilience | `/api/health` HTTP 200 always; deps encoded in body | 3 |
| Resilience | Plain-HTML fallback at `/?fallback=1`; `error.tsx` belt-and-suspenders | 3 |
| Admin | Two-layer perimeter: `proxy.ts` middleware + `requireAdmin()` per page | 4 |
| Admin | `supabase.auth.getClaims()` over `getSession()` in server contexts | 4 |
| Admin | `(authed)/` route group keeps `/admin/login` reachable | 4 |
| Admin | Atomic email idempotency via `UPDATE ... WHERE email_sent_at IS NULL` | 4 |
| Admin | Per-condition Redis NX alarm suppression (1h); fail-open on Redis throw | 4 |
| Eval | Anthropic native forced tool-use for judge (NOT `generateObject`) | 5 |
| Eval | Quadratic-weighted Cohen's kappa for human-baseline calibration | 5 |
| Launch | Two-layer prod gate: GH branch protection + Vercel Deployment Checks | 5 |
| UI Polish | Visual-only chat-stream design port; `/api/chat` byte-identical to phase 02 D-G | 5.2 |
| UI Polish | Matrix-mode easter egg lazy-mounted via `next/dynamic({ ssr: false })` | 5.2 |

**Surprising / hard-won decisions worth re-reading later:**
- **AI SDK v6 erases Zod type from `tool().inputSchema`** (FlexibleSchema). Tests cast via `asZod()` helper; runtime unchanged. Phase 3 Plan 03-01.
- **`next/font/google` `display:'swap'`** prevents FOUT-driven reflow during matrix-mode toggle. Phase 5.2 Plan 05.2-01.
- **`pino` routed through `process.stdout`** (NOT `pino.destination(1)`) so vitest can spy on stdout.write. Equivalent fd-1 output, no worker-thread risk on Vercel. Phase 3 Plan 03-00.
- **AI SDK v6 `onFinish` callback signature** — destructure must NOT default to `{}`; `next build` strict tsc catches this, `npm run dev` + vitest do NOT. Run `npx tsc --noEmit` + `npm run build` before declaring TS work done. Phase 5 Plan 05-10.
- **`@upstash/ratelimit` `ephemeralCache`** in-process Map means `redis.del()` alone does NOT unblock a running dev server during local eval iteration. Restart dev server, OR pass `ephemeralCache: false`. Phase 5.1 deferred-items.
- **Vercel project `-eyap` suffix** — auto-generated; renaming the project breaks the branch-protection check name binding (`Vercel - resume-agent-eyap: eval`). Phase 5 Plan 05-10.

---

## 6. Tech Debt & Deferred Items

**Operational (not code), still pending:**
- **SAFE-12 verification** — Anthropic org-level $20/mo spend cap evidence captured at `.planning/phases/05-eval-gates-launch/safe-12-evidence.png`; final sign-off folded into Plan 05-12 LAUNCH-06 checklist.
- **cron-job.org schedules** — 3 schedules to configure (heartbeat business-hours, archive daily, weekly eval). Heartbeat is LIVE (1-min biz-hrs); archive + weekly-eval deferred into Plan 05-12 because the weekly eval needs the stable prod URL after CNAME flip (now done at `joe-dollinger-chat.com`). ~10-15 min residual work.
- **`joe-dollinger-resume.pdf`** — drop into `public/` before public deploy; PlainHtmlFallback links to `/joe-dollinger-resume.pdf` which currently 404s (T-03-05-08 disposition: accept; recruiter still has email + LinkedIn + GitHub paths).
- **One-time `oauth_debug_claims_shape` Pino log** in `/auth/callback` — schedule a removal commit after Joe verifies the claims shape from the first real GitHub login on Vercel.

**Code follow-ups deferred:**
- **5 Info-severity items** from Phase 4 code review (TracePanel click-lock, OAuth diagnostic log, magic threshold constants, streamText error reason hack, direct `process.env` reads in `supabase-browser`).
- **9 Info-severity items** from Phase 3 code review (per `fix_scope: critical_warning`).
- **6 Info-severity items** from Phase 5.2 code review.
- **WR-01..05** Phase 2 code-review warnings (message-length cap on `/api/chat`, IP spoofing on `/api/session`, atomic Redis ops, classifier delimiter wrap, `/api/session` rate limit). WR-01 partially closed by quick task 260511-u9d (classifier-banner false-green fix).
- **Pre-existing TypeScript error** in `src/components/ChatUI.tsx` (`UseChatOptions.onFinish` type erosion) — type-system-only, no runtime regression; fold into a future cleanup plan.

**Eval signal calibration (Plan 05-12 unblocked, but Item #11 still open):**
- **Item #11 — classifier over-flags eval prompts** as injection/sensitive/offtopic. cat1: 3-6 deflection-skips per local run; cat3: 6/6 deflection-skips. Hidden pre-Item-#7 by deflection-as-fabrication mis-grading. Investigation deferred to Plan 05-12 (assess prod URL behavior first; the same friction MAY affect legitimate recruiter questions in production).
- **Item #10 — production eval failures** observed on first CI gate run (cat1 13/15, cat2 1/9, cat3 0/6, cat5 1/7, cat6 12/15). Accepted at Plan 05-10 close-out; investigated and resolved across Phases 5.1 / 5.2; cat1=15/15 + cat4=5/5 re-verified on production per Plan 05-12 runIds `sWLys5bpVsiHAfwvoln04` (cat1) and `OPoI0ljuwE4GlbT_LFh4u` (cat4).

**Out of scope explicitly parked** (full list in `PROJECT.md` § Out of Scope, ~21 entries):
- Mobile UX, full WCAG audit, i18n, voice/audio chat, image generation, CSV upload, SMS notifications, third-party identity enrichment, product analytics, A/B testing framework, full RAG/vector DB, magic-link auth, day-1 CAPTCHA, ORMs, multi-user, talking-head avatar, self-rated match scores, auto cover letters.

---

## 7. Getting Started

**Run the project locally:**
```bash
npm run dev               # Next.js dev server on http://localhost:3000
npm test                  # Vitest unit + integration (~562 tests at last close-out)
npm run test:e2e          # Playwright Chromium suite (cat6 UX smoke)
npm run lint              # ESLint + tailwindcss/prettier
npm run build             # next build — runs scripts/generate-fallback.ts via prebuild hook
```

**Run the eval suite:**
```bash
npm run eval                                                       # all 6 categories against EVAL_TARGET_URL default
npm run eval -- --target=https://joe-dollinger-chat.com --cats=cat1,cat4-judge   # narrowed gate
npm run eval -- --help                                             # usage
npm run eval:reset-rl                                              # clear Upstash rate-limit + spend keys between local smokes
```

**Key directories:**
- [src/app/](src/app/) — Next.js App Router routes. `app/page.tsx` is the framing/email-gate; `app/chat/page.tsx` is the chat surface; `app/(authed)/admin/*` is the auth-gated dashboard; `app/api/chat/route.ts` is the six-gate request pipeline; `app/api/health/route.ts` is the dep-status endpoint.
- [src/components/](src/components/) — UI primitives: `ChatUI.tsx`, `MessageBubble.tsx`, `TimestampDivider.tsx`, `TracePanel.tsx`, `MetricCard.tsx`, `ViewToggle.tsx`, `MatrixRain.tsx`, `StatusBanner.tsx`, `EmailGate.tsx`, `PlainHtmlFallback.tsx`. `components/ui/*` is vendored shadcn/ui.
- [src/lib/](src/lib/) — `system-prompt.ts` (`buildSystemPrompt()` byte-identical assembly), `kb-loader.ts`, `classifier.ts` (Haiku preflight), `redis.ts` (4 Ratelimit instances + spend counter), `health.ts`, `chat-format.ts` (pure timestamp + bubble-grouping helpers), `eval/*` (CLI scaffold, runners, judge, cost extractor), `admin-auth.ts`, `email/*`, `alarms.ts`.
- [src/proxy.ts](src/proxy.ts) — middleware Layer 1 admin perimeter.
- [kb/](kb/) — voice-first knowledge base: `profile.yml` (with `counter_facts:` block), `resume.md` (SSOT), `about_me.md`, `management_philosophy.md`, `voice.md` (8-12 unfiltered samples), `stances.md`, `faq.md`, `guardrails.md` (Joe-signed), `case_studies/*.md`.
- [scripts/](scripts/) — `run-evals.ts`, `generate-fallback.ts`, `reset-eval-rate-limits.ts`, `reset-spend.ts`.
- [tests/](tests/) — vitest suites; mirror `src/` layout under `tests/lib/`, `tests/components/`, `tests/api/`, `tests/scripts/`.
- [supabase/migrations/](supabase/migrations/) — `0001_init.sql`, `0002_phase4.sql`, `0003_phase5.sql`.
- [.planning/](.planning/) — GSD planning artifacts (`PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`, `phases/*/`).

**Where to look first:**
- Read [.planning/PROJECT.md](.planning/PROJECT.md) for the value prop + Out-of-Scope reasoning + Key Decisions table.
- Read [.planning/ROADMAP.md](.planning/ROADMAP.md) for the 5-phase ordering rationale and per-phase success criteria.
- Read [src/app/api/chat/route.ts](src/app/api/chat/route.ts) for the six-gate pipeline (this is the heart of the system).
- Read [src/lib/system-prompt.ts](src/lib/system-prompt.ts) + [src/lib/kb-loader.ts](src/lib/kb-loader.ts) for the byte-identical KB → system-prompt assembly (D-G-01..05 contract).
- Browse phase SUMMARY files at [.planning/phases/*/](.planning/phases/) for plan-level deliverables and decisions; STATE.md decisions index lists ~90 entries pointing back to specific plans.

**Production:**
- Live URL: [joe-dollinger-chat.com](https://joe-dollinger-chat.com)
- GitHub repo: [jmd53695516/resume-agent](https://github.com/jmd53695516/resume-agent) (public — free branch protection + portfolio amplification)
- Vercel project: `joey-d-resume-agent/resume-agent-eyap` (`-eyap` auto-suffix; cleanup tracked as Item #9)
- Branch: `main` (renamed from master)

---

## Stats

- **Timeline:** 2026-04-21 → 2026-05-12 (~3 weeks)
- **Phases:** 6 closed / 7 total (Phase 5 in-flight at 12 of 13 plans complete; Phase 5.1 + 5.2 are INSERTED decimal phases)
- **Plans:** 40 of 41 complete (Plan 05-12 LAUNCH-* awaiting friend-tester responses)
- **Commits (since 2026-04-21):** 412
- **Tests:** 562+ vitest (562/562 at Phase 5.2 close-out); cat6 Playwright UX suite
- **Contributors:** Joe Dollinger (sole)
- **Quick tasks completed:** 4 (260509-q00 eval CLI session-mint fix; 260509-r39 judge model swap; 260509-sgn judge schema flakiness fix; 260511-u9d WR-01 classifier banner false-green fix)

---

*Built with GSD (`/gsd-*` workflow). Generated by `/gsd-milestone-summary` on 2026-05-12.*
