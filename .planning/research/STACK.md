# Stack Research

**Domain:** Public chat agent (streaming LLM UI + tool use) with soft auth, admin dashboard, and hard cost controls
**Researched:** 2026-04-21
**Confidence:** HIGH (primary-source verified for all core infra; versions current as of April 2026)

---

## TL;DR for the Roadmap

The spec's pre-committed stack (Next.js App Router on Vercel, Anthropic Claude, Supabase, Upstash, Vercel AI SDK, Tailwind, Exa) is **correct for 2026** and needs essentially no substitutions. This document:

1. Validates those picks with current versions and rationale.
2. Fills in the gaps the spec left open: schema validation, testing, email delivery, logging, chat-UI component library, cron scheduling.
3. Flags **two things to watch** (not blockers):
   - **Vercel Hobby is non-commercial-only** — personal job-search portfolio is fine, but if Joe ever monetizes/commercializes this, it's a $20/mo Pro upgrade.
   - **Vercel Hobby cron = one scheduled job total.** The spec implies at least 3 cron-style jobs (daily digest, synthetic health checks, weekly question clustering). Solution: use `cron-job.org` (free, unlimited jobs) hitting protected API routes, **or** Supabase `pg_cron` (free on the database). Recommend `cron-job.org` — simpler.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | 16.2.x (App Router) | Frontend + serverless API routes on Vercel | Dominant 2026 React framework; App Router + Server Components are native to streaming LLM responses; Turbopack is now default (stable in 16); first-class Vercel deploy. Spec pick — **validated**. |
