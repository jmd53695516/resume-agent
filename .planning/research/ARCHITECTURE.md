# Architecture Patterns

**Domain:** Public chat agent (resume-bound, first-person LLM persona, tool-using, low-volume, safety-critical)
**Researched:** 2026-04-21
**Confidence (overall):** HIGH for component shape; HIGH for data flow and Vercel AI SDK patterns (verified against current docs); MEDIUM for two integration gotchas (verified against SDK issue tracker / community posts).

---

## Recommended Architecture

### One-screen overview

A single Next.js 15 App Router app on Vercel. One durable HTTP surface (`/api/chat`) does the heavy streaming; everything else is a short-lived route. All LLM work lives behind one "agent" module that wraps the Vercel AI SDK's `streamText`. The KB is flat markdown in git, loaded once per process and inlined into the cached system prompt. Two stateful dependencies: **Postgres (Supabase)** for things that need to persist and be queried (sessions, transcripts, token counts), and **Redis (Upstash)** for things that only need to be correct *right now* (rate-limit counters, daily spend counter). No vector DB. No queue. No separate Python service.

This is the smallest viable shape that still demonstrates every "agentic engineering" signal the spec cares about: tool use, prompt caching, rate limiting, spend cap, input classifier, graceful degradation, tool-call trace visibility. Bigger is not better here — the solo-PM build velocity and the "this is the artifact" honesty both argue for the simplest thing that works.

### Textual architecture diagram

```
                        ┌────────────────────────────┐
                        │  Recruiter browser         │
                        │  - Framing page            │
                        │  - Email gate              │
                        │  - Chat UI + Trace panel   │
                        │  (useChat hook, AI SDK v5) │
                        └────────────┬───────────────┘
                                     │ HTTPS / SSE
                                     ▼
          ┌──────────────────────────────────────────────────┐
          │  Next.js App Router on Vercel (Node runtime)     │
          │                                                  │
          │  /api/session   ──► Supabase (create session,    │
          │                     log email, fire notify)      │
          │                                                  │
          │  /api/chat      ──► [1] Upstash: rate-limit +    │
          │                         spend-cap preflight      │
          │                     [2] Haiku 4.5 classifier     │
          │                         (abuse/injection/topic)  │
          │                     [3] streamText(Sonnet 4.6)   │
          │                           with 3 tools:          │
          │                             research_company ─┐  │
          │                             get_case_study   │  │
          │                             design_metric ───┤  │
          │                     [4] onFinish: persist +   │  │
          │                         increment spend       │  │
          │                                              │  │
          │  /api/health    ──► pings (Anthropic, Exa,   │  │
          │                     Supabase, Upstash)       │  │
          │  /api/admin/*   ──► GitHub-OAuth-gated       │  │
          │                     (deferred to later phase)│  │
          └──────────────────────────────────┬───────────┴──┘
                                             │
                 ┌───────────────────────────┼──────────────────┐
                 │                           │                  │
                 ▼                           ▼                  ▼
      ┌──────────────────┐      ┌──────────────────┐   ┌─────────────────┐
      │ Anthropic API    │      │ Upstash Redis    │   │ Supabase        │
      │  Sonnet 4.6      │      │  - IP bucket     │   │  Postgres:      │
      │  Haiku 4.5       │      │  - Email bucket  │   │   sessions      │
      │  (prompt cache   │      │  - Daily spend   │   │   messages      │
      │   on sys prompt) │      │    counter       │   │   tool_calls    │
      └───────┬──────────┘      └──────────────────┘   │  Auth (admin):  │
              │                                        │   GitHub OAuth  │
              │ tool: research_company                 └─────────────────┘
              │ (executed server-side in route)
              ▼
      ┌──────────────────┐
      │ Exa API          │ ──► returns URLs + extracted content
      │ (web search)     │     + Haiku summarization pass
      └──────────────────┘
```

### Component boundaries

