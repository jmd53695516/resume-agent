// src/lib/persistence.ts
// CHAT-11/12 — insert user + assistant rows in onFinish.
// Also used by deflection paths (Pitfall B) to record the deflected turn.
// All columns map to supabase/migrations/0001_initial.sql `messages` table.
import { supabaseAdmin } from './supabase-server';
import { newMessageId } from './id';
import { log } from './logger';
import type { ClassifierVerdict } from './classifier';
import type { NormalizedUsage } from './cost';

export async function persistNormalTurn(params: {
  session_id: string;
  user_text: string;
  verdict: ClassifierVerdict;
  assistant_text: string;
  assistant_usage: NormalizedUsage;
  assistant_cost_cents: number;
  latency_ms: number;
  stop_reason: string;
  sdk_message_id?: string | null;
}) {
  const rows = [
    {
      id: newMessageId(),
      session_id: params.session_id,
      role: 'user',
      content: params.user_text,
      classifier_verdict: params.verdict.label,
      classifier_confidence: params.verdict.confidence,
      input_tokens: 0, // classifier tokens are logged on assistant row
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cost_cents: 0,
    },
    {
      id: newMessageId(),
      sdk_message_id: params.sdk_message_id ?? null,
      session_id: params.session_id,
      role: 'assistant',
      content: params.assistant_text,
      input_tokens: params.assistant_usage.input_tokens,
      output_tokens: params.assistant_usage.output_tokens,
      cache_read_tokens: params.assistant_usage.cache_read_input_tokens,
      cache_creation_tokens: params.assistant_usage.cache_creation_input_tokens,
      cost_cents: params.assistant_cost_cents,
      latency_ms: params.latency_ms,
      stop_reason: params.stop_reason,
    },
  ];
  const { error } = await supabaseAdmin.from('messages').insert(rows);
  if (error) {
    log(
      {
        event: 'persistence_failed',
        where: 'persistNormalTurn',
        error_message: (error as { message?: string }).message ?? String(error),
        session_id: params.session_id,
      },
      'error',
    );
  }

  // Session rollup deferred to Phase 4 admin observability.
}

export async function persistDeflectionTurn(params: {
  session_id: string;
  user_text: string;
  verdict: ClassifierVerdict | null; // null for rate-limit + spend-cap + turn-cap
  deflection_text: string;
  reason:
    | 'injection'
    | 'offtopic'
    | 'sensitive'
    | 'borderline'
    | 'ratelimit'
    | 'spendcap'
    | 'turncap';
}) {
  const rows = [
    {
      id: newMessageId(),
      session_id: params.session_id,
      role: 'user',
      content: params.user_text,
      classifier_verdict: params.verdict?.label ?? null,
      classifier_confidence: params.verdict?.confidence ?? null,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cost_cents: 0,
    },
    {
      id: newMessageId(),
      session_id: params.session_id,
      role: 'assistant',
      content: params.deflection_text,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      cost_cents: 0,
      stop_reason: `deflection:${params.reason}`,
    },
  ];
  const { error } = await supabaseAdmin.from('messages').insert(rows);
  if (error) {
    log(
      {
        event: 'persistence_failed',
        where: 'persistDeflectionTurn',
        reason: params.reason,
        error_message: (error as { message?: string }).message ?? String(error),
        session_id: params.session_id,
      },
      'error',
    );
  }
}

// persistToolCallTurn — TOOL-08 / D-E-04. Schema column is `tool_result`
// (the migration name; CONTEXT D-E-04's similarly-named typo was corrected
// during research — see Plan 03-02 frontmatter must_haves). Inserts one
// messages row per tool call across all multi-step events. Called
// from /api/chat onFinish AFTER persistNormalTurn so the assistant row (and its
// associated user row) lands first; then tool rows append. No tokens/cost on
// tool rows — rollups happen on the assistant row.
export async function persistToolCallTurn(params: {
  session_id: string;
  steps: Array<{
    toolCalls?: Array<{ toolCallId: string; toolName: string; input: unknown }>;
    toolResults?: Array<{ toolCallId: string; output: unknown }>;
  }>;
}): Promise<void> {
  const rows = params.steps.flatMap((step) => {
    const calls = step.toolCalls ?? [];
    const results = step.toolResults ?? [];
    return calls.map((call) => {
      const matched = results.find((r) => r.toolCallId === call.toolCallId);
      return {
        id: newMessageId(),
        sdk_message_id: call.toolCallId, // trace correlation (toolCallId is AI-SDK-generated)
        session_id: params.session_id,
        role: 'tool' as const,
        content: '', // tool rows have no text content; payload lives in JSON cols
        tool_name: call.toolName,
        tool_args: call.input as Record<string, unknown>,
        tool_result: (matched?.output ?? null) as Record<string, unknown> | null,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        cost_cents: 0,
        latency_ms: null,
        stop_reason: null,
      };
    });
  });

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from('messages').insert(rows);
  if (error) {
    log(
      {
        event: 'persistence_failed',
        where: 'persistToolCallTurn',
        error_message: (error as { message?: string }).message ?? String(error),
        session_id: params.session_id,
      },
      'error',
    );
  }
}