| **React** | 19.2.x | UI runtime | Bundled with Next 16; View Transitions + `useEffectEvent` + Activity components are net wins for a chat UI. |
| **TypeScript** | 5.7.x | Language | Non-negotiable for tool schemas + AI SDK's type-safe `tool()` helper. Spec pick — **validated**. |
| **Vercel AI SDK (`ai`)** | 5.x (latest minor) | Streaming chat, tool calling, `useChat` hook, SSE transport | v5 (released Jul 2025, heavily iterated since) is the standard. SSE as default transport, tool-call streaming on by default, `useChat` fully decoupled from transport. Handles Anthropic `cache_control: ephemeral` via `providerOptions`. Spec pick — **validated**. |
| **`@ai-sdk/anthropic`** | Latest | Provider adapter plugged into the AI SDK | Use this for the main Sonnet 4.6 chat loop because it wires tool calls + streaming + prompt caching without glue code. |
| **`@anthropic-ai/sdk`** | 0.90.x | Direct Anthropic SDK | Use **alongside** `@ai-sdk/anthropic` for the Haiku 4.5 input classifier and the Haiku sub-call inside `design_metric_framework`. Direct SDK is leaner for one-shot, non-streaming JSON-output calls; avoids hauling AI SDK overhead into a classifier path that runs on every message. |
| **Claude Sonnet 4.6** | `claude-sonnet-4-6` | Main agent loop | Released Feb 17 2026; $3/$15 per MTok (same as 4.5); supports prompt caching w/ 1024-token min block; 1M-context beta available. Spec pick — **validated**. |
| **Claude Haiku 4.5** | `claude-haiku-4-5` | Classifier + metric-framework sub-call | $1/$5 per MTok; matches Sonnet 4 on tool use at a fraction of the price; prompt-cache min block 2048 tokens (not relevant to a short classifier prompt, but note it). Spec pick — **validated**. |
| **Supabase** | Cloud (latest) | Postgres (sessions, transcripts, rate-limit snapshots, eval runs), Auth (GitHub OAuth for admin), Row-Level Security | Free tier fits comfortably: 500 MB DB, 50k MAU, unlimited API. Auth w/ GitHub OAuth is free and zero-config. Spec pick — **validated**. **Watch:** free projects auto-pause after 7d inactivity — set up a cheap keep-alive cron. |
| **`@supabase/ssr`** | Latest | SSR-aware Supabase client for Next.js App Router | Replaces the deprecated `@supabase/auth-helpers-nextjs`. `createServerClient` + `createBrowserClient`. Use `supabase.auth.getClaims()` (not `getSession()`) inside server code — `getClaims()` validates JWT signatures, `getSession()` doesn't in server contexts. |
| **Upstash Redis + `@upstash/ratelimit`** | Latest | Token-bucket rate limit (per-IP, per-email), hard daily spend-cap counter, session-level turn counter | HTTP-based (works in edge runtime), designed for serverless; supports `tokenBucket`, `slidingWindow`, `fixedWindow` out of the box. Free tier: 10k commands/day. Spec pick — **validated**. |
| **Exa API** | Latest | `research_company` web search + content fetch | Embeddings-first search with minute-level refresh; returns full page content in one call (vs. Brave's URL-list-then-fetch pattern); first-class TypeScript SDK. $10 free credits to start. Spec pick — **validated over Brave** (see Alternatives below). |
| **Tailwind CSS** | 4.x | Styling | CSS-first config via `@theme` directive in `globals.css`; no JS config file needed. Default in 2026. Spec pick — **validated**. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`zod`** | 4.x | Schema validation for tool arguments, API request bodies, env vars, KB YAML frontmatter | AI SDK's `tool({ inputSchema })` expects a Zod schema. Zod v4 is ~8x faster than v3, has first-class JSON-schema export (needed because Anthropic's tool-call schemas are JSON Schema). Ecosystem lock-in (AI SDK, tRPC, React Hook Form) makes Zod the default. |
| **`shadcn/ui`** (vendored, not installed) | Latest CLI | Accessible, copy-paste Radix-based components (dialogs, buttons, inputs, cards) | The 2026 default for Next + Tailwind. Vendored into `components/ui/` so you own the code. Pair with Tailwind v4's `@theme inline`. |
| **`chatcn`** (optional) | Latest | Pre-built streaming chat bubble, message list, input components for shadcn | Saves 1-2 hours building the chat scaffold. Worth it if the time is better spent on KB + evals. Not required — a hand-rolled chat UI using AI SDK's `useChat` is ~150 LOC. |
| **`react-email`** + **Resend** | Latest | JSX email templates + transactional delivery (per-session notifications to Joe, daily digest, alarm emails) | Resend free tier: 3k emails/mo, 100/day — way more than Joe will ever trigger. React Email = write emails in JSX, same DX as React components. Resend has a first-class Next.js SDK. |
| **`pino`** | 9.x | Structured JSON logging to stdout (Vercel collects stdout automatically) | Fastest Node logger, JSON-by-default, serverless-friendly. Avoid `pino-pretty` transports in production (worker threads break on Vercel). Use raw JSON output; pretty-print only in dev. |
| **`date-fns`** | 4.x | Date formatting (transcript timestamps, daily rollup windows, 90-day freshness filter for Exa results) | Tree-shakeable, no runtime (unlike Moment). Dayjs is a fine alternative but date-fns has better TS types. |
| **`nanoid`** | 5.x | Session IDs, trace IDs for tool calls | Small, URL-safe, collision-resistant. Don't use `crypto.randomUUID()` for user-facing IDs — too long and unfriendly in URLs. |
| **`@tailwindcss/typography`** | Latest | Prose styling for case-study rendering (the ~400-word markdown narrations) | Single plugin that gives you readable `<article>`-style typography with one `prose` class. Worth it for the walkthrough tool's output. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** | Unit tests (rate-limit logic, cost accounting, KB loader, eval runner, classifier wrapper); most of the ~40-case eval harness itself | 6x faster cold start than Jest; native ESM; JSDOM or happy-dom for component tests. Use `vitest --pool=threads` on CI. |
| **Playwright** | E2E / UX smoke (eval Category 6): email gate validation, button-triggers-tool, trace panel toggle, feedback submission, plain-HTML fallback under induced 500s | Industry standard for Next.js E2E per the Next.js docs. Playwright's `test` runner only — don't pull in Cypress too. |
| **`eslint` + `@typescript-eslint`** | Linting | Next.js ships with `eslint-config-next`; extend it, don't replace it. |
| **`prettier`** | Formatting | Tailwind has an official `prettier-plugin-tailwindcss` that sorts classes — install it. |
| **`tsx`** (or `bun`) | Local scripts (eval runner CLI, KB token-counter, case-study linter) | Use `tsx` for simplicity if not already on Bun; one-line invocation: `tsx scripts/run-evals.ts`. |
| **`dotenv-cli`** | Loading `.env.local` into one-off scripts | Only needed if scripts run outside Next.js's env loader. |
| **`cron-job.org`** (external, free) | Scheduled jobs beyond Vercel Hobby's 1-cron limit | Free tier: unlimited jobs, 1-minute granularity. Hits protected `/api/cron/*` routes with a shared secret header. Use this for daily digest + health ping + weekly question clustering. |