| Component | Responsibility | Talks to | Does NOT |
|-----------|----------------|----------|----------|
| **Framing page** (`app/page.tsx`) | Landing, disclaimer, email input, status banner | `/api/session`, `/api/health` | call Anthropic directly |
| **Chat UI** (`app/chat/page.tsx` + `components/ChatUI.tsx`) | Render messages, tool buttons, trace panel, feedback prompt; owns `useChat` hook | `/api/chat` via SSE | know about Supabase, Redis, or tool internals |
| **`TracePanel.tsx`** | Render collapsible "see what I did" view of tool invocations keyed off AI SDK v5 `tool-<name>` message parts | — | persist or fetch; reads only from in-flight UIMessages |
| **`MetricCard.tsx`** | Render `design_metric_framework` structured result as a card above/below the commentary | — | make any network call |
| **`/api/session/route.ts`** | Validate email, create row in `sessions`, hash IP, trigger "new chat" email to Joe | Supabase (server client), email sender | touch Anthropic or tools |
| **`/api/chat/route.ts`** (the one hot path) | Orchestrate: preflight → classify → stream with tools → persist on finish | Upstash, Anthropic, Exa (via tools), Supabase | hold business logic inline (delegates to `lib/`) |
| **`/api/health/route.ts`** | Ping Anthropic, Exa, Supabase, Upstash; return per-dependency booleans | all of the above | mutate anything |
| **`lib/anthropic.ts`** | Singleton Anthropic client; central place for model IDs, max_tokens, cache config | Anthropic API | expose raw client outside `lib/` |
| **`lib/supabase.ts`** | Server-role and anon Supabase singletons | Supabase | touch request/response objects |
| **`lib/redis.ts`** | Upstash client + `checkRateLimits(ip, email)` and `incrementSpend(usdCents)` helpers | Upstash REST API | do any LLM work |
| **`lib/kb-loader.ts`** | Read `kb/**/*.md` at cold start, parse frontmatter, concatenate to a single cacheable string; cache in module scope | filesystem | hit network or be called in a hot path |
| **`lib/system-prompt.ts`** | Assemble `{persona rules} + {guardrails} + {KB body}` into the exact string that becomes the cached system prompt | `kb-loader` | vary between turns (must be byte-identical for cache hits) |
| **`lib/classifier.ts`** | Single-shot Haiku call returning `"normal" \| "injection" \| "offtopic" \| "sensitive"` + reason | Anthropic | call any tool or stream |
| **`lib/tools/index.ts`** | AI-SDK-v5-shaped tool definitions (`inputSchema` via zod, `execute`), registered once | `tools/*.ts` | own schemas for individual tools (those live with each tool) |
| **`lib/tools/research-company.ts`** | Exa search → pick top 2-3 → fetch → Haiku summarization → structured JSON | Exa, Anthropic (Haiku) | stream to client directly |
| **`lib/tools/get-case-study.ts`** | Lookup by slug in KB (already in memory) → structured record | `kb-loader` | hit network |
| **`lib/tools/design-metric-framework.ts`** | Haiku sub-call with rigid schema → structured JSON | Anthropic (Haiku) | stream (returned as a single tool result) |
| **`lib/persistence.ts`** | `persistTurn(sessionId, userMsg, assistantMsg, toolCalls, usage)` | Supabase | be in the streaming hot path (called in `onFinish`) |
| **`lib/notify.ts`** | "New session" email to Joe, with company-domain priority flag | email provider (Resend or similar) | touch request path latency (fire-and-forget with `waitUntil`) |

**Enforcement:** components in `app/` may only import from `lib/`; `lib/*` modules may not import from `app/` (this is the rule that keeps the streaming route thin).

---

## Data Flow

### Single user message — end to end

