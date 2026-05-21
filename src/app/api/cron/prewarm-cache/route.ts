// src/app/api/cron/prewarm-cache/route.ts
// Cache-warmth half of the split-cron pattern decided in
// .planning/incidents/2026-05-20-heartbeat-overfire.md Addendum.
//
// Role: run warmPromptCache() to keep the Anthropic ephemeral prompt-cache warm
//   during business hours. This is the ONLY Anthropic call in the split-cron
//   design — the companion /api/cron/heartbeat route handles dep pings and the
//   classifier banner refresh with HEARTBEAT_LLM_PREWARM=false.
//
// Expected cron-job.org schedule: `*/5 9-17 * * 1-5` with timezone
//   America/New_York. 5-minute cadence is constrained by Anthropic's ~5-min
//   ephemeral prompt-cache TTL — firing more often burns cache_read tokens with
//   zero additional coverage benefit (the over-fire failure mode from the
//   incident). Outside business hours we accept the cold-cache hit on the
//   recruiter's first request.
//
// Companion route: /api/cron/heartbeat runs every 1 minute for dep pings +
//   classifier banner with HEARTBEAT_LLM_PREWARM=false. Cost: ~$0.06/biz-day.
//
// Cost: ~$1.00/biz-day at the expected schedule.
//   108 fires/biz-day x ~30k cache_read tokens/fire x $0.30/MTok = ~$0.97/biz-day.
//   Total split-cron cost: ~$1.06/biz-day (down from ~$5.57/biz-day over-fire).
//
// Auth: same Bearer CRON_SECRET pattern as /api/cron/heartbeat.
//   Use the same CRON_SECRET env var value already configured in Vercel.
//
// Graceful-failure contract: returns HTTP 200 even on Anthropic error so
//   cron-job.org does not trigger retries. A transient Anthropic blip recovers
//   at the next scheduled fire (5 min later), which is cheaper than a retry storm.
//   The ok:false body field allows log monitoring and alarms without cron retries.
import { validateCronAuth } from '@/lib/cron-auth';
import { warmPromptCache } from '@/lib/prompt-cache';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!validateCronAuth(req)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const started = Date.now();

  // warmPromptCache handles its own try/catch internally and returns
  // { cache_read_tokens, cost_cents, ok }. No outer try/catch needed —
  // graceful failure is baked in (returns ok:false on Anthropic error).
  const prewarm = await warmPromptCache();

  log({
    event: 'prewarm_cache',
    anthropic_cache_read_tokens: prewarm.cache_read_tokens,
    cost_cents: prewarm.cost_cents,
    ok: prewarm.ok,
    duration_ms: Date.now() - started,
  });
  log({
    event: 'cron_run',
    cron_name: 'prewarm-cache',
    duration_ms: Date.now() - started,
    status: prewarm.ok ? 'ok' : 'degraded',
    items_processed: 1,
  });

  // Always return 200 — returning non-2xx triggers cron-job.org retries.
  // Transient Anthropic blips recover at the next scheduled fire without
  // the cost and noise of a retry storm (graceful-failure contract).
  return Response.json({ ok: prewarm.ok });
}
