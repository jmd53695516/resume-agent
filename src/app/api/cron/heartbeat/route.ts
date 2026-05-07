// src/app/api/cron/heartbeat/route.ts
// Phase 4 OBSV-14 + D-C-10. Light-touch dep pings + optional Anthropic
// prompt-cache pre-warm.
//
// Schedule (cron-job.org, operationally configured): every 5 min during
// 9am–6pm ET Mon–Fri (e.g. `*/5 14-22 * * 1-5` UTC, or use cron-job.org's
// timezone selector). Outside business hours we accept that the recruiter's
// first request takes the cold-cache hit; cost vs. coverage trade is
// documented in CONTEXT.md D-C-10.
//
// RESEARCH §5 / Pitfall 5: the Anthropic call MUST use buildSystemPrompt()
// — never an inline copy. Cache hit on the recruiter session depends on
// byte-identical prefix match. This is the Phase 1 D-E determinism contract.
import Anthropic from '@anthropic-ai/sdk';
import { validateCronAuth } from '@/lib/cron-auth';
import {
  pingAnthropic,
  pingClassifier,
  pingSupabase,
  pingUpstash,
  pingExa,
} from '@/lib/health';
import { redis } from '@/lib/redis';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { MODELS } from '@/lib/anthropic';
import { env } from '@/lib/env';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

async function timed<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ value: T; ms: number }> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

async function warmPromptCache(): Promise<{
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
    // Sonnet 4.6 cache_read = $0.30 / MTok → 30 cents per MTok (cost.ts RATES).
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

export async function POST(req: Request): Promise<Response> {
  if (!validateCronAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const started = Date.now();

  // Run all 5 dep pings in parallel; each ping has its own ~1.5s timeout in
  // health.ts so the worst-case heartbeat duration is bounded by the slowest
  // ping plus the optional Anthropic prewarm latency.
  const [supabasePing, upstashPing, exaPing, anthropicPing, classifierPing] =
    await Promise.all([
      timed('supabase', pingSupabase),
      timed('upstash', pingUpstash),
      timed('exa', pingExa),
      timed('anthropic', pingAnthropic),
      timed('classifier', pingClassifier),
    ]);

  const llmPrewarmEnabled =
    (env.HEARTBEAT_LLM_PREWARM ?? 'true').toLowerCase() !== 'false';
  const prewarm = llmPrewarmEnabled
    ? await warmPromptCache()
    : { cache_read_tokens: 0, cost_cents: 0, ok: true };

  log({
    event: 'heartbeat',
    deps_pinged: ['supabase', 'upstash', 'exa', 'anthropic', 'classifier'],
    latencies_ms: {
      supabase: supabasePing.ms,
      upstash: upstashPing.ms,
      exa: exaPing.ms,
      anthropic: anthropicPing.ms,
      classifier: classifierPing.ms,
    },
    statuses: {
      supabase: supabasePing.value,
      upstash: upstashPing.value,
      exa: exaPing.value,
      anthropic: anthropicPing.value,
      classifier: classifierPing.value,
    },
    anthropic_cache_read_tokens: prewarm.cache_read_tokens,
    cost_cents: prewarm.cost_cents,
    prewarm_enabled: llmPrewarmEnabled,
    duration_ms: Date.now() - started,
  });
  log({
    event: 'cron_run',
    cron_name: 'heartbeat',
    duration_ms: Date.now() - started,
    status: 'ok',
    items_processed: 1,
  });

  return Response.json({ ok: true });
}
