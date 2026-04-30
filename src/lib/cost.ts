// src/lib/cost.ts
// Pure cost calculator. Takes Anthropic's usage object fields (camelCase from AI SDK,
// snake_case from @anthropic-ai/sdk) and returns USD cents as integer (rounded up).
// Pricing verified 2026-04-22 against https://platform.claude.com/docs/en/about-claude/pricing
// [VERIFIED: Anthropic pricing page 2026-04-22]

import { MODELS } from './anthropic';

type ModelKey = (typeof MODELS)[keyof typeof MODELS];

// Rates per million tokens, in cents (100 cents = $1).
// Field key matches Anthropic's usage fields mapped to our canonical names.
const RATES: Record<ModelKey, {
  input: number;
  output: number;
  cache_read: number;
  cache_write_5m: number;
  cache_write_1h: number;
}> = {
  [MODELS.MAIN]: {
    input: 300, // $3 / MTok
    output: 1500, // $15 / MTok
    cache_read: 30, // $0.30 / MTok
    cache_write_5m: 375, // $3.75 / MTok
    cache_write_1h: 600, // $6 / MTok
  },
  [MODELS.CLASSIFIER]: {
    input: 100, // $1 / MTok
    output: 500, // $5 / MTok
    cache_read: 10, // $0.10 / MTok (not used — classifier doesn't cache)
    cache_write_5m: 125, // $1.25 / MTok (not used)
    cache_write_1h: 200, // $2 / MTok (not used)
  },
};

// Normalized usage shape the rest of the code uses. Both SDKs report the same
// concepts under different key names; cost.ts sees only this shape.
export type NormalizedUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number; // 5-minute writes. Phase 2 never uses 1h.
};

export function computeCostCents(usage: NormalizedUsage, model: ModelKey): number {
  const r = RATES[model];
  if (!r) throw new Error(`Unknown model: ${model}`);

  const costPer1M =
    usage.input_tokens * r.input +
    usage.output_tokens * r.output +
    usage.cache_read_input_tokens * r.cache_read +
    usage.cache_creation_input_tokens * r.cache_write_5m;

  // Divide by 1M; round up so we never undercharge the cap.
  return Math.ceil(costPer1M / 1_000_000);
}

// Adapter — AI SDK v6 onFinish usage fields are camelCase and nested.
// Handle both shapes for robustness (AI SDK main chat vs direct Anthropic SDK classifier).
export function normalizeAiSdkUsage(u: {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number };
}): NormalizedUsage {
  return {
    input_tokens: u.inputTokens ?? 0,
    output_tokens: u.outputTokens ?? 0,
    cache_read_input_tokens:
      u.inputTokenDetails?.cacheReadTokens ?? u.cachedInputTokens ?? 0,
    cache_creation_input_tokens: u.inputTokenDetails?.cacheWriteTokens ?? 0,
  };
}

export function normalizeAnthropicSdkUsage(u: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}): NormalizedUsage {
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
  };
}
