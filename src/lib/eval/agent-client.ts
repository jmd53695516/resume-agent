// src/lib/eval/agent-client.ts
//
// Plan 05-03 Task 4. Shared /api/chat caller + streaming-response parser
// for the eval CLI. Used by all cat runners (Plans 05-04 cat1, 05-05 cat2/cat3,
// 05-06 cat4-judge, 05-07 cat5/cat6) so the streaming-format parsing lives
// in ONE place.
//
// Quick task 260509-q00: mintEvalSession added — POSTs to /api/session and
// returns the real session_id. BL-17 hardened /api/chat to validate session
// existence in Supabase, so the eval CLI can no longer fabricate synthetic
// `eval-cli-cat<N>-<case_id>` strings — it has to mint the same way the
// EmailGate UI does.
//
// Reference fixture: .eval-tmp/sample-stream.txt (captured by Plan 05-03 Task 4
// from a live `npm run dev` /api/chat call). Re-capture if /api/chat or AI SDK
// upgrades.
//
// **DEVIATION FROM PLAN SPEC:** The plan assumed AI SDK v6 emits short-prefix
// codes (`0:"text"`, `2:{}`, `9:{}`, `a:{}`, `d:{}`, `e:{}`). Live capture of
// the route's `createUIMessageStreamResponse` (route.ts line 89-99 deflection
// path; line 431 streamText path via toUIMessageStreamResponse) shows it
// actually emits OpenAI-style data-prefixed SSE:
//
//   data: {"type":"text-start","id":"..."}
//
//   data: {"type":"text-delta","id":"...","delta":"Not sure I caught..."}
//
//   data: {"type":"text-end","id":"..."}
//
//   data: [DONE]
//
// Event types observed:
//   text-start      one per assistant text run, opens the channel
//   text-delta      contains the `delta` token chunk we concatenate
//   text-end        closes the text run
//   tool-call*      (will appear on tool-call paths; ignored for the text channel)
//   [DONE]          stream terminator (not JSON; recognized by literal match)
//
// This parser:
//   - parses each `data: <json>` line
//   - filters for `type === 'text-delta'`
//   - concatenates `delta` strings
//   - silently skips malformed lines and the `data: [DONE]` terminator
//   - never throws on bad input

import { childLogger } from '@/lib/logger';

const sessionLog = childLogger({ event: 'eval_session_minted' });

interface TextDeltaEvent {
  type: 'text-delta';
  delta: string;
}

function isTextDelta(v: unknown): v is TextDeltaEvent {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { type?: unknown }).type === 'text-delta' &&
    typeof (v as { delta?: unknown }).delta === 'string'
  );
}

/**
 * Extract the assistant text channel from a raw AI SDK streaming response body.
 * Concatenates all `text-delta` events; ignores text-start/text-end, tool-call
 * events, and the `[DONE]` terminator. Defensive: malformed lines are silently
 * skipped; never throws.
 */
export function parseChatStream(rawBody: string): string {
  if (!rawBody) return '';
  const parts: string[] = [];
  // Each event is a `data: <payload>` line. SSE spec: events separated by
  // blank lines. We split on newlines and process line-by-line.
  for (const line of rawBody.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trimStart(); // strip "data:" + leading WS
    if (payload === '' || payload === '[DONE]') continue;
    try {
      const parsed: unknown = JSON.parse(payload);
      if (isTextDelta(parsed)) {
        parts.push(parsed.delta);
      }
    } catch {
      // Malformed JSON — skip the line, keep accumulating.
    }
  }
  return parts.join('');
}

/**
 * Call /api/chat and return the parsed assistant text reply + HTTP status.
 * Used by every cat runner. session_id MUST be a real session minted via
 * /api/session (the chat route validates it against Supabase and returns 404
 * for unknown sessions; see BL-17 in 05-01-HUMAN-UAT-RESULTS.md).
 */
export async function callAgent(args: {
  targetUrl: string;
  prompt: string;
  sessionId: string;
}): Promise<{ response: string; httpStatus: number; rawBody: string }> {
  let res: Response;
  try {
    res = await fetch(`${args.targetUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: args.sessionId,
        messages: [
          {
            id: 'eval-u1',
            role: 'user',
            parts: [{ type: 'text', text: args.prompt }],
          },
        ],
      }),
    });
  } catch (err) {
    // Network-level failure (DNS, TCP, etc.). Surface with original message.
    throw new Error(
      `callAgent network error for ${args.targetUrl}/api/chat: ${(err as Error).message}`,
    );
  }
  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(
      `callAgent failed: ${res.status} ${res.statusText} body=${rawBody.slice(0, 200)}`,
    );
  }
  // If the stream contained no text-deltas (rare; tool-only response or empty),
  // fall back to the raw body trimmed so the judge has something to grade
  // rather than an empty string.
  const response = parseChatStream(rawBody) || rawBody.slice(0, 2000);
  return { response, httpStatus: res.status, rawBody };
}

/**
 * Mint a real session_id by POSTing to /api/session, mirroring what the
 * EmailGate UI does. The eval CLI must NOT use synthetic session_id strings:
 * /api/chat (BL-17) validates session existence in Supabase and returns 404
 * for unknown ids. Use a synthetic but stable email so eval-generated session
 * rows are visually distinct from real recruiter traffic in the admin
 * dashboard (`email_domain='joedollinger.dev'`).
 *
 * Throws on non-200, missing id field, non-JSON body, or network failure —
 * caller's try/catch wraps this into a per-case error rationale, or the
 * runner-startup case lets the error propagate up so the run fails loud and
 * fast (one bad mint should not produce 15 silent per-case error rows).
 *
 * Turnstile NOT supported here. /api/session reads
 * NEXT_PUBLIC_TURNSTILE_ENABLED at call time; default off in dev. If the flag
 * is on during a smoke run, /api/session returns 400 turnstile_missing and
 * this helper surfaces that error verbatim with the body prefix.
 */
export async function mintEvalSession(targetUrl: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${targetUrl}/api/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'eval-cli@joedollinger.dev' }),
    });
  } catch (err) {
    throw new Error(
      `mintEvalSession network error for ${targetUrl}/api/session: ${(err as Error).message}`,
    );
  }
  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(
      `mintEvalSession failed: ${res.status} ${res.statusText} body=${rawBody.slice(0, 200)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error(
      `mintEvalSession returned non-JSON body: ${rawBody.slice(0, 200)}`,
    );
  }
  const id = (parsed as { id?: unknown })?.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(
      `mintEvalSession response missing id field: ${rawBody.slice(0, 200)}`,
    );
  }
  sessionLog.info({ targetUrl, sessionId: id }, 'eval_session_minted');
  return id;
}
