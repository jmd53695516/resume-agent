# Phase 2: Safe Chat Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 02-safe-chat-core
**Mode:** `--auto` (Claude auto-selected recommended defaults after analyzing gray areas against spec, Phase 1 CONTEXT, and research synthesis)
**Areas discussed:** Streaming runtime & SDK; Classifier architecture; Deflection copy; Rate limits & spend cap; Token cost; System prompt extensions; Message persistence; Conversation cap; Chat UI; Turnstile wiring; Observability placeholders

---

## A — Streaming Runtime & SDK

| Option | Description | Selected |
|--------|-------------|----------|
| Node runtime + Vercel AI SDK v5 streamText | Saves ~200 LOC SSE wiring; tool-calling ready for Phase 3 | ✓ |
| Edge runtime + Vercel AI SDK | Tighter cold-start but Anthropic SDK + Supabase break on Edge | |
| Node runtime + hand-rolled SSE | Full control but duplicates what AI SDK does | |

Also selected: `stopWhen: stepCountIs(5)`, `maxDuration: 60`, `useChat` for client state.

---

## B — Classifier Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Sync preflight (blocks ~100ms) | Classifier runs BEFORE streamText; cannot be bypassed | ✓ |
| Async optimistic | Forward to Sonnet immediately, classifier parallel, terminate on bad verdict | |
| Classifier as Sonnet tool | Sonnet decides when to check — injection attacks can ask it not to (rejected per Pitfall 4) | |

Selected: Haiku 4.5, `@anthropic-ai/sdk` direct (not AI SDK — one-shot JSON), `{label, confidence}` zod-validated output, fail-closed on error.

---

## C — Deflection Copy

| Option | Description | Selected |
|--------|-------------|----------|
| In-character first-person, short, confident-not-sassy | Streamed as SSE text (no special error UI) | ✓ |
| Generic "I can't help with that" | Clinical; breaks the voice | |
| 500 error page | Poor UX; user doesn't know what happened | |

Seven distinct deflections authored (injection / offtopic / sensitive / borderline / rate-limit / spend-cap / conversation-cap).

---

## D — Rate Limits & Spend Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-key: IP + email + session + token-cost | Layered defense; single key = single bypass | ✓ |
| IP only | Insufficient (throwaway IPs; token-cost bypass) | |
| Message-count only | Abuser keeps "1 message" while costing 30x (Pitfall 2) | |

Selected: Upstash Redis + `@upstash/ratelimit` token-bucket; IP via Vercel `ipAddress()` (not raw `X-Forwarded-For`); rolling 24h sliding window for spend cap.

Specific limits (from spec): 20 msg/10min IP, 60/day IP, 150/day email, 200/session, 150 cents/day token-cost per IP, 300 cents global spend cap.

---

## E — Token Cost Calculation

| Option | Description | Selected |
|--------|-------------|----------|
| Pure function in `src/lib/cost.ts` with unit tests | Testable; handles cache read/create separately | ✓ |
| Inline in API route | Harder to test; violates separation | |

Formula uses Sonnet 4.6 + Haiku 4.5 current pricing (2026-04). Cached-read is the big discount ($0.30 vs $3 per MTok).

---

## F — System Prompt Extensions (VOICE-11 + Hardcoded Refusals)

| Option | Description | Selected |
|--------|-------------|----------|
| Static constants appended to cached prefix | Preserves byte-identical determinism (SAFE-11) | ✓ |
| Dynamic rule injection per-request | Breaks cache prefix; 10-20x cost (Pitfall 2) | |

Selected: 9 voice-negative rules + 4 hardcoded refusal rules appended BEFORE the KB block in `system-prompt.ts`. The PHASE 2 marker from Plan 01-02 is replaced with these constants. Existing determinism test must continue to pass — key Phase 2 engineering invariant.

---

## G — Message Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| `onFinish` callback, atomic per-turn, own UUIDs | Documented reliable pattern; no ID desync | ✓ |
| During streaming (chunked writes) | ID desync risk; partial rows on crash | |
| Fire-and-forget via waitUntil | Acceptable alternative but harder to test | |

Selected: `onFinish`, nanoid UUIDs for primary keys, `sdk_message_id` stored for correlation only, persistence failure logged not thrown.

---

## H — Conversation Length Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side count from Supabase messages table | Single source of truth; can't be client-bypassed | ✓ |
| Client-side counter only | Trivially bypassed via direct POST | |

Selected: count user+assistant rows per session_id; cap = 30 turns (60 rows).

---

## I — Chat UI

| Option | Description | Selected |
|--------|-------------|----------|
| `useChat` hook + streaming message list + thinking indicator + 3 starter buttons (non-auto-submit) | Minimal code, maximum UX signal, lets recruiter edit "[my company]" before send | ✓ |
| Auto-submit starter prompts | Fragile if recruiter's company name is wrong/missing | |
| No starter prompts, just free-form | Empty-state discovery problem (T-14 table stakes) | |

Assistant prose rendered without bubbles (feels like texting with Joe, not talking to a chatbot). Markdown headers stripped belt-and-suspenders.

---

## J — Turnstile Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Wired but feature-flagged OFF by default | Ready to flip in <10 min if abuse observed; no day-1 UX friction | ✓ |
| Enabled day one | Adds friction to recruiter flow unnecessarily | |
| Not wired at all | If abuse happens, 10-min hotfix becomes a deploy cycle | |

Widget loads only when `NEXT_PUBLIC_TURNSTILE_ENABLED=true`. Server-side token verification on `/api/session`.

---

## K — Observability Placeholders

| Option | Description | Selected |
|--------|-------------|----------|
| Structured JSON logs per-invocation, no alerting yet | Cheap data collection; Phase 4 adds alerts on the same data | ✓ |
| Pino full-fat wiring day 1 | Worker-thread Vercel gotcha; overkill for Phase 2 | |
| No logging | Phase 4 observability has nothing to consume | |

`console.log` fallback acceptable for Phase 2; Pino upgrade is cheap and can land later.

---

## Claude's Discretion

- Exact deflection copy wording (Claude drafts; Joe reviews, especially D-C-03 with Joe's email).
- Classifier prompt phrasing (Claude drafts using OWASP LLM01 examples).
- Chat UI typography/layout within D-I constraints.
- Rate-limit key naming in Redis (follow `resume-agent:*` convention).
- Ratelimit algorithm choice per limit type (slidingWindow vs tokenBucket).

## Deferred Ideas

None from this discussion. Every topic stayed in Phase 2 boundaries.
