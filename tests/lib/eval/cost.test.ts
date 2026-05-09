// tests/lib/eval/cost.test.ts
// Phase 5 Plan 05-03 Task 1 — TDD coverage for cost projector + extractors.
// NOTE: vitest discovery only finds tests under tests/**/*.test.{ts,tsx}.
// Plan spec said `src/lib/__tests__/eval/X.test.ts` — this is a path deviation
// per session-trap #2 (vitest.config.ts include pattern); behavior unchanged.
import { describe, it, expect } from 'vitest';
import {
  WARN_THRESHOLD_CENTS,
  projectRunCost,
  extractAnthropicCost,
  extractGoogleCost,
} from '@/lib/eval/cost';

describe('WARN_THRESHOLD_CENTS', () => {
  it('exports 150 (LOCKED at $1.50 per Joe decision)', () => {
    expect(WARN_THRESHOLD_CENTS).toBe(150);
  });
});

describe('projectRunCost', () => {
  it('returns ~130 cents for a 40-case run (RESEARCH §6 cold-cache model sanity)', () => {
    const cents = projectRunCost(40);
    // Sanity range around the $1.30 RESEARCH model (lower than $1.50 warn).
    expect(cents).toBeGreaterThanOrEqual(100);
    expect(cents).toBeLessThanOrEqual(200);
  });

  it('scales monotonically with case count', () => {
    expect(projectRunCost(10)).toBeLessThan(projectRunCost(40));
    expect(projectRunCost(40)).toBeLessThan(projectRunCost(80));
  });

  it('returns a non-negative integer', () => {
    const c = projectRunCost(40);
    expect(Number.isInteger(c)).toBe(true);
    expect(c).toBeGreaterThan(0);
  });
});

describe('extractAnthropicCost', () => {
  it('handles AI SDK camelCase usage shape (input/output/cacheRead/cacheCreation)', () => {
    // 1M input @ $3 + 1M output @ $15 = $18 = 1800 cents
    const cents = extractAnthropicCost({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cents).toBe(1800);
  });

  it('applies cache-read at $0.30/MTok', () => {
    // 1M cache_read @ $0.30 = $0.30 = 30 cents
    const cents = extractAnthropicCost({ cacheReadInputTokens: 1_000_000 });
    expect(cents).toBe(30);
  });

  it('applies cache-write at $3.75/MTok', () => {
    // 1M cache_write @ $3.75 = $3.75 = 375 cents
    const cents = extractAnthropicCost({ cacheCreationInputTokens: 1_000_000 });
    expect(cents).toBe(375);
  });

  it('treats missing fields as zero', () => {
    expect(extractAnthropicCost({})).toBe(0);
  });
});

describe('extractGoogleCost', () => {
  it('handles Google usage shape (inputTokens/outputTokens)', () => {
    // 1M input @ $0.30 + 1M output @ $2.50 = $2.80 = 280 cents
    const cents = extractGoogleCost({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cents).toBe(280);
  });

  it('returns ~1 cent for a typical (1500 in / 200 out) judge call', () => {
    // 1500 * $0.30/MTok = $0.00045
    // 200  * $2.50/MTok = $0.0005
    // total = $0.00095 ≈ 0.095 cents → rounds to 0
    // (cents are int, judge calls are individually <1¢; aggregate is what matters)
    const cents = extractGoogleCost({ inputTokens: 1500, outputTokens: 200 });
    expect(cents).toBeGreaterThanOrEqual(0);
    expect(cents).toBeLessThanOrEqual(2);
  });

  it('treats missing fields as zero', () => {
    expect(extractGoogleCost({})).toBe(0);
  });
});
