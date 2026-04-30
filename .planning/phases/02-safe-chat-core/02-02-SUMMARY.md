---
phase: 02-safe-chat-core
plan: 02
subsystem: api-route
tags: [api-route, streaming, anthropic-sonnet, ai-sdk-v6, rate-limiting, spend-cap, classifier, onfinish-persistence, cache-control]
dependency_graph:
  requires:
    - 02-01-SUMMARY (lib primitives — anthropic, classifier, cost, persistence, redis, system-prompt, supabase-server, env)
    - 01-03-SUMMARY (sessions table + /api/session)
    - 01-02-SUMMARY (KB scaffold + buildSystemPrompt)
  provides:
    - "POST /api/chat: six-gate orchestration with v6 streaming Sonnet, cache-controlled system prompt, onFinish persistence, deflection-path persistence on every gate"
    - "Live-verified contract for Plan 02-03 ChatUI useChat({ api: '/api/chat' }) wiring"
    - "Live-verified contract for Plan 02-04 Turnstile (/api/chat unchanged by Turnstile gate; only /api/session is touched)"
    - "Cache-hit baseline (cost_cents 14 cold -> 7 cached on a 19814-token prompt)"
    - "Spend cap, turn cap, classifier injection, rate limit deflection paths all verified live"
  affects:
    - "Phase 3: tools layer will mount under streamText `tools: {}` field; SAFE-15 stepCountIs(5) is already wired"
    - "Phase 4: admin dashboard transcript view will read messages with the stop_reason taxonomy verified here (deflection:{spendcap|turncap|ratelimit|injection|offtopic|sensitive|borderline} | stop)"
    - "Phase 5: pre-launch SAFE-12 checkpoint (Anthropic org-level $20/mo cap) is the only remaining cost-safety control"
tech_stack:
  added: []
  patterns:
    - "Cheapest-first six-gate orchestration: body -> session -> turn-cap -> spend-cap -> rate-limits -> classifier -> Sonnet"
    - "Deflection streaming via createUIMessageStream/createUIMessageStreamResponse — same wire envelope as Sonnet replies (no separate error UI)"
    - "Try/catch around every persistence call (onFinish + every deflection path) — DB blip never blocks the user-visible response"
    - "Provider-options cacheControl with array-form `system` field (not bare string) — proven to attach the cache_control header"
    - "ipKey fallback chain: ipAddress(req) ?? x-forwarded-for first hop ?? 'dev'"
    - "Client-abort handling: onAbort logs `event: chat_aborted`; onError persists a deflection-shaped row so admin can flag stream failures"
key_files:
  created:
    - path: "src/app/api/chat/route.ts"
      role: "Phase 2 hot path: six-gate orchestration + streaming Sonnet + onFinish persistence"
    - path: ".planning/phases/02-safe-chat-core/02-02-SMOKE.md"
      role: "Live integration evidence: happy path, cache hit, four trip tests, final regression sweep"
    - path: ".planning/phases/02-safe-chat-core/02-02-SUMMARY.md"
      role: "This file"
  modified: []
decisions:
  - "Wrapped every deflection-path persistDeflectionTurn in try/catch (D-G-05; RESEARCH template only did this for the onFinish path)"
  - "Kept onAbort + onError as twin handlers: onError persists a deflection-shaped row with stop_reason=deflection:offtopic + content marker '[streamText error]'; onAbort logs `event: chat_aborted` only (no row, since no useful content)"
  - "Used Redis-poison variant for the rate-limit trip test (cheap, deterministic) instead of the 21-curl flood (would have cost ~$0.10 in real Sonnet billing)"
  - "Discovered ipKey resolves to `::1` (IPv6 localhost) on Next.js dev — NOT `dev`. Documented in SMOKE.md so future dev-environment debugging is faster"
requirements_completed:
  - CHAT-01
  - CHAT-02
  - CHAT-06
  - CHAT-07
  - CHAT-08
  - CHAT-09
  - CHAT-10
  - CHAT-11
  - SAFE-01
  - SAFE-02
  - SAFE-03
  - SAFE-04
  - SAFE-05
  - SAFE-06
  - SAFE-07
  - SAFE-08
  - SAFE-09
requirements_partial:
  - SAFE-15
requirements_operational:
  - SAFE-12
metrics:
  duration_minutes: 45
  completed_date: "2026-04-30"
  tasks: 6
  files_created: 3
  files_modified: 0
  tests_added: 0
  tests_total: 48
  cold_call_cost_cents: 14
  cached_call_cost_cents: 7
  cache_savings_pct: 50
---

# Phase 2 Plan 2: /api/chat six-gate orchestration + live integration verification Summary