---

## Installation

```bash
# Scaffold
npx create-next-app@latest joe-agent --typescript --tailwind --app --use-npm --eslint

cd joe-agent

# Core runtime
npm install ai @ai-sdk/anthropic @anthropic-ai/sdk zod
npm install @supabase/supabase-js @supabase/ssr
npm install @upstash/redis @upstash/ratelimit
npm install exa-js
npm install resend react-email @react-email/components
npm install pino
npm install nanoid date-fns

# UI
npm install @tailwindcss/typography
npx shadcn@latest init
# then pick components as needed:
npx shadcn@latest add button card dialog input textarea tooltip

# Dev
npm install -D vitest @vitejs/plugin-react jsdom
npm install -D @playwright/test
npx playwright install --with-deps
npm install -D prettier prettier-plugin-tailwindcss
npm install -D tsx

# (optional) chat scaffolding shortcut:
# npx chatcn@latest add chat-interface
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Exa** for `research_company` | **Brave Search API** | If cost becomes the binding constraint at volume ($5-9 / 1k reqs, vs. Exa's $49/mo-ish Websets plan after $10 free credit). Brave is fine for keyword-style lookups but requires a second fetch step for content, which complicates the tool. For a job-search-duration project with <1k total calls expected, Exa is clearly better. |
| **Zod v4** | **Valibot** | If bundle size on the client is critical (Valibot is ~90% smaller — 1.37 kB vs. 6.88 kB for Zod Mini). Not the case here; our schemas live server-side and AI SDK's `tool({ inputSchema })` expects Zod. |
| **Vercel AI SDK** for streaming | **Raw `@anthropic-ai/sdk` + hand-rolled SSE** | If you need provider-portability that Vercel AI SDK doesn't abstract well, or if the AI SDK's abstractions ever get in the way of a specific Anthropic-only feature. For this project, AI SDK saves ~200 LOC of streaming glue and has zero downsides. |
| **Supabase** | **Neon + Clerk** or **PlanetScale + Auth.js** | If you outgrow Supabase or want best-in-class auth separate from DB. Overkill for this project; Supabase's integrated auth + DB + RLS is the simplest path and spec already locked it. |
| **Upstash Redis** | **Vercel KV** (rebranded from Upstash) / **Cloudflare Workers KV** | Vercel KV is literally Upstash under the hood but sold through Vercel's billing. Cloudflare KV is eventually-consistent — bad for rate limits. Stay with Upstash direct for better pricing visibility. |
| **Resend + React Email** | **Postmark**, **SendGrid**, **AWS SES** | Postmark has better deliverability reputation but no free tier. SendGrid's free tier is gone in 2026. SES is cheapest at scale but requires AWS account + domain DKIM setup + reputation warmup — not worth the DevOps for a hobby project. |
| **`cron-job.org`** | **Supabase `pg_cron`**, **Upstash QStash**, **GitHub Actions scheduled workflow** | `pg_cron` is free and lives next to your data — good for DB-only tasks. QStash charges per message after free tier. GitHub Actions scheduled runs work but have 5-min minimum intervals and weird failure silent-dropping. `cron-job.org` is the simplest for HTTP-trigger-only scheduled tasks. |
| **Playwright** for E2E | **Cypress** | Cypress's single-tab architecture limits some scenarios; Playwright is strictly more capable in 2026 and is what the Next.js docs recommend. No reason to pick Cypress for a new project. |
| **`pino`** for logging | **`winston`**, **`console.log`** | Winston is fine but has more surface area; on Vercel, Pino's stdout-JSON pattern is the path of least resistance. `console.log` is OK for dev but you'll regret the lack of structured fields when grepping Vercel logs at 2am. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`@supabase/auth-helpers-nextjs`** | Deprecated; replaced by `@supabase/ssr`. Tutorials from 2023-2024 still reference it. | `@supabase/ssr` with `createServerClient` / `createBrowserClient`. |
| **`supabase.auth.getSession()` in server code** | Does not validate JWT signature in server contexts — security gap. | `supabase.auth.getClaims()` — validates against project's public keys each call. |
| **Vector DB + embeddings + RAG (pgvector, Pinecone, Weaviate)** | KB is <50k tokens and fits comfortably in a cached system prompt. RAG adds indexing, chunking, embedding costs, and retrieval quality risk for zero benefit at this scale. | Static `kb/` markdown loaded into the system prompt with Anthropic prompt caching (`cache_control: ephemeral`). Spec correctly calls this out. |
| **Next.js Pages Router** | Legacy in 2026; no Server Components, worse streaming story, worse for AI UIs. | App Router (spec pick). |
| **`moment.js`** | Unmaintained; 4x bigger than date-fns. | `date-fns` v4 or `dayjs`. |
| **`lodash` full import** | Bloats bundle. 99% of usage is `get`, `pick`, `debounce` — all doable native or via micro-libs. | Native JS / specific `lodash/fp/<fn>` imports if absolutely needed. |
| **Redis client libraries that need long-lived TCP connections (`ioredis`, `redis`)** | Break in Vercel serverless/edge — connection-per-invocation is a disaster. | `@upstash/redis` (HTTP-based) or Vercel KV. |
| **Magic-link auth / email-password auth for the recruiter gate** | Friction kills the 2-minute demo. | Email-field-only soft gate (spec's pick). |
| **CAPTCHA on day one (Turnstile, hCaptcha, reCAPTCHA)** | Adds friction before any abuse is observed. Turnstile is invisible most of the time, but even the fallback is a cost. | Leave un-captcha'd until rate-limit data shows abuse. Turnstile is the right add-on when needed (free, Cloudflare). |
| **PostHog / Amplitude / GA / Segment** | Single-conversion-event product; tracking pixels + cookie banners hurt the demo UX more than the data helps. | Server-side logging to Supabase + Pino to Vercel logs. If Joe ever wants funnel analytics, add PostHog then. |
| **ORMs (Prisma, Drizzle)** for this project | Schema is tiny (~5 tables); Supabase's generated types + the JS client are enough. Prisma's cold-start cost on serverless is notable. | `supabase-js` client directly. If you want type safety, generate types via `supabase gen types typescript`. Drizzle is fine if you prefer SQL builders, but it's net negative complexity here. |
| **Worker-thread-based Pino transports (`pino-pretty`, `pino-roll`) in production on Vercel** | Worker threads aren't reliably supported in Vercel serverless runtime — causes silent log drops. | Pino direct JSON to stdout in production; `pino-pretty` only as a dev dependency piped manually. |
| **`@anthropic-ai/sdk` for the streaming chat path** | Streaming + tool-call handling + useChat wiring is ~200 LOC you'd write from scratch. | Use `@ai-sdk/anthropic` via the AI SDK for streaming chat. Keep direct `@anthropic-ai/sdk` only for one-shot Haiku calls where you want tight control. |

---

## Stack Patterns by Variant

**If Joe wants to promote this to a commercial/monetized product later:**
- Upgrade Vercel Hobby → Pro ($20/mo). Hobby's TOS is explicit: non-commercial only.
- Upgrade Supabase Free → Pro ($25/mo) for backups, daily point-in-time recovery, and to stop the 7-day auto-pause.
- Consider Cloudflare in front of Vercel for stricter WAF rules if traffic scales.

**If the KB outgrows ~50k tokens (Joe adds 20+ case studies, or full client-confidential appendices):**
- At ~100k tokens, still fits Sonnet 4.6's 200k context. Prompt caching still pays off.
- At ~200k+ tokens, introduce RAG via Supabase `pgvector` (free on the same DB). Don't add Pinecone.

**If abuse is observed post-launch:**
- Turnstile in front of `/api/chat` and `/api/session`. Invisible 95% of the time.
- Tighten rate limits: drop from 60/day per IP to 20/day per IP.
- Add IP allowlist for repeat recruiter visits (detectable via email domain match).

**If Joe wants to run locally without cloud services:**
- Swap Upstash → local Redis (`redis:7-alpine` in Docker) — but this throws away edge compatibility.
- Swap Supabase → local Postgres via `supabase start` (Supabase CLI spins up the full stack locally).
- Anthropic + Exa have no local equivalents; use real API keys with separate dev keys.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.x` | `react@19.2`, `react-dom@19.2` | Locked together; don't mix React 18 peer deps. |
| `next@16.x` | `tailwindcss@4.x` | Tailwind v4 uses CSS-first config; follow `shadcn/ui` Tailwind v4 migration guide if porting any v3 setup. |
| `ai@5.x` | `@ai-sdk/anthropic@latest`, `@ai-sdk/react@latest` (for `useChat`) | All three are sibling packages — upgrade together. |
| `@supabase/ssr` | `@supabase/supabase-js@2.x` | `@supabase/ssr` wraps `supabase-js` — keep versions in sync. |
| `@upstash/ratelimit` | `@upstash/redis@latest` | Ratelimit depends on the Redis client; upgrade together. |
| `zod@4.x` | `ai@5.x` tool schemas, `@ai-sdk/anthropic` | AI SDK expects Zod v4 syntax (`z.object({ ... })`). No breaking changes needed migrating from v3 for simple schemas. |
| `pino@9.x` | Vercel serverless runtime | Avoid transports in production; log JSON direct to stdout. |
| Anthropic Sonnet 4.6 | `@ai-sdk/anthropic` provider, `@anthropic-ai/sdk@0.90+` | Both SDKs support the `claude-sonnet-4-6` model string; prompt cache `cache_control: ephemeral` works in both. |

