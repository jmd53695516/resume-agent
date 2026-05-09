// src/lib/eval/cost.ts
// Cost projector + actual-cost extractor. Prices verified against
// platform.claude.com/docs/en/build-with-claude/prompt-caching and
// ai.google.dev/pricing as of RESEARCH §6 (2026-05-07).

/** $1.50 — LOCKED user decision (Joe @ planning time); raised from $1.00 in
 * CONTEXT D-A-07 because RESEARCH §6 cold-cache cost model showed ~$1.30/run
 * real cost. Cents (int). Mirrors EVAL_COST_WARN_USD in eval-models.ts. */
export const WARN_THRESHOLD_CENTS = 150;

// Prices in $/MTok (1 MTok = 1_000_000 tokens). Source: RESEARCH §6.
const PRICES = {
  sonnet_input: 3.0,
  sonnet_cache_write: 3.75,
  sonnet_cache_read: 0.3,
  sonnet_output: 15.0,
  haiku_input: 1.0,
  haiku_output: 5.0,
  gemini_input: 0.3,
  gemini_output: 2.5,
} as const;

/**
 * Estimate per-run total cost based on case count. Mirrors RESEARCH §6 model:
 *   - ~75% of cases exercise /api/chat (Sonnet); first call cold-cache write,
 *     subsequent warm-cache reads, ~85k system-prompt tokens, ~500 output tokens.
 *   - Every case runs through the Haiku classifier (~500 input / ~30 output).
 *   - ~62.5% of cases get LLM-judged via Gemini (~1500 input / ~200 output).
 * Returns cents (int). Sanity: projectRunCost(40) ≈ 130 cents per RESEARCH model.
 */
export function projectRunCost(caseCount: number): number {
  // Sonnet (~75% of N cases exercise /api/chat)
  const sonnetCases = Math.max(1, Math.round(caseCount * 0.75));
  const sonnetCost =
    // First call cold-cache write
    (85_000 / 1_000_000) * PRICES.sonnet_cache_write +
    // Subsequent calls warm-cache read
    (sonnetCases - 1) * (85_000 / 1_000_000) * PRICES.sonnet_cache_read +
    // Output
    sonnetCases * (500 / 1_000_000) * PRICES.sonnet_output;
  // Haiku classifier (every case)
  const haikuCost =
    caseCount *
    ((500 / 1_000_000) * PRICES.haiku_input +
      (30 / 1_000_000) * PRICES.haiku_output);
  // Gemini judge (~62.5% of cases LLM-judged)
  const judgeCases = Math.round(caseCount * 0.625);
  const judgeCost =
    judgeCases *
    ((1500 / 1_000_000) * PRICES.gemini_input +
      (200 / 1_000_000) * PRICES.gemini_output);
  const totalDollars = sonnetCost + haikuCost + judgeCost;
  return Math.round(totalDollars * 100);
}

/** Extract cost from an Anthropic SDK / AI SDK Anthropic usage object.
 * Accepts the camelCase shape emitted by AI SDK v6 `streamText` onFinish. */
export function extractAnthropicCost(usage: {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}): number {
  const input = (usage.inputTokens ?? 0) / 1_000_000;
  const output = (usage.outputTokens ?? 0) / 1_000_000;
  const cacheRead = (usage.cacheReadInputTokens ?? 0) / 1_000_000;
  const cacheWrite = (usage.cacheCreationInputTokens ?? 0) / 1_000_000;
  const dollars =
    input * PRICES.sonnet_input +
    output * PRICES.sonnet_output +
    cacheRead * PRICES.sonnet_cache_read +
    cacheWrite * PRICES.sonnet_cache_write;
  return Math.round(dollars * 100);
}

/** Extract cost from a @ai-sdk/google generateObject usage object.
 * AI SDK v6 LanguageModelUsage shape: { inputTokens, outputTokens, totalTokens, ... }. */
export function extractGoogleCost(usage: {
  inputTokens?: number;
  outputTokens?: number;
}): number {
  const input = (usage.inputTokens ?? 0) / 1_000_000;
  const output = (usage.outputTokens ?? 0) / 1_000_000;
  const dollars = input * PRICES.gemini_input + output * PRICES.gemini_output;
  return Math.round(dollars * 100);
}