The single hot-path file orchestrating Phase 2's full request lifecycle — body validation, session lookup, 30-turn cap, spend cap, multi-key rate limits, Haiku classifier, then Sonnet 4.6 with cached system prompt and onFinish persistence — implemented and verified end-to-end against live Supabase, Anthropic, and Upstash with all six gates trip-tested and prompt caching observably saving 50% on the second turn.

## Tasks completed

| # | Name | Commit | Notes |
|---|------|--------|-------|
| 1 | Build /api/chat/route.ts with the six-gate orchestration | `1639f69` | Initial executor session pre-Supabase-unpause; 301-line implementation with both Adjustment 1 (try/catch on every deflection persist) and Adjustment 2 (onAbort + onError twin handlers) applied |
| 2 | Happy-path integration smoke | `f20734b` | Real session, real Sonnet, 2 messages rows landed, voice live-check passed |
| 3 | Cache-hit verification | `f54b29b` | Cold create=19814 -> warm read=19814; 50% cost savings on the cached call |
| 4 | Synthetic trip tests (spend / turn / classifier / ratelimit) | `54ab590` | All four PASS; deflection text + stop_reason + zero Sonnet billing on each |
| 5 | CHECKPOINT — SAFE-12 Anthropic org-level spend limit | (deferred) | Joe deferred to Phase 5 pre-launch; Plan 02-02 does not block on this |
| 6 | Final regression sweep | (no commit; SMOKE.md folded in via Task 4) | 48/48 vitest, tsc clean, npm run build green, final dev-server smoke confirms full pipeline |

## Live integration evidence

(Full detail in `02-02-SMOKE.md`.)

### Happy path (Task 2)

- Session `fFYMEUbaTkBlTutGShmZt`
- Single user message; Sonnet 4.6 streamed back: "I took Under Armour's enterprise data warehouse off on-prem SAP and onto Snowflake..."
- VOICE-11 live conformance: first-person, contractions, no banned vocab, specific, <120 words.
- Supabase: 2 rows. User row classifier_verdict=`normal`, confidence=0.92. Assistant row input_tokens=19834, output_tokens=43, cache_creation_tokens=19814, cost_cents=14, latency_ms=3908, stop_reason=`stop`, sdk_message_id=`msg_014y4641Vo2aqCX2CHYYL9ik`.
- Pino structured log line: `event: 'chat'` carries `cache_read_input_tokens`, `cache_creation_input_tokens`, `cost_cents`, `latency_ms`, `stop_reason` (CHAT-06 compliance).

### Cache hit (Task 3)

| Turn | input | output | cache_read | cache_creation | cost_cents |
|------|-------|--------|-------------|------------------|--------------|
| Cold | 19834 | 43 | 0 | 19814 | 14 |
| Warm (~2 min later) | 19898 | 42 | 19814 | 60 | 7 |

`cacheControl: { type: 'ephemeral' }` is verifiably attached to the system message. CHAT-05 + CHAT-06 verified end-to-end.

### Trip tests (Task 4)

| Gate | Method | Latency | Stop reason | Sonnet cost |
|------|--------|---------|--------------|---------------|
| Spend cap (SAFE-04/09) | incrementSpend(300) -> 321¢ | 489ms | deflection:spendcap | $0 |
| Turn cap (CHAT-10) | seed 60 messages | 282ms | deflection:turncap | $0 |
| Classifier injection (SAFE-01..03) | DAN-style jailbreak | ~1s (Haiku only) | deflection:injection | $0 (Sonnet skipped) |
| Rate limit (SAFE-05) | Redis-poison `::1` ipLimiter10m × 25 | 457ms | deflection:ratelimit | $0 |

Each deflection path persists a complete user+assistant turn record. The Haiku classifier returned 0.99 confidence on the DAN prompt — well above the 0.7 borderline threshold.

### Bonus deflection paths verified

A bonus run during the cache-hit test also exercised the `offtopic` path live (deflection text + stop_reason=`deflection:offtopic`, cost=0¢). Combined with unit-tested `borderline` and `sensitive` paths from Plan 02-01, all 7 deflection reasons in `DEFLECTIONS` are covered.

### Final regression sweep (Task 6)

- Vitest: 48 tests passing (43 from Plan 02-01 + 5 Turnstile from Plan 02-04). Zero failing.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: compiles in 3.5s; route map shows `/api/chat` as a dynamic Node-runtime route.
- Final dev-server smoke: 3 calls (2 short prompts deflected as offtopic — see Classifier Sensitivity below; 1 substantive prompt streamed Sonnet to completion with finishReason=`stop`).

## Deviations from Plan

Plan executed exactly as written. Both deliberate adjustments specified in Task 1's plan text were applied:

- Adjustment 1 (try/catch on every deflection persist): in route.ts at lines 116-128 (turncap), 135-146 (spendcap), 156-168 (ratelimit), 174-186 (borderline), 189-201 (non-normal verdict). All five deflection sites covered.
- Adjustment 2 (onAbort + onError): in route.ts at lines 258-283. `onError` persists a deflection-shaped row with content marker `[streamText error]` and reason `offtopic`; `onAbort` logs `event: 'chat_aborted'` only.