**Scenario:** The recruiter (already email-gated) types "Walk me through the feature-killing project" and hits Send.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 0. useChat.sendMessage() → POST /api/chat                               │
│    body: { messages: UIMessage[], sessionId, csrfToken }                │
│    Browser opens an SSE stream and keeps it open.                       │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. PREFLIGHT (Edge-fast, ~10-40ms)                                      │
│    - Parse body, extract sessionId, validate it exists & isn't ended   │
│    - Upstash: getRemainingLimit(ip), getRemainingLimit(email)           │
│    - Upstash: getDailySpendCents()                                      │
│                                                                         │
│    If any limit exceeded → return 429 with an in-character SSE          │
│    "I'm taking a breather" message, then close. DO NOT call Anthropic. │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. CLASSIFY (Haiku 4.5, ~150-400ms)                                     │
│    classifier.classify(lastUserMessage) → verdict                       │
│                                                                         │
│    - "injection" or "offtopic" → skip main model; emit a pre-canned    │
│      polite deflection via the SSE stream; onFinish still persists.    │
│    - "sensitive" (salary/comp) → continue, but inject an extra         │
│      system-turn nudge reminding the model to redirect to email.       │
│    - "normal" → proceed.                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. STREAM (Sonnet 4.6, streamText, up to ~10-30s per turn)              │
│    streamText({                                                         │
│      model: anthropic('claude-sonnet-4-6', {                            │
│        cacheControl: true,                                              │
│      }),                                                                │
│      system: [                                                          │
│        { type: 'text', text: systemPromptString,                        │
│          providerOptions: { anthropic: { cacheControl:                  │
│            { type: 'ephemeral' } } } }                                  │
│      ],                                                                 │
│      messages: convertToCoreMessages(uiMessages),                       │
│      tools: { research_company, get_case_study, design_metric_... },   │
│      stopWhen: stepCountIs(5),          // multi-step loop             │
│      maxOutputTokens: 1500,             // from spec §5                │
│      onFinish: async ({ response, usage }) => { ... }, // persistence  │
│    })                                                                   │
│                                                                         │
│    Model decides to call get_case_study({ slug: 'killing-the-feature'})│
│    AI SDK streams tool-input deltas → UIMessage parts of type          │
│    "tool-get_case_study" appear in the client's messages array         │
│    with state "input-streaming" → "input-available" → "output-         │
│    available". TracePanel renders off these.                            │
│                                                                         │
│    Tool executes (in-process, ~5ms because KB is in memory).            │
│    Tool result returns to the model; Sonnet resumes and now streams    │
│    the narrated case study as text tokens.                              │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. ON FINISH (post-stream, ~50-150ms, client already has the text)      │
│    - Persist: insert user message, assistant message, tool calls       │
│      into `messages` table in one transaction.                          │
│    - Compute cost in USD cents from `usage` object (input,             │
│      output, cache_read, cache_creation tokens × model rates).          │
│    - Upstash: INCRBY daily_spend_cents by computed cost.               │
│    - Upstash: INCRBY ip:msgs:10min, email:msgs:day.                     │
│    - `waitUntil(notifyJoe(...))` — non-blocking email if this is       │
│      the first turn of a high-priority session.                         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          SSE stream closes; done.
```

### Storage decisions — what goes where

| Data | Store | Lifetime | Why |
|------|-------|----------|-----|
| Session (id, email, email_domain, ip_hash, ua, created_at, ended_at) | **Postgres** | 180d hot, then cold archive | Queryable by admin, joined to messages, small row count |
| Message (role, content, tool_name, tool_args, tool_result, classifier_verdict, tokens, latency_ms) | **Postgres** | Same as session | Append-only, queryable, drives transcript view |
| Per-IP count (messages / 10min, messages / day) | **Redis** (Upstash Ratelimit sliding window) | TTL matches window | Must be correct *now*; ephemeral; don't want to write to Postgres on every request |
| Per-email count (messages / day) | **Redis** | TTL 24h | Same reason |
| **Daily spend counter** (cents) | **Redis** | TTL to midnight ET | Checked on every request; Postgres is the wrong tool for a high-frequency atomic counter |
| Monthly spend (for Anthropic console alert cross-check) | **Postgres** (derived via SUM over messages.input_tokens etc.) | Indefinite | Not on the hot path; reporting only |
| Email capture (standalone lead list) | **Postgres** `sessions.email` column; unique list is `SELECT DISTINCT email FROM sessions` | Indefinite | One source of truth per spec |
| Classifier-flagged attempts | **Postgres** `messages.classifier_verdict <> 'normal'` | 90d | Queryable for admin abuse log |
| KB content | **Git + filesystem** (read at cold start into module memory) | As long as the process lives | Static, versioned, <50k tokens — anything else is overkill |
| Assembled system prompt string | **In-process memory** (computed once at cold start) | Lifetime of the serverless instance | Must be byte-identical every turn for Anthropic cache hit |
| In-flight UIMessage parts (tool-input deltas before resolution) | **Client state only** (AI SDK `useChat`) | Until stream completes | These are UX; they don't need to survive a refresh |

### Ephemeral-only (never stored)

- Raw recruiter IP address (we store only `sha256(ip)` in `ip_hash`, per spec §6 & PROJECT.md privacy posture).
- Classifier raw token-level output (we keep only the verdict and a short reason).
- Tool-input streaming deltas (we keep only the final `tool_args`).
- Full Exa page text after we've summarized it (we persist the structured summary + source URLs, not the raw bodies — keeps Postgres rows small and avoids copyright drift).

---

## Patterns to Follow

### Pattern 1 — KB as a frozen string in the cache prefix

**What:** Load every file under `kb/` at module scope, concatenate in a deterministic order, store the resulting string in a module-level `const`. Place one Anthropic `cache_control: { type: 'ephemeral' }` breakpoint on the system block. Every request uses the same string.

**When:** Always, for every turn.

**Why:** Anthropic caches at prefix boundaries; the cache prefix hash only matches if the cached block is byte-identical between requests (verified in Anthropic cache-breakpoint guidance). Any dynamic string (timestamp, session-specific greeting, A/B variant) before or *within* the cached block silently invalidates the cache. Dynamic content belongs in the user message or in a second system block *after* the cached one.

**Example (conceptual):**

```ts
// lib/system-prompt.ts — executed once per cold start
import { loadKB } from './kb-loader';

