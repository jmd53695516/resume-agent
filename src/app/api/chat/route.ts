// src/app/api/chat/route.ts
// Phase 2 hot path: body -> session -> turn-cap -> spend-cap -> rate-limits ->
// classifier -> streamText(Sonnet) -> onFinish(persist + increment).
// See .planning/phases/02-safe-chat-core/02-RESEARCH.md §Pattern 1 for rationale.
//
// Six gates, cheapest-first (D-D-01 / SAFE-09):
//   1. Body validation (zod)
//   2. Session lookup (Supabase)
//   3. 30-turn cap (CHAT-10 — count messages, deflect at 60 rows = 30 user+assistant pairs)
//   4. Spend cap (SAFE-04 / D-D-07 — Redis 24h rolling >= 300¢)
//   5. Rate limits (SAFE-05/06/07/08 — per-IP/email/session + per-IP cost)
//   6. Classifier (SAFE-01..03 — Haiku verdict; <0.7 -> borderline)
// Then streamText(Sonnet) with cached system prompt and onFinish persistence.
//
// QUICK TASK 260512-tku (2026-05-13): Gates 4 + 5 are wrapped behind the
// SAFETY_GATES_ENABLED env-var feature flag (default OFF). When flag is OFF
// (the current production state), gates 4 + 5 are SKIPPED at runtime — only
// the Anthropic org-level $100/mo spend cap remains as cost backstop.
// Re-enable: set SAFETY_GATES_ENABLED='true' in Vercel envs. See SEED-002.
//
// Deviations from RESEARCH.md template (deliberate, see Plan 02-02 Task 1 §Adjustments):
//  - All deflection-path persistDeflectionTurn calls wrapped in try/catch (D-G-05).
//    Persistence failures don't block the user-visible deflection.
//  - onAbort handler added alongside onError. v6 streamText fires onAbort on
//    client-initiated abort (T-02-02-12 / Pitfall G). Verified against
//    node_modules/ai/dist/index.d.ts — onAbort exists in v6 with signature
//    (event: { steps }) => Promise<void> | void.
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import type { UIMessage } from 'ai';
import { ipAddress } from '@vercel/functions';
import { after } from 'next/server';
import { z } from 'zod';
import { anthropicProvider, MODELS } from '@/lib/anthropic';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { classifyUserMessage } from '@/lib/classifier';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  redis,
  checkRateLimits,
  isOverCap,
  incrementSpend,
  incrementIpCost,
  isEmailSpendCapAllowlisted,
} from '@/lib/redis';
import { computeCostCents, normalizeAiSdkUsage } from '@/lib/cost';
import {
  persistNormalTurn,
  persistDeflectionTurn,
  persistToolCallTurn,
} from '@/lib/persistence';
import {
  research_company,
  get_case_study,
  design_metric_framework,
  enforceToolCallDepthCap,
} from '@/lib/tools';
import { claimAndSendSessionEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60; // D-A-04 / Pitfall F

const BodySchema = z.object({
  session_id: z.string().min(10).max(30),
  messages: z.array(z.any()).min(1).max(200), // coarse — AI SDK validates message shape downstream
});

// Deflection text — values from CONTEXT.md D-C-01..07.
const DEFLECTIONS = {
  injection:
    "I only engage with questions about my background or the three tools I can run. Happy to chat about either — what's on your mind?",
  offtopic:
    "That's outside what I can help with here. I can talk about my background in PM / BI, pitch why I'd fit a specific company, walk you through a past project, or design a metric framework.",
  sensitive:
    "I don't discuss compensation specifics via chat. Drop your email on the previous page and I'll reply directly. Same for anything related to former employers — I'd rather have that conversation with a human.",
  borderline:
    "Not sure I caught that. Can you rephrase? I'm good with background questions or running the three tools.",
  ratelimit:
    "You've been at this a bit — my rate limit just kicked in. Give it a few minutes and come back, or email Joe directly.",
  spendcap:
    "I'm taking a breather for the day — back tomorrow, or email Joe directly at joe.dollinger@gmail.com.",
  turncap:
    "We've covered a lot. Rather than keep going over chat, email Joe directly — he'll have better context for a real conversation.",
} as const;

type DeflectionReason = keyof typeof DEFLECTIONS;

function deflectionResponse(reason: DeflectionReason): Response {
  const text = DEFLECTIONS[reason];
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute({ writer }) {
        const id = crypto.randomUUID();
        // Phase 05.1 Item #7: transient sideband signal so the eval CLI can
        // distinguish deflections from real model responses without parsing
        // model output text. transient: true keeps the chunk out of useChat's
        // message-rebuild path, so production UI behavior is byte-identical
        // (Phase 2 D-G-01..05 contract preserved). See
        // node_modules/ai/dist/index.d.ts:2151-2158 for DataUIMessageChunk shape.
        writer.write({ type: 'data-deflection', data: { reason }, transient: true });
        writer.write({ type: 'text-start', id });
        writer.write({ type: 'text-delta', id, delta: text });
        writer.write({ type: 'text-end', id });
      },
    }),
  });
}