No auto-fixes (Rules 1-3) needed during Tasks 2-6. The route.ts implementation from Task 1 worked first-try against live infrastructure once Supabase was unpaused.

## Authentication gates

Single auth gate occurred earlier in Task 1 (Supabase auto-pause -> ENOTFOUND). Joe resolved by manually unpausing the Supabase project. Tasks 2-6 ran cleanly against live infrastructure with all 8 env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `EXA_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY`) loaded from `.env.local` by Next.js dev server.

## SAFE-12 status — DEFERRED

SAFE-12 (Anthropic org-level $20/month spend limit) is the Task 5 checkpoint of this plan. Joe **deferred** to Phase 5 pre-launch:

- The in-code $3/day spend cap (SAFE-04, verified live in Task 4 Test A) IS active and is currently the only spend defense.
- The deferred SAFE-12 belt-and-suspenders cap will be set during Phase 5 pre-launch via console.anthropic.com -> Settings -> Billing -> Usage Limits.
- Phase 5 plan MUST re-surface this as a blocking checkpoint before the public URL goes live.
- REQUIREMENTS.md marks SAFE-12 as Pending (NOT Complete).

## Classifier sensitivity observation (out-of-scope finding)

During live runs, the Haiku classifier flagged 3 short, generic recruiter-style prompts as `offtopic`:

- "And one thing about your BI background?"
- "One sentence about your PM background."
- "Tell me about one of your favorite product management projects."

But the same content with conversational framing ("Hi — tell me one thing about your PM background in one sentence.") classified as `normal`. This is NOT a Plan 02-02 regression — orchestration is working as designed. It IS a classifier-prompt-tuning concern for Phase 5:

- Phase 5 eval cat 5 (abuse resilience) should add a false-positive corpus of legitimate short recruiter prompts.
- If false-positive rate >10%, tune `src/lib/classifier.ts` prompt to be more permissive on short prompts.

Logged here so Phase 5 planner picks this up. Filed in SMOKE.md as well.

## Operational watch items

- **Supabase free-tier auto-pause** — already in STATE.md blockers as a Phase 5 watch item. The previous executor (Task 1) hit ENOTFOUND on the bare-domain Supabase URL because the project had auto-paused after 7 days of inactivity. Recommended Phase 5 mitigation: cron-job.org keep-alive ping every 5 min during business hours (also serves OBSV-14). NOT in scope for Plan 02-02.
- **SAFE-12 Anthropic org cap** — deferred to Phase 5 pre-launch.

## Handoff notes

### To Plan 02-03 (UI)

`/api/chat` is ready and live-verified.

- `useChat({ api: '/api/chat' })` will work as expected with v6 SSE wire protocol.
- Pass `body: { session_id }` (or use `sendMessage` body merge) — the route reads `session_id` + `messages[]` from the body.
- Deflections stream the same envelope as normal replies (text-start / text-delta / text-end / [DONE]) — no special UI branch needed.
- Stream chunk shape verified in Task 2 evidence; matches Plan 02-01 Task 10 baseline at `/api/smoke-ui-stream`.

### To Plan 02-04 (Turnstile)

`/api/chat` is unchanged by Turnstile wiring. Per CONTEXT.md D-J-04, Turnstile lives on the framing page and `/api/session` only. Plan 02-02 does not interact with Turnstile.

### To Phase 3 (Tools)

- `stepCountIs(5)` is already wired on `streamText` (SAFE-15 prep, currently inert because Phase 2 has zero tools).
- Tools mount under `streamText({ ..., tools: { ... } })`. The `onFinish` event signature already handles `event.steps` for multi-step traces.
- Duplicate-arg loop guard (full SAFE-15) is Phase 3's job — stub at `stepCountIs(5)` is the cap-only half.
- TOOL-09 (treat fetched Exa content as data, never instructions) is Phase 3's threat-model addition — Phase 2 explicitly accepts this as deferred (T-02-02-06).

## Self-Check: PASSED

- src/app/api/chat/route.ts: FOUND (commit 1639f69)
- .planning/phases/02-safe-chat-core/02-02-SMOKE.md: FOUND (commits f20734b, f54b29b, 54ab590)
- Commits referenced: 1639f69 FOUND; f20734b FOUND; f54b29b FOUND; 54ab590 FOUND
- All 17 requirements_completed have evidence in SMOKE.md or are unit-tested in Plan 02-01
- SAFE-15 partial flag: stepCountIs(5) is in route.ts at line 219; full duplicate-arg guard documented as Phase 3 work
- SAFE-12 operational flag: NOT marked complete in REQUIREMENTS.md per Joe's deferral decision
