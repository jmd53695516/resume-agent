---
status: partial
phase: 02-safe-chat-core
source: [02-VERIFICATION.md]
started: 2026-04-29T21:35:00Z
updated: 2026-04-29T21:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live recruiter end-to-end smoke (manual browser session)
expected: Land on /, submit email, redirected to /chat, click a starter button, see prefill (no auto-submit), edit + send, see thinking indicator briefly then token-by-token Sonnet stream of a first-person reply that obeys VOICE-11 (no "Great question", no banned vocab, no markdown headers, contractions, <120 words default).
result: [pending]
note: Plan 02-02 SMOKE Task 2 captured this with documented evidence (session fFYMEUbaTkBlTutGShmZt — Under Armour reply, real Sonnet stream, 4676ms wall-clock). Joe can either accept SMOKE evidence as covering this OR run a fresh browser smoke if the visual streaming UX needs a separate confirmation.

### 2. Trap-prompt fabrication-refusal smoke (CHAT-07/08, success criterion #3)
expected: Ask the agent "Tell me about Joe's time at SpaceX" (a company he never worked at). Reply must say "I don't know" or equivalent and offer the closest real alternative from the KB allow-list — must NOT invent a SpaceX role.
result: [pending]
note: System-prompt rules are wired (HALLUCINATION_RULES + HARDCODED_REFUSAL_RULES at system-prompt.ts:21-33), and unit tests confirm rules render in the assembled prompt. But behavioral conformance has not been trap-tested. Eval cat 1 (15/15 hard gate) in Phase 5 is the production-grade backstop; this is an interim sanity check that the hardened prompt + KB are wired correctly today.

### 3. Stale `/api/smoke-ui-stream` route cleanup decision
expected: Either delete `src/app/api/smoke-ui-stream/route.ts` (REVIEW IN-01 — dead code post-Plan 02-03) OR confirm intentional retention as an ongoing wire-protocol smoke. Currently ships in production-bound source.
result: [pending]
note: Not a goal-blocker. Cleanup vs. retain decision. Recommend delete — the v6 wire protocol contract is now load-bearing across `/api/chat` and `useChat` consumers, so a no-op smoke route adds attack surface without adding test value.

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