export const SYSTEM_PROMPT = buildSystemPrompt({
  kb: loadKB(),          // deterministic concat of all files
  rules: STATIC_RULES,   // the negative-tonal directives from voice defense layer 2
  guardrails: GUARDRAILS // from kb/guardrails.md
});
// Exported once, imported everywhere; never mutated.
```

```ts
// lib/agent.ts — the streamText call
streamText({
  model: anthropic('claude-sonnet-4-6'),
  system: [{
    type: 'text',
    text: SYSTEM_PROMPT,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } }
    }
  }],
  // messages contains per-session dynamic content; kept out of the cached block
  messages: convertToCoreMessages(uiMessages),
  tools: toolRegistry,
  stopWhen: stepCountIs(5),
  maxOutputTokens: 1500,
  onFinish: persistTurn,
});
```

### Pattern 2 — Classifier as a synchronous preflight, not a tool

**What:** The Haiku classifier runs as a plain function call *before* `streamText`. Its verdict determines whether `streamText` is called at all, and if so, whether to inject a nudge turn.

**Why:** If the classifier were exposed to Sonnet as a tool, Sonnet could decide not to call it on malicious input — defeating the point. Putting it as a preflight is ~150ms and one Haiku call (~$0.0005) per request; worth it for a hard safety guarantee.

### Pattern 3 — Tool results as the trace source of truth

**What:** The UI's "see what I did" panel reads entirely from the AI SDK v5 `tool-<name>` message parts on the client (`message.parts.filter(p => p.type.startsWith('tool-'))`). No separate "traces" store, no second round-trip to fetch.

**Why:** AI SDK v5's redesigned tool parts expose state transitions (`input-streaming` → `input-available` → `output-available` / `output-error`) natively. Persisting them to Postgres is for admin/audit, not for the user-facing trace panel. One source of truth per audience.

### Pattern 4 — One multi-step loop, bounded by `stopWhen`

**What:** Use `stopWhen: stepCountIs(5)` on `streamText`. Let the model call tools up to 5 times in sequence within a single `/api/chat` request.

**Why:** The three tools are independent; Sonnet should never need >2 tool calls in a real turn. `stepCountIs(5)` is a safety cap, not an expected depth. Without it you're one prompt-injection away from an infinite tool loop during an abuse spike — and your only protection is the 300s Vercel Edge stream timeout, which is too expensive.

### Pattern 5 — Persist in `onFinish`, not during streaming

**What:** All database writes happen in the `onFinish` callback of `streamText`. Nothing is persisted mid-stream.

**Why:** The user sees the response as soon as tokens arrive (great UX). Persistence is non-blocking. If persistence fails, the user got their answer; you log an error and move on rather than corrupting the session. `onFinish` receives the authoritative token counts for cost computation — do not try to tally from the stream yourself.

### Pattern 6 — `waitUntil` for email notifications

**What:** Fire the "new session" email via `waitUntil(notifyJoe(...))` from the `/api/session` route. The response returns to the client before the email sends.

**Why:** Recruiter must not wait on an SMTP round-trip to see the chat UI. Vercel's `waitUntil` keeps the serverless function alive after the response is sent, just long enough to complete the side effect.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1 — Putting dynamic content inside the cached system block

**What:** Injecting the current date, the recruiter's email, session ID, or any per-request string into the system prompt *before* the `cache_control` breakpoint.

**Why bad:** Invalidates the cache every request. Drops cache-hit savings from ~90% to ~0%. Silent — no error, just a 10x cost increase. With a $3/day cap, this turns into a 20-message-per-day product instead of a 200-message-per-day product.

**Instead:** All dynamic content goes in the `messages` array (as the first user-role message if it's session context, otherwise in the current turn). The system block stays frozen.

### Anti-Pattern 2 — Edge runtime for the main `/api/chat` route

**What:** Declaring `export const runtime = 'edge'` on the tool-using chat route.

**Why bad:** Edge runtime has a tighter CPU budget and lacks some Node APIs that Anthropic / Supabase SDKs sometimes reach for. Tool-calling agents benefit from the Node runtime's 300s max duration and fuller Node compatibility. The AI SDK streams fine on Node runtime — edge is not required for SSE.

**Instead:** Use the default Node runtime for `/api/chat`. Consider Edge only for `/api/health` and static framing pages if you want the latency.

### Anti-Pattern 3 — Relying on the Anthropic 5-min cache TTL during cold periods

**What:** Assuming prompt caching meaningfully reduces cost for this project's actual traffic pattern.

**Why bad:** Anthropic shortened the default prompt-cache TTL from 60 minutes to 5 minutes in early 2026. For a resume agent that gets 3 recruiter visits per day spaced hours apart, *every* session is a cache miss on the first turn. Plan for worst-case (no cache) on P(first turn) = 1/session, and cache-hit only on turns 2-N within a 5-min window. This changes the cost model: don't over-count cache savings in your budget planning.

**Instead:** Either accept the reality (most of your cost is uncached first-turn requests; that's fine at $3/day with 1500 max_output_tokens), or use Anthropic's 1-hour TTL extended-cache beta (higher write cost, better for sparse traffic).

### Anti-Pattern 4 — Trying to persist tool calls from stream chunks

**What:** Subscribing to every `data-tool-call` / `part-delta` event in `streamText` and writing to Postgres as they arrive.

**Why bad:** `onFinish` tool-call IDs may not match the stream-chunk tool-call IDs after `appendResponseMessages` reconciliation. You end up with duplicate or orphaned rows. Multiple users have hit this in the SDK issue tracker.

**Instead:** Persist once in `onFinish`, using the `response.messages` array as the source of truth. Accept that if the stream fails mid-tool-call, you log a partial-failure marker rather than pretending to have the full transcript.

### Anti-Pattern 5 — Tool that writes to Postgres

**What:** Building a tool whose `execute` function writes rows, triggers notifications, or has other side effects.

**Why bad:** Tools can be called multiple times per turn (retry, multi-step). If `execute` has side effects, you need idempotency keys, compensation logic, and a "what if the stream errors mid-tool" story. None of this is free.

**Instead:** Tools in this project are all *read-only* (Exa search, KB lookup, Haiku sub-call). All writes happen in `onFinish`. If a future tool genuinely needs a side effect, put it behind an idempotency key and be very deliberate.

### Anti-Pattern 6 — Skipping the status banner because "everything works"

**What:** Not building `/api/health` and the graceful-degradation banner because it feels like over-engineering for a personal site.

**Why bad:** The spec (§5 uptime controls, §2 graceful degradation) explicitly treats this as part of the pitch. A recruiter landing during a 10-minute Anthropic outage and seeing "I'm broken" is a worst-case outcome. The banner is the fix and it reads as "I thought about reliability" — which is the whole portfolio-artifact point.

**Instead:** Ship `/api/health` in Phase 1 or 2. It's 30 minutes of work and a significant signal.

---

## Build Order Implications

This ordering is **dependency-driven** (A must exist before B) plus **solo-PM-friendly** (each phase delivers something you can demo). It matches the spec but differs slightly from the Plan A draft in that it promotes cost controls earlier.

| Phase | Deliverable | Why this order | Blocks |
|-------|-------------|----------------|--------|
| **P0 — Scaffold** | Next.js + Tailwind + TS + vitest + `.env.example`; empty KB folder; Supabase project created; Upstash project created | Everything else depends on the shell | all |
| **P1 — KB + system prompt** | `kb/` with placeholder files; `lib/kb-loader.ts`; `lib/system-prompt.ts`; unit tests that the concatenation is deterministic and byte-identical across calls | System prompt is the substrate for everything; testing determinism now prevents the cache-invalidation footgun later | P3, P4 |
| **P2 — Session + email gate (no chat yet)** | Supabase schema (`sessions`, `messages`); `/api/session` route; `EmailGate.tsx`; framing page; `waitUntil` email notification stub | You can show someone the landing flow; persistence layer proves out; no LLM cost incurred yet | P4, P6 |
| **P3 — Local-only chat happy path** | `/api/chat` route calls Sonnet via `streamText` with system prompt + messages (no tools, no classifier, no rate limit); `ChatUI.tsx` using `useChat`; manual token counting in `onFinish` | Proves the streaming loop works end-to-end; lets you validate voice/KB content against real output early | P5, P7 |
| **P4 — Tools (all three)** | `lib/tools/index.ts` + three tool modules; `research_company` wires Exa + Haiku summarization; `get_case_study` reads from KB; `design_metric_framework` does Haiku sub-call; `TracePanel.tsx` renders tool parts; `MetricCard.tsx` renders structured result | Largest integration risk; do it once the base loop is stable | P7 |
| **P5 — Cost & abuse controls** | `lib/redis.ts`; rate-limit preflight in `/api/chat`; daily spend cap; classifier (`lib/classifier.ts`) as preflight; max_output_tokens + max conversation length enforcement; graceful 429/deflection responses | Absolutely cannot ship public without this; but must come after tools so you're not rate-limiting air | P8 |
| **P6 — Persistence polish** | Full `onFinish` pipeline: message rows, tool-call rows, token/cost fields, classifier verdict; session-ended handling; retention test | Closes the loop from live chat to admin visibility (even before dashboard exists) | P8 |
| **P7 — Graceful degradation** | `/api/health`; status banner on framing page; plain-HTML fallback page; honest in-character tool-failure messages | Small effort, outsized pitch value | P9 |
| **P8 — Admin dashboard** | Supabase Auth + GitHub OAuth; `/admin/sessions`, `/admin/costs`, `/admin/abuse`, `/admin/tool-health`; transcript viewer with trace replay | Nice to have before launch; not blocking for the MVP demo to a single recruiter | P9 |
| **P9 — Evals + launch prep** | Eval harness, ~40 cases across 6 categories, CI gate, friend-test protocol | Launch gate per spec §7 | launch |

**Dependencies flagged by this ordering:**

- P1 → P3: You can't stream a coherent chat until the system prompt exists.
- P3 → P4: Tools fail noisily if the base loop is broken; don't compose two risks.
- P4 → P5: Rate-limiting an empty system wastes a phase; classify *real* behavior once tools are live.
- P2 → P5: Spend cap needs `sessionId` and `email_domain` for attribution, which come from the session layer.
- P6 independent of P8: You can persist everything cleanly without building the dashboard. The dashboard is a *view* over persisted data.
- P7 can ship at any point after P3. Don't save it for the end.

---

## Critical Integration Points (Vercel AI SDK + Anthropic tool use + custom streaming)

These are the specific places where the three systems meet and where failure modes are most likely. Each is flagged with a source.

### Integration Point 1 — `cacheControl` placement with `streamText`

**What:** Setting `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }` on the system block only (not on tool definitions, not on messages, unless you know why).

**Gotcha:** In AI SDK 5, tool definitions can also be cached via tool-level provider options — useful for multi-step agents with stable tool schemas ([AI SDK 5 blog](https://vercel.com/blog/ai-sdk-5)). Order in Anthropic's request is `Tools → System → Messages`. If you want tools to be in the cache prefix, the breakpoint must cover them — which happens automatically if it's on the system block and tools come before it in the wire format. **Verify at runtime** by checking `usage.cachedInputTokens` in `onFinish` on the 2nd turn of a session; it should be > 90% of the input token count. If it's 0, something is invalidating the prefix.

**Confidence:** HIGH (verified against [Anthropic prompt-caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) and [AI SDK 5 release notes](https://vercel.com/blog/ai-sdk-5)).

### Integration Point 2 — Tool parts in `useChat` for the trace panel

**What:** AI SDK v5 renamed generic `tool-invocation` parts into per-tool `tool-<name>` parts, each with `state` ∈ `{input-streaming, input-available, output-available, output-error}`. The trace panel reads `message.parts` and filters on `type.startsWith('tool-')`.

**Gotcha:** Tool-input streaming is **on by default** for Anthropic in AI SDK 5. This is great for showing "thinking" in the trace panel, but it means the `input` field on a `tool-*` part may be *partial* during the `input-streaming` state. Don't render `input` as JSON until `state === 'input-available'` or later — or you'll flash malformed JSON to the user. Opt out with `toolStreaming: false` provider option if the partial flicker is worse than the delay.

**Confidence:** HIGH (verified against [AI SDK 5 blog](https://vercel.com/blog/ai-sdk-5) and [tool-calling docs](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)).

### Integration Point 3 — `onFinish` vs. streaming for persistence and cost

**What:** The canonical pattern is "stream text to the user; persist in `onFinish`; tally cost from `onFinish.usage`."

**Gotcha 1 — Multi-step persistence:** If you use `stopWhen: stepCountIs(n>1)` and tools are called, `onFinish` provides `response.messages` which contains the full multi-step trace. But there are known issues where message IDs shift between what the client sees (via `useChat`) and what `onFinish` receives after `appendResponseMessages` — leading to client/server desync if you use the ID as your persistence key ([vercel/ai discussion #4845](https://github.com/vercel/ai/discussions/4845)).

**Mitigation:** Generate your own `server_message_id` (UUIDs) at persistence time. Don't rely on AI SDK message IDs as a primary key. Keep the AI SDK IDs as a secondary `sdk_message_id` column if you need to correlate client analytics later.

**Gotcha 2 — Partial persistence on stream error:** If the stream errors after tool call 1 succeeded but during tool call 2, the assistant text is partial and `onFinish` may still fire with inconsistent state (or may not fire at all, depending on error path). Plan: wrap `streamText` in a try/catch and persist a `turn_errored` row with whatever partial data you have, so the transcript is honest.

**Confidence:** HIGH for the canonical pattern; MEDIUM for the specific edge cases (verified from [community thread on `onFinish`](https://community.vercel.com/t/tool-execution-super-unreliable-after-5-messages-in-conversation/27777) and [issue #2993](https://github.com/vercel/ai/issues/2993)).

### Integration Point 4 — Vercel function timeouts vs. multi-step tool loops

**What:** Vercel Node serverless functions have a max duration (60s on Hobby, 300s on Pro). Edge functions stream up to 300s but must send the first byte within 25s.

**Gotcha:** A multi-step agent with `research_company` (which does Exa fetch + Haiku summarize) can easily take 8-15s *before* Sonnet starts streaming visible text. Combined with a follow-up tool call, you're realistically at 30-45s. If you're on Hobby, you're one big tool call from timing out.

**Mitigation options:**
1. Stream a "working on it" text token from Sonnet *before* the first tool call (tool-input-streaming makes this easier — the model emits text first, then tools). This starts the stream within the 25s Edge budget.
2. Emit custom SSE "heartbeat" data parts every 10s during long tool execution to keep proxies from closing the connection ([Vercel streaming guide](https://vercel.com/blog/streaming-for-serverless-node-js-and-edge-runtimes-with-vercel-functions)).
3. If you're on Hobby: set `maxDuration = 60` explicitly on the route and accept the cap; your tool calls must be fast.

**Confidence:** HIGH (verified against [Vercel function limits docs](https://vercel.com/docs/functions/limitations)).

### Integration Point 5 — Upstash `@upstash/ratelimit` with spend tracking

**What:** Use `@upstash/ratelimit` with a sliding-window strategy for per-IP and per-email limits. For the daily spend cap, use a raw `INCRBY` on a key like `spend:YYYY-MM-DD` with an expiry set to midnight ET.

**Gotcha:** `@upstash/ratelimit` is connectionless (HTTP-based) which is exactly what you want on Vercel ([upstash/ratelimit-js](https://github.com/upstash/ratelimit-js)). But each rate-limit check is an HTTP round-trip to Upstash. For a 3-check preflight (IP, email, spend) you're adding 30-90ms of latency before the first token of the response. Cache client singletons and consider `Promise.all` on the three checks (they're independent).

**Confidence:** HIGH (verified against [Upstash ratelimit docs](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)).

---

## Scalability Considerations

This is the wrong question for this project (the spec explicitly caps at $3/day, small audience), but because the spec calls it out as a portfolio signal, here's the honest answer.

| Concern | At 5 sessions/day (expected) | At 50 sessions/day (viral) | At 500 sessions/day (unlikely, abuse) |
|---------|------------------------------|----------------------------|---------------------------------------|
| Anthropic cost | ~$0.50-1.50/day | ~$3/day cap hit around lunch | Spend cap halts service; Joe notified |
| Cache hit rate | ~30% (most sessions are one-shot within a 5-min window) | ~50% (more multi-turn) | Irrelevant (cap hits first) |
| Supabase rows | ~30 messages/day; <1MB/month | ~300 messages/day; ~10MB/month | Truncated by spend cap |
| Upstash RPS | <1 | <5 | <50; well within free tier |
| Vercel function invocations | Trivial | Trivial | Trivial |
| Bottleneck | None | None | Spend cap (by design) |

The architecture is comfortably over-provisioned for the expected workload. The *real* risk is not scale; it's cost abuse, which is why the spend cap is the primary defense.

---

## Sources

- [AI SDK 5 release notes (Vercel)](https://vercel.com/blog/ai-sdk-5) — tool-input streaming defaults, per-tool `tool-<name>` parts, tool-level cache control
- [AI SDK: Tool Calling reference](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) — `stopWhen`, `onFinish`, tool definition shape
- [AI SDK: streamText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — streaming UIMessages, system block provider options
- [AI SDK Providers: Anthropic](https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) — Anthropic-specific provider options, cache control placement
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — cache breakpoints, Tools → System → Messages ordering, ephemeral type
- [Claude Prompt Caching in 2026 (DEV community)](https://dev.to/whoffagents/claude-prompt-caching-in-2026-the-5-minute-ttl-change-thats-costing-you-money-4363) — 5-min TTL change and cost implications (cross-checked against Anthropic docs)
- [Streaming from serverless Node.js and Edge Runtime on Vercel](https://vercel.com/blog/streaming-for-serverless-node-js-and-edge-runtimes-with-vercel-functions) — runtime choice, heartbeat pattern, 25s/300s timing
- [Vercel function limits](https://vercel.com/docs/functions/limitations) — max duration by plan, streaming budgets
- [Upstash ratelimit-ts overview](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — sliding window / token bucket algorithms, HTTP-based client
- [upstash/ratelimit-js (GitHub)](https://github.com/upstash/ratelimit-js) — canonical SDK reference
- [AI SDK issue #2993 — onMessage callback and tool message persistence](https://github.com/vercel/ai/issues/2993) — onFinish gotchas with multi-step tools
- [AI SDK discussion #4845 — guidance on persisting messages](https://github.com/vercel/ai/discussions/4845) — persistence pattern and ID-mismatch pitfalls
- [Vercel community: tool execution unreliable after ~5 messages](https://community.vercel.com/t/tool-execution-super-unreliable-after-5-messages-in-conversation/27777) — real-world failure mode for long multi-step loops (informs `stepCountIs(5)` recommendation)