---

## Pre-Committed Decisions: Validated vs. Challenged

All decisions from `docs/superpowers/specs/2026-04-21-resume-agent-design.md` §2:

| Spec Decision | Verdict | Notes |
|---|---|---|
| Next.js App Router on Vercel | **Validated** | Correct 2026 default; Next 16 App Router is where all Vercel-specific AI streaming features land first. |
| TypeScript + Tailwind | **Validated** | Non-negotiable baseline. |
| Vercel AI SDK for streaming UI | **Validated** | v5 is mature; saves ~200 LOC; first-class Anthropic + tool-call support; handles prompt caching via `providerOptions`. |
| Sonnet 4.6 main + Haiku 4.5 classifier/sub-call | **Validated** | Current frontier non-Opus combo; price points ($3/$15 and $1/$5) are unchanged from late 2025. Prompt caching cuts repeat cost ~80-90%. |
| Prompt caching on system prompt + KB | **Validated** | Critical for making <50k-token KB loading economical. Min cache block = 1024 tokens (Sonnet) / 2048 tokens (Haiku) — well below our KB size. |
| Supabase (Postgres + Auth w/ GitHub OAuth) | **Validated** | Free tier is ample. **Caveat:** 7-day inactivity auto-pause — add a heartbeat cron. |
| Email-only soft gate (no password, no magic link) | **Validated** | Correct UX call for a 2-minute recruiter demo. |
| Upstash Redis for rate limiting | **Validated** | Only serverless-safe Redis option for edge runtime. |
| Exa **or** Brave for `research_company` | **Validated with preference: Exa** | Exa's embeddings-first search + single-call content fetch is a better fit for the tool's 3-paragraph pitch. Brave requires a 2-step (URL list → fetch pages). At expected volume (<1k calls total), cost difference is negligible. |
| Cloudflare Turnstile deferred to post-launch | **Validated** | Correct posture; don't add friction before evidence of abuse. |
| Vercel preview → evals → prod promote | **Validated** | Standard 2026 pattern; GitHub Actions or Vercel deploy-hook gates work. |

