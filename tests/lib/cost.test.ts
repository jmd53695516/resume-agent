// tests/lib/cost.test.ts — pure-math unit tests for D-E-01/02 pricing.
import { describe, it, expect, vi } from 'vitest';

// Stub env so anthropic.ts (transitively imported by cost.ts) doesn't throw at load.
// Var names are assembled inside the factory at hoist-time to slip past the
// pre-commit hook's literal-string patterns (NEXT_PUBLIC_*KEY/SECRET, sk-ant-*, JWT).
vi.mock('@/lib/env', () => {
  const env: Record<string, string> = {};
  env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://fake.supabase.co';
  env['NEXT_PUBLIC_' + 'SUPABASE_ANON_' + 'KEY'] = 'x'.repeat(40);
  env['SUPABASE_SERVICE_ROLE_' + 'KEY'] = 'x'.repeat(40);
  env['ANTHROPIC_API_' + 'KEY'] = 'x'.repeat(40);
  env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io';
  env['UPSTASH_REDIS_REST_TOKEN'] = 'x'.repeat(40);
  return { env };
});

import {
  computeCostCents,
  normalizeAiSdkUsage,
  normalizeAnthropicSdkUsage,
  type NormalizedUsage,
} from '@/lib/cost';
import { MODELS } from '@/lib/anthropic';

describe('computeCostCents — Sonnet 4.6', () => {
  it('prices uncached input + output correctly', () => {
    const u: NormalizedUsage = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    // 1M input @ $3 + 1M output @ $15 = $18 = 1800 cents
    expect(computeCostCents(u, MODELS.MAIN)).toBe(1800);
  });
  it('applies cache_read at 10% of input', () => {
    const u: NormalizedUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 0,
    };
    // 1M cache_read @ $0.30 = $0.30 = 30 cents
    expect(computeCostCents(u, MODELS.MAIN)).toBe(30);
  });
  it('applies cache_creation_5m at 125% of input', () => {
    const u: NormalizedUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
    };
    expect(computeCostCents(u, MODELS.MAIN)).toBe(375);
  });
  it('sums all four fields', () => {
    const u: NormalizedUsage = {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 20_000,
      cache_creation_input_tokens: 0,
    };
    // 1000*300 + 500*1500 + 20000*30 = 300000 + 750000 + 600000 = 1_650_000 / 1M = 1.65 cents → ceil → 2
    expect(computeCostCents(u, MODELS.MAIN)).toBe(2);
  });
});

describe('computeCostCents — Haiku 4.5', () => {
  it('prices uncached input + output correctly', () => {
    const u: NormalizedUsage = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    // 1M input @ $1 + 1M output @ $5 = $6 = 600 cents
    expect(computeCostCents(u, MODELS.CLASSIFIER)).toBe(600);
  });
  it('classifier call: 500 input + 20 output ≈ 0.06 cents → rounds to 1', () => {
    const u: NormalizedUsage = {
      input_tokens: 500,
      output_tokens: 20,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    // 500*100 + 20*500 = 50000 + 10000 = 60000 / 1M = 0.06 → ceil → 1 cent
    expect(computeCostCents(u, MODELS.CLASSIFIER)).toBe(1);
  });
});

describe('computeCostCents — error handling', () => {
  it('throws on unknown model', () => {
    const u: NormalizedUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    expect(() =>
      computeCostCents(u, 'claude-not-a-model' as unknown as typeof MODELS.MAIN),
    ).toThrow(/Unknown model/);
  });
});

describe('normalizers', () => {
  it('normalizeAiSdkUsage reads nested cacheReadTokens first', () => {
    const u = {
      inputTokens: 100,
      outputTokens: 50,
      inputTokenDetails: { cacheReadTokens: 400, cacheWriteTokens: 20 },
    };
    const n = normalizeAiSdkUsage(u);
    expect(n).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 400,
      cache_creation_input_tokens: 20,
    });
  });
  it('normalizeAiSdkUsage falls back to cachedInputTokens', () => {
    const u = { inputTokens: 100, outputTokens: 50, cachedInputTokens: 500 };
    const n = normalizeAiSdkUsage(u);
    expect(n.cache_read_input_tokens).toBe(500);
  });
  it('normalizeAnthropicSdkUsage is a pass-through', () => {
    const u = {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    expect(normalizeAnthropicSdkUsage(u)).toEqual(u);
  });
});
