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
import { z } from 'zod';
import { anthropicProvider, MODELS } from '@/lib/anthropic';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { classifyUserMessage } from '@/lib/classifier';
import { supabaseAdmin } from '@/lib/supabase-server';
import { checkRateLimits, isOverCap, incrementSpend, incrementIpCost } from '@/lib/redis';
import { computeCostCents, normalizeAiSdkUsage } from '@/lib/cost';
import { persistNormalTurn, persistDeflectionTurn } from '@/lib/persistence';
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
        writer.write({ type: 'text-start', id });
        writer.write({ type: 'text-delta', id, delta: text });
        writer.write({ type: 'text-end', id });
      },
    }),
  });
}

export async function POST(req: Request): Promise<Response> {
  const started = Date.now();

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
  if (sessionErr || !session || session.ended_at) {
    return Response.json({ error: 'Session unknown or ended' }, { status: 404 });
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
      console.error('persistDeflectionTurn(turncap) failed', e);
      // D-G-05: persistence failures must not block the deflection response.
    }
    log({ event: 'deflect', reason: 'turncap', session_id });
    return deflectionResponse('turncap');
  }

  // 4. spend cap (SAFE-04 / SAFE-09 — must precede classifier so abusive
  //    requests don't even pay for Haiku once cap is hit).
  if (await isOverCap()) {
    try {
      await persistDeflectionTurn({
        session_id,
        user_text: lastUser,
        verdict: null,
        deflection_text: DEFLECTIONS.spendcap,
        reason: 'spendcap',
      });
    } catch (e) {
      console.error('persistDeflectionTurn(spendcap) failed', e);
    }
    log({ event: 'deflect', reason: 'spendcap', session_id });
    return deflectionResponse('spendcap');
  }

  // 5. rate limits (SAFE-05..08) — IP via @vercel/functions, fallback chain
  //    for local dev and edge cases (Pitfall E).
  const ipKey =
    ipAddress(req) ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'dev';
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
      console.error('persistDeflectionTurn(ratelimit) failed', e);
    }
    log({ event: 'deflect', reason: 'ratelimit', which: rl.which, session_id });
    return deflectionResponse('ratelimit');
  }

  // 6. classifier (SAFE-01..03)
  const verdict = await classifyUserMessage(lastUser);
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
      console.error('persistDeflectionTurn(borderline) failed', e);
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
      console.error(`persistDeflectionTurn(${verdict.label}) failed`, e);
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
    stopWhen: stepCountIs(5), // SAFE-15 prep — Phase 2 has zero tools; inert here, real cap kicks in Phase 3.
    maxOutputTokens: 1500, // CHAT-09
    onFinish: async (event) => {
      // event.usage is the AI SDK v6 normalized usage shape; cast covers
      // older/newer minor field deltas while normalizeAiSdkUsage handles
      // the actual key resolution.
      const usage = normalizeAiSdkUsage(event.usage as Parameters<typeof normalizeAiSdkUsage>[0]);
      const costCents = computeCostCents(usage, MODELS.MAIN);
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
        await Promise.all([incrementSpend(costCents), incrementIpCost(ipKey, costCents)]);
      } catch (err) {
        console.error('onFinish persistence failed', err);
      }
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
      console.error('streamText error', e);
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
