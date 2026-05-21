// src/lib/prompt-cache.ts
// Shared cache-warmth helper for the split-cron pattern.
//
// Consumed by two routes:
//   - /api/cron/heartbeat (when HEARTBEAT_LLM_PREWARM=true, legacy or dev)
//   - /api/cron/prewarm-cache (dedicated 5-min business-hours cron)
//
// MUST use buildSystemPrompt() — never an inline copy or a differently-ordered
// assembly. Cache hits on the recruiter's chat session depend on a byte-identical
// prefix match between this call and the main /api/chat call. This is the Phase 1
// D-E determinism contract (Pitfall 5 / RESEARCH §5).
//
// Background: split-cron pattern decided after the 2026-05-20 banner-vs-cost
// tension discovered post-fix. See
// .planning/incidents/2026-05-20-heartbeat-overfire.md Addendum for rationale.
import Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@/lib/anthropic';
import { env } from '@/lib/env';
import { redis } from '@/lib/redis';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { log } from '@/lib/logger';

// Lazy-init the Anthropic client at first call so the module stays cheap to
// import in tests that mock @anthropic-ai/sdk via class. (Constructing at
// module load works too, but the lazy pattern matches src/lib/anthropic.ts
// anthropicClient() and Plan 04-05 lazy Resend.)
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Runs a minimal Sonnet 4.6 call with the full system prompt under
 * cache_control:ephemeral. On a warm cache, this costs ~$0.30/MTok on
 * cache_read_input_tokens and refreshes the Anthropic prompt-cache TTL.
 * On error, logs a warn-level event and returns ok:false — callers should
 * NOT retry (the next scheduled fire handles recovery).
 *
 * Side effect on success: writes heartbeat:anthropic to Redis (TTL=120s) so
 * /api/health reports anthropic='ok' and the StatusBanner stays green.
 */
export async function warmPromptCache(): Promise<{
  cache_read_tokens: number;
  cost_cents: number;
  ok: boolean;
}> {
  try {
    const response = await getAnthropic().messages.create({
      model: MODELS.MAIN,
      max_tokens: 1,
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: 'ping' }],
    });
    const cache_read = response.usage.cache_read_input_tokens ?? 0;
    // Sonnet 4.6 cache_read = $0.30 / MTok -> 30 cents per MTok (cost.ts RATES).
    // This is the dominant heartbeat cost when the cache is warm; cold-cache
    // creation tokens charge ~$3.75/MTok but only run on the first heartbeat
    // after a 5min idle window (Anthropic's ephemeral TTL).
    const cost_cents = Math.round((cache_read / 1_000_000) * 30);
    // Refresh heartbeat:anthropic key so /api/health doesn't go yellow during
    // business hours (Plan 03-04 heartbeat-trust pattern; TTL=120s).
    await redis.set('heartbeat:anthropic', Date.now(), { ex: 120 });
    return { cache_read_tokens: cache_read, cost_cents, ok: true };
  } catch (err) {
    log(
      { event: 'heartbeat_anthropic_failed', error_message: (err as Error).message },
      'warn',
    );
    return { cache_read_tokens: 0, cost_cents: 0, ok: false };
  }
}