export async function POST(req: Request): Promise<Response> {
  const started = Date.now();

  // Quick task 260512-tku: temporary kill-switch for gates 4 (spend-cap) and 5
  // (rate-limits). Default OFF (unset / anything other than literal 'true' = gates
  // SKIPPED). Re-enable by setting SAFETY_GATES_ENABLED='true' in Vercel envs;
  // no code change required. SEED-002 tracks re-activation criteria. SECURITY:
  // while OFF, only Anthropic org-level $100/mo cap is the cost backstop —
  // public-facing agent at https://joe-dollinger-chat.com is exposed to ~$100
  // drain if URL discovered. Joe accepted this exposure window 2026-05-13.
  // SEED-001 helpers (EVAL_CLI_ALLOWLIST etc. in src/lib/redis.ts) BYTE-IDENTICAL
  // — un-flagging restores SEED-001 protection unchanged. Call-time read (NOT
  // module scope) mirrors Phase 02-04 Turnstile precedent (STATE.md line 108)
  // so vitest can mutate the flag per-test without resetModules ceremony.
  const SAFETY_GATES_ENABLED = process.env.SAFETY_GATES_ENABLED === 'true';

  // 1. body validation
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { session_id, messages } = parsed.data;
  const uiMessages = messages as UIMessage[];
  const lastUser = extractLastUserText(uiMessages);
  if (!lastUser) {
    return Response.json({ error: 'No user message' }, { status: 400 });
  }

  // 2. session lookup
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('email, email_domain, ended_at')
    .eq('id', session_id)
    .single();
  // BL-17: discriminate genuine session-not-found (PGRST116 = .single()
  // got 0 rows) from infrastructure failure (Supabase unreachable, auth
  // error, etc.). Conflating them returned 404 on network failure, which
  // useChat treats as graceful-end and silently absorbs — defeating the
  // 2-consecutive-500 redirect protection in ChatUI.
  if (sessionErr) {
    if (sessionErr.code === 'PGRST116') {
      return Response.json({ error: 'Session unknown' }, { status: 404 });
    }
    log(
      {
        event: 'session_lookup_failed',
        error_message: sessionErr.message,
        error_code: sessionErr.code ?? 'unknown',
        session_id,
      },
      'error',
    );
    return Response.json({ error: 'Service unavailable' }, { status: 503 });
  }
  if (!session || session.ended_at) {
    return Response.json({ error: 'Session ended' }, { status: 404 });
  }

  // 3. 30-turn cap (CHAT-10) — 30 user+assistant pairs == 60 rows
  const { count: turnRows } = await supabaseAdmin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session_id)
    .in('role', ['user', 'assistant']);
  if ((turnRows ?? 0) >= 60) {
    try {
      await persistDeflectionTurn({
        session_id,
        user_text: lastUser,
        verdict: null,
        deflection_text: DEFLECTIONS.turncap,
        reason: 'turncap',
      });
    } catch (e) {
      // D-G-05: persistence failures must not block the deflection response.
      log(
        {
          event: 'persistence_failed',
          where: 'persistDeflectionTurn(turncap)',
          error_class: (e as Error).name ?? 'Error',
          error_message: (e as Error).message,
          session_id,
        },
        'error',
      );
    }
    log({ event: 'deflect', reason: 'turncap', session_id });
    return deflectionResponse('turncap');
  }

  // 4. spend cap (SAFE-04 / SAFE-09) — GATED by SAFETY_GATES_ENABLED (260512-tku).
  // When flag is OFF, gate is skipped entirely: isEmailSpendCapAllowlisted is
  // never consulted, isOverCap() is never called, no deflection fires. Counters
  // still increment in onFinish (observability preserved). SEED-001 / D-A-01
  // allowlist helpers remain present in src/lib/redis.ts for un-flagging.
  //
  // SEED-001 / D-A-01 / quick task 260512-ro4 (per .planning/quick/
  // 260512-ro4-exempt-eval-cli-joedollinger-dev-from-sa/260512-ro4-PLAN.md):
  // allowlisted emails (eval-cli@joedollinger.dev) short-circuit the cap
  // entirely — they neither read it nor pay for the deflection. Per-IP cost
  // cap (SAFE-08) below at gate 5 is the new last-line cost backstop for
  // eval-cli traffic. An attacker spoofing the email is still capped at
  // 150¢/day per source IP and 60 msgs/day per IP (ip10m + ipday).
  if (SAFETY_GATES_ENABLED) {
    if (!isEmailSpendCapAllowlisted(session.email) && (await isOverCap())) {
      try {
        await persistDeflectionTurn({
          session_id,
          user_text: lastUser,
          verdict: null,
          deflection_text: DEFLECTIONS.spendcap,
          reason: 'spendcap',
        });
      } catch (e) {
        log(
          {
            event: 'persistence_failed',
            where: 'persistDeflectionTurn(spendcap)',
            error_class: (e as Error).name ?? 'Error',
            error_message: (e as Error).message,
            session_id,
          },
          'error',
        );
      }
      log({ event: 'deflect', reason: 'spendcap', session_id });
      return deflectionResponse('spendcap');
    }
  }

  // 5. rate limits (SAFE-05..08) — GATED by SAFETY_GATES_ENABLED (260512-tku).
  // When flag is OFF, gate is skipped entirely: checkRateLimits() is never
  // called, no deflection fires. Note: ipKey is ALSO consumed by
  // incrementIpCost in onFinish (per-IP cost observability) — therefore the
  // ipKey computation lives OUTSIDE this conditional. The conditional wraps
  // only the limiter call + deflection branch.
  const ipKey =
    ipAddress(req) ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'dev';
  if (SAFETY_GATES_ENABLED) {
    const rl = await checkRateLimits(ipKey, session.email, session_id);
    if (!rl.ok) {
      try {
        await persistDeflectionTurn({
          session_id,
          user_text: lastUser,
          verdict: null,
          deflection_text: DEFLECTIONS.ratelimit,
          reason: 'ratelimit',
        });
      } catch (e) {
        log(
          {
            event: 'persistence_failed',
            where: 'persistDeflectionTurn(ratelimit)',
            error_class: (e as Error).name ?? 'Error',
            error_message: (e as Error).message,
            session_id,
          },
          'error',
        );
      }
      log({ event: 'deflect', reason: 'ratelimit', which: rl.which, session_id });
      return deflectionResponse('ratelimit');
    }
  }

  // 6. classifier (SAFE-01..03)
  // Pass the last assistant turn as an anchor so short follow-up replies
  // (e.g. "Nike" after "which company are you recruiting for?") are not
  // incorrectly deflected as offtopic. undefined on first turn — no change
  // to existing single-turn behavior.
  const lastAssistant = extractLastAssistantText(uiMessages);
  const verdict = await classifyUserMessage(lastUser, lastAssistant);
  if (verdict.confidence < 0.7) {
    try {
      await persistDeflectionTurn({
        session_id,
        user_text: lastUser,
        verdict,
        deflection_text: DEFLECTIONS.borderline,
        reason: 'borderline',
      });
    } catch (e) {
      log(
        {
          event: 'persistence_failed',
          where: 'persistDeflectionTurn(borderline)',
          error_class: (e as Error).name ?? 'Error',
          error_message: (e as Error).message,
          session_id,
        },
        'error',
      );
    }
    log({ event: 'deflect', reason: 'borderline', verdict, session_id });
    return deflectionResponse('borderline');
  }
  if (verdict.label !== 'normal') {
    try {
      await persistDeflectionTurn({
        session_id,
        user_text: lastUser,
        verdict,
        deflection_text: DEFLECTIONS[verdict.label],
        reason: verdict.label,
      });
    } catch (e) {
      log(
        {
          event: 'persistence_failed',
          where: `persistDeflectionTurn(${verdict.label})`,
          error_class: (e as Error).name ?? 'Error',
          error_message: (e as Error).message,
          session_id,
        },
        'error',
      );
    }
    log({ event: 'deflect', reason: verdict.label, verdict, session_id });
    return deflectionResponse(verdict.label);
  }

  // 7. streamText(Sonnet) — cached system prompt, tool loop cap, onFinish persistence.
  const modelMessages = await convertToModelMessages(uiMessages);

  const result = streamText({
    model: anthropicProvider(MODELS.MAIN),
    // Array form (NOT bare string) so providerOptions.cacheControl actually
    // attaches the breakpoint header. RESEARCH §Pattern 3 Gotcha.
    system: [
      {
        role: 'system',
        content: buildSystemPrompt(),
        providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
      },
    ],
    messages: modelMessages,
    // Phase 3 / D-A-02 / TOOL-01..05 — three agentic tools wired live.
    tools: {
      research_company,
      get_case_study,
      design_metric_framework,
    },
    // Phase 3 / D-A-04..05 / TOOL-07 + SAFE-15 — depth cap (3 tool calls/turn)
    // and duplicate-arg stop. Returns activeTools:[] (cache-friendly), never
    // the toolChoice-none pattern (RESEARCH §3).
    prepareStep: enforceToolCallDepthCap,
    stopWhen: stepCountIs(5), // Phase 3 — load-bearing safety cap; prepareStep above applies the tighter ≤3 tool-call depth (TOOL-07).
    maxOutputTokens: 1500, // CHAT-09
    onFinish: async (event) => {
      // event.usage is the AI SDK v6 normalized usage shape; cast covers
      // older/newer minor field deltas while normalizeAiSdkUsage handles
      // the actual key resolution.
      const usage = normalizeAiSdkUsage(event.usage as Parameters<typeof normalizeAiSdkUsage>[0]);
      const costCents = computeCostCents(usage, MODELS.MAIN);

      // W4 fix: heartbeat writes go FIRST in their OWN try/catch.
      // By the time onFinish fires, Anthropic + classifier have already
      // succeeded (we got tokens back). Heartbeat freshness must NOT depend
      // on persistence succeeding. Conversely, a heartbeat failure must NOT
      // block persistence. The two concerns are decoupled.
      // Plan 03-04 reads these short-form keys via heartbeat-trust strategy.
      try {
        await Promise.all([
          redis.set('heartbeat:anthropic', Date.now(), { ex: 120 }),
          redis.set('heartbeat:classifier', Date.now(), { ex: 120 }),
        ]);
      } catch (err) {
        log(
          {
            event: 'heartbeat_write_failed',
            error_class: (err as Error).name ?? 'Error',
            error_message: (err as Error).message,
            session_id,
          },
          'error',
        );
      }

      try {
        await persistNormalTurn({
          session_id,
          user_text: lastUser,
          verdict,
          assistant_text: event.text,
          assistant_usage: usage,
          assistant_cost_cents: costCents,
          latency_ms: Date.now() - started,
          stop_reason: event.finishReason,
          sdk_message_id: event.response?.id ?? null,
        });
        // Phase 3 / TOOL-08 / D-E-04 — append tool-call rows after assistant
        // row lands. event.steps is the AI SDK v6 multi-step shape with
        // toolCalls + toolResults per step.
        await persistToolCallTurn({
          session_id,
          steps: event.steps as Parameters<typeof persistToolCallTurn>[0]['steps'],
        });
        // SEED-001 / D-A-01 (quick task 260512-ro4): pass session.email so
        // incrementSpend skips the increment when the email is allowlisted —
        // eval-cli traffic is fully invisible to the SAFE-04 global counter.
        //
        // LOAD-BEARING: incrementIpCost does NOT receive opts.email and is
        // INTENTIONALLY NOT gated by the allowlist. SAFE-08 (150¢/day per IP)
        // is the new last-line cost backstop for eval-cli traffic since
        // SAFE-04 is bypassed for allowlisted emails. Removing this per-IP
        // increment would leave eval-cli traffic uncapped at the cost layer
        // (STRIDE T-ro4-07 — future executor disables SAFE-08 thinking it's
        // redundant). See .planning/quick/260512-ro4-.../260512-ro4-PLAN.md
        // <threat_model> for the full mitigation chain.
        await Promise.all([
          incrementSpend(costCents, { email: session.email }),
          incrementIpCost(ipKey, costCents),
        ]);
      } catch (err) {
        log(
          {
            event: 'persistence_failed',
            where: 'onFinish',
            error_class: (err as Error).name ?? 'Error',
            error_message: (err as Error).message,
            session_id,
          },
          'error',
        );
      }

      // Phase 4 OBSV-08 / D-C-02 — per-session email fires on first user
      // turn, gated by atomic UPDATE-WHERE-IS-NULL on
      // sessions.first_email_sent_at. after() (Next.js 16 / RESEARCH §Pitfall
      // 3) runs the send post-response, so the streaming reply is already
      // complete by the time Resend is hit. claimAndSendSessionEmail never
      // throws — internal failures log via Pino.
      //
      // Note: CONTEXT.md Established Patterns references `waitUntil()` from
      // `@vercel/functions` — this is superseded by RESEARCH.md Pitfall 3
      // (verified). Next.js 16 deprecates `waitUntil()` in favor of `after()`
      // from `next/server`. Do NOT revert to `waitUntil`.
      after(async () => {
        await claimAndSendSessionEmail({
          session_id,
          last_user_text: lastUser,
          classifier_verdict: verdict.label,
          classifier_confidence: verdict.confidence,
        });
      });

      log({
        event: 'chat',
        session_id,
        classifier_verdict: verdict.label,
        classifier_confidence: verdict.confidence,
        model: MODELS.MAIN,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cost_cents: costCents,
        latency_ms: Date.now() - started,
        stop_reason: event.finishReason,
      });
    },
    onError: async (e) => {
      // AI SDK onError signature is { error: unknown }; unwrap to a cause and
      // log via Pino so the structured-JSON pipeline (D-I-01..05) captures it.
      const err = (e as { error?: unknown }).error;
      log(
        {
          event: 'streamText_error',
          error_class: err instanceof Error ? err.name : 'Error',
          error_message: err instanceof Error ? err.message : String(err),
          session_id,
        },
        'error',
      );
      try {
        await persistDeflectionTurn({
          session_id,
          user_text: lastUser,
          verdict,
          deflection_text: '[streamText error]',
          // closest-fit reason — not really a classifier verdict, but admin
          // can grep stop_reason to distinguish stream failures from real
          // off-topic deflections via the deflection_text marker above.
          reason: 'offtopic',
        });
      } catch {
        // Already in the error path; swallow nested persistence failure.
      }
    },
    onAbort: async () => {
      // T-02-02-12 / Pitfall G — user closed tab mid-stream. Log only;
      // we don't have final assistant text to persist.
      log({
        event: 'chat_aborted',
        session_id,
        classifier_verdict: verdict.label,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}

function extractLastUserText(msgs: UIMessage[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== 'user') continue;
    const text = (m.parts ?? [])
      .filter((p: { type?: string }) => p?.type === 'text')
      .map((p: { type?: string; text?: string }) => p.text ?? '')
      .join('');
    if (text.trim()) return text;
  }
  return null;
}

// Returns the last assistant message text that immediately precedes the user's
// current turn. Used as a disambiguation anchor for the classifier so that short
// follow-up replies (e.g. "Nike" after "which company are you recruiting for?")
// are not incorrectly deflected as offtopic. Only the assistant turn is passed —
// never prior user messages — to keep the injection surface minimal.
function extractLastAssistantText(msgs: UIMessage[]): string | undefined {
  // Walk backwards from the end. Skip the trailing user message(s), then
  // return the first assistant message we find.
  let seenUser = false;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'user') {
      seenUser = true;
      continue;
    }
    if (m.role === 'assistant' && seenUser) {
      const text = (m.parts ?? [])
        .filter((p: { type?: string }) => p?.type === 'text')
        .map((p: { type?: string; text?: string }) => p.text ?? '')
        .join('');
      return text.trim() || undefined;
    }
  }
  return undefined;
}