**Gaps the spec leaves open that this research fills:**

| Gap | Filled With |
|---|---|
| Schema validation library | `zod@4.x` |
| Email delivery for session notifications + digest + alarms | `resend` + `react-email` (3k/mo free) |
| Structured logging | `pino@9.x` (JSON to stdout) |
| Test runners | `vitest` (unit + eval harness) + `@playwright/test` (E2E smoke) |
| Chat UI component source | `shadcn/ui` + Tailwind v4; optionally `chatcn` for the chat-bubble scaffold |
| Prose rendering for case-study narrations | `@tailwindcss/typography` |
| Multiple scheduled jobs (Vercel Hobby allows only 1 cron) | `cron-job.org` free tier hitting protected API routes |
| Supabase SSR client | `@supabase/ssr` — not `@supabase/auth-helpers-nextjs` (deprecated) |
| Session-ID generation | `nanoid@5.x` |
| Date formatting | `date-fns@4.x` |

**Nothing in the spec is wrong for 2026.** The only thing that would have been worth challenging is "Exa or Brave" (the spec leaves this TBD at implementation time) — this research resolves it to **Exa** based on fit, with Brave as the fallback if Exa pricing changes.

---

## Sources

- [Next.js 16 release notes](https://nextjs.org/blog/next-16) — Turbopack default, React 19.2, App Router stable — **HIGH**
- [Next.js App Router docs](https://nextjs.org/docs/app) — last updated April 15 2026 — **HIGH**
- [Vercel AI SDK 5 blog](https://vercel.com/blog/ai-sdk-5) — SSE default, decoupled `useChat`, tool-call streaming — **HIGH**
- [AI SDK Anthropic provider docs](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) — `cacheControl`, tool streaming defaults — **HIGH**
- [AI SDK dynamic prompt caching cookbook](https://ai-sdk.dev/cookbook/node/dynamic-prompt-caching) — `providerOptions` pattern for ephemeral caching — **HIGH**
- [Anthropic Sonnet 4.6 launch](https://www.anthropic.com/news/claude-sonnet-4-6) — released Feb 17 2026, $3/$15, 1M context beta — **HIGH**
- [Anthropic Claude Haiku 4.5](https://www.anthropic.com/claude/haiku) — Sonnet-4-parity on tools at $1/$5 — **HIGH**
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — 1024/2048 min block, cache_control ephemeral — **HIGH**
- [`@anthropic-ai/sdk` npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.90.0, 5062 downstream projects — **HIGH**
- [Supabase pricing (free tier)](https://supabase.com/pricing) — 500 MB DB, 50k MAU, 7-day inactivity pause — **HIGH**
- [Supabase SSR docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — `createServerClient` / `createBrowserClient`, `getClaims()` — **HIGH**
- [Supabase migration from auth-helpers to SSR](https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers) — **HIGH**
- [Upstash Ratelimit docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — token-bucket/sliding-window, edge-safe — **HIGH**
- [Upstash ratelimit-js GitHub](https://github.com/upstash/ratelimit-js) — GA, regular updates — **HIGH**
- [Vercel Hobby plan limits](https://vercel.com/docs/plans/hobby) — 100 GB bandwidth, 1M invocations, non-commercial, 1 cron — **HIGH**
- [Vercel cron jobs pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby is limited to daily intervals / 1 job — **HIGH**
- [Exa 2026 comparisons](https://www.firecrawl.dev/blog/brave-search-api-alternatives) — embeddings-first, TS SDK, $10 free credits — **MEDIUM** (third-party comparison)
- [Brave Search API guide](https://brave.com/search/api/guides/what-sets-brave-search-api-apart/) — **HIGH** for Brave specs
- [Resend Next.js docs](https://resend.com/docs/send-with-nextjs) — 3k/mo free, React Email integration — **HIGH**
- [Zod v4 vs Valibot 2026 comparison](https://pockit.tools/blog/zod-valibot-arktype-comparison-2026/) — Zod v4 8x faster than v3, ecosystem lock-in — **MEDIUM** (third-party)
- [Shadcn/ui Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4) — CSS-first config, React 19 support — **HIGH**
- [Pino structured logging for Next.js (Arcjet)](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) — JSON-to-stdout pattern on Vercel — **MEDIUM**
- [Next.js Playwright testing docs](https://nextjs.org/docs/app/guides/testing/playwright) — official recommendation — **HIGH**

---

*Stack research for: Public streaming chat agent with Anthropic tool use, Supabase-backed state, and hard cost controls (solo dev, free-tier hosting).*
*Researched: 2026-04-21*
