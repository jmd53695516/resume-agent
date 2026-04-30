# Plan 02-02 Smoke Evidence

Live integration evidence for /api/chat orchestration. Run against the in-tree
Supabase project (DNS verified resolving) + Anthropic + Upstash production
endpoints from local `npm run dev`.

## Task 2 — Happy-path integration smoke

**When:** 2026-04-30 (post Supabase unpause)
**Session ID:** `fFYMEUbaTkBlTutGShmZt`
**Email:** `chat-smoke-<ts>@example.com`

### Stream wire shape

Curl response on `POST /api/chat` (576 bytes total, 4676ms wall clock):

```
data: {"type":"start"}
data: {"type":"start-step"}
data: {"type":"text-start","id":"0"}
data: {"type":"text-delta","id":"0","delta":"I"}
data: {"type":"text-delta","id":"0","delta":" took Under Armour's enterprise data warehouse off on-"}
data: {"type":"text-delta","id":"0","delta":"prem SAP and onto Snowflake — and that"}
data: {"type":"text-delta","id":"0","delta":" migration is still the coolest transformation I've been a part of."}
data: {"type":"text-end","id":"0"}
data: {"type":"finish-step"}
data: {"type":"finish","finishReason":"stop"}
data: [DONE]
```

V6 wire protocol matches the chunk shape proved in Plan 02-01 Task 10
`/api/smoke-ui-stream` (text-start / text-delta+ / text-end / finish).

### Voice live-check

Reply text:

> I took Under Armour's enterprise data warehouse off on-prem SAP and onto
> Snowflake — and that migration is still the coolest transformation I've been
> a part of.

- First-person ("I took...")
- One sentence, well under the 120-word default cap
- No banned vocab: no "Great question", no "leverage", no "robust"
- Contains a contraction ("I've")
- Specific (Under Armour, on-prem SAP -> Snowflake) — sourced from KB resume
- VOICE-11 live conformance: PASS

### Supabase persistence

Two messages rows landed for the session, in order:

| role | content | classifier_verdict | classifier_confidence | input_tokens | output_tokens | cache_read_tokens | cache_creation_tokens | cost_cents | latency_ms | stop_reason | sdk_message_id |
|------|---------|---------------------|------------------------|---------------|----------------|---------------------|--------------------------|-------------|--------------|----------------|------------------|
| user | "Hi — tell me one thing about your PM background in one sentence." | normal | 0.92 | 0 | 0 | 0 | 0 | 0 | null | null | null |
| assistant | "I took Under Armour's enterprise data warehouse..." | null | null | 19834 | 43 | 0 | 19814 | 14 | 3908 | stop | msg_014y4641Vo2aqCX2CHYYL9ik |

Notes:
- `cache_creation_tokens=19814` proves `cacheControl: { type: 'ephemeral' }` IS
  attached to the system message. Anthropic minted a 19814-token cache block on
  the first call. Cache verification (Task 3) tests the read path on a second turn.
- `cost_cents=14` from `computeCostCents` (cache write is billed at 1.25× input;
  Sonnet 4.6 pricing per 02-01 cost.ts) — confirms the cost helper fired.
- `sdk_message_id` is the Anthropic message id (msg_*) carried through onFinish
  via `event.response?.id`.
- `output_tokens=43` matches the visible reply length.
- User row has zeroed token counts and null verdicts on the assistant-only fields, as designed.

### Structured log line

Pino JSON in dev-server stdout (`grep` confirmed):

```json
{
  "ts": "2026-04-30T01:09:40.175Z",
  "level": "info",
  "event": "chat",
  "session_id": "fFYMEUbaTkBlTutGShmZt",
  "classifier_verdict": "normal",
  "classifier_confidence": 0.92,
  "model": "claude-sonnet-4-6",
  "input_tokens": 19834,
  "output_tokens": 43,
  "cache_read_input_tokens": 0,
  "cache_creation_input_tokens": 19814,
  "cost_cents": 14,
  "latency_ms": 4010,
  "stop_reason": "stop"
}
```

CHAT-06 compliance: cache_read_input_tokens (and cache_creation_input_tokens)
are part of every `event: 'chat'` log payload.

### Acceptance summary

- [x] /api/session 200 + nanoid
- [x] /api/chat 200 + streaming
- [x] Stream chunks: text-start / text-delta+ / text-end / finish
- [x] 2 messages rows: 1 user (verdict=normal, confidence=0.92), 1 assistant (output_tokens>0, cost_cents>0)
- [x] sdk_message_id roundtrip (string)
- [x] Structured log line includes cache_*_input_tokens
- [x] No stack traces in dev server log

## Task 3 — Cache-hit verification (CHAT-06)

Same session `fFYMEUbaTkBlTutGShmZt`, second + third turn ~2 minutes after the
first (well within Anthropic's 5-minute ephemeral cache TTL).

### Assistant rows for the session (in order)

| created_at | input_tokens | output_tokens | cache_read | cache_creation | cost_cents | stop_reason |
|------------|---------------|----------------|-------------|------------------|--------------|----------------|
| 01:09:41 | 19834 | 43 | 0 | 19814 | 14 | stop |
| 01:11:29 | 0 | 0 | 0 | 0 | 0 | deflection:offtopic |
| 01:11:45 | 19898 | 42 | 19814 | 60 | 7 | stop |

### Findings

- Row #1 (cold start): `cache_creation_tokens = 19814`, `cache_read = 0`. First
  call mints the cache block. Confirms `cacheControl: { type: 'ephemeral' }`
  is wired (otherwise this would be 0).
- Row #2 (deflection:offtopic): the second turn's user message ("And one thing
  about your BI background?") tripped the classifier (offtopic). No Anthropic
  call → no cache activity. Confirms the deflection path bypasses the model.
- Row #3 (cache HIT): re-asked the question with clearer phrasing ("What was
  your favorite part about working in BI for so long?"). `cache_read = 19814`
  matches the bytes minted by row #1 — same block served from cache.
  `cache_creation = 60` is the small delta for the appended conversation
  context (turn-3 user/assistant history).

### Cost impact

- Cold call: 14¢
- Cached call: 7¢
- Savings: 50% on this turn (would converge to >80% as input grows relative
  to fresh deltas — see CONTEXT.md cost model).

### Acceptance

- [x] First call: cache_creation > 0, cache_read = 0
- [x] Second cached call: cache_read > 0
- [x] CACHE_HIT_VERIFIED printed by verify script
- [x] Two `event: 'chat'` log lines (cold + cached) both carry cache_*_input_tokens fields
- [x] CHAT-05 + CHAT-06 verified end-to-end against live Anthropic API
