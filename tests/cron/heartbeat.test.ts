import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() container for mock state shared across hoisted vi.mock factories.
// Mirrors Plan 04-06 check-alarms.test.ts pattern.
const mocks = vi.hoisted(() => ({
  CRON_SECRET: ['x', 'y', 'z'].join('').repeat(11) + 'a', // 34 chars (>= 32 min)
  ANTHROPIC_API_KEY: ['s', 'k', '-', 'a', 'n', 't', '-'].join('') + 'x'.repeat(20),
  HEARTBEAT_LLM_PREWARM: 'true',
  messagesCreate: vi.fn(),
  pingAnthropic: vi.fn(async () => 'ok'),
  pingClassifier: vi.fn(async () => 'ok'),
  pingSupabase: vi.fn(async () => 'ok'),
  pingUpstash: vi.fn(async () => 'ok'),
  pingExa: vi.fn(async () => 'ok'),
  redisSet: vi.fn(),
  buildSystemPrompt: vi.fn(() => 'CACHED-SYSTEM-PROMPT'),
  log: vi.fn(),
  // Plan 05-12 launch fix: heartbeat route now makes a real classifier call
  // (replaces the chicken-and-egg pingClassifier-reads-stale-key check).
  // WR-01 fix: heartbeat consumes the throwing variant so a real Anthropic
  // outage propagates as an exception (caught here, banner -> 'degraded').
  // The previous sentinel-shape inspection is gone; mock returns the REAL
  // ClassifierVerdict on success and rejects on simulated outage.
  classifyUserMessageOrThrow: vi.fn(async () => ({ label: 'normal', confidence: 0.9 })),
}));

vi.mock('@/lib/env', () => ({
  get env() {
    return {
      CRON_SECRET: mocks.CRON_SECRET,
      ANTHROPIC_API_KEY: mocks.ANTHROPIC_API_KEY,
      HEARTBEAT_LLM_PREWARM: mocks.HEARTBEAT_LLM_PREWARM,
    };
  },
}));

// Anthropic SDK constructor must be a class (arrow vi.fn() not constructible).
// Mirrors Plan 04-05 Resend SDK class-mock + Plan 03-00 Exa class-mock pattern.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.messagesCreate };
  },
}));

vi.mock('@/lib/health', () => ({
  pingAnthropic: mocks.pingAnthropic,
  pingClassifier: mocks.pingClassifier,
  pingSupabase: mocks.pingSupabase,
  pingUpstash: mocks.pingUpstash,
  pingExa: mocks.pingExa,
}));

vi.mock('@/lib/redis', () => ({ redis: { set: mocks.redisSet } }));

vi.mock('@/lib/system-prompt', () => ({
  buildSystemPrompt: mocks.buildSystemPrompt,
}));

vi.mock('@/lib/anthropic', () => ({
  MODELS: { MAIN: 'claude-sonnet-4-6', CLASSIFIER: 'claude-haiku-4-5' },
}));

vi.mock('@/lib/logger', () => ({ log: mocks.log }));

// Plan 05-12 launch fix: heartbeat route calls the classifier directly to verify
// classifier health (replaces chicken-and-egg pingClassifier read).
// WR-01: route consumes the throwing variant so Anthropic outages propagate to
// the heartbeat try/catch and the banner reports classifier=degraded truthfully.
vi.mock('@/lib/classifier', () => ({
  classifyUserMessageOrThrow: mocks.classifyUserMessageOrThrow,
}));

import { POST } from '@/app/api/cron/heartbeat/route';

function makeReq(opts: { auth?: string; method?: string }) {
  const headers = new Headers();
  if (opts.auth) headers.set('authorization', opts.auth);
  return new Request('https://x/api/cron/heartbeat', {
    method: opts.method ?? 'POST',
    headers,
  });
}

beforeEach(() => {
  mocks.messagesCreate.mockReset();
  mocks.redisSet.mockReset();
  mocks.log.mockReset();
  mocks.classifyUserMessageOrThrow.mockReset();
  mocks.HEARTBEAT_LLM_PREWARM = 'true';
  // Reset ping defaults to 'ok'
  mocks.pingAnthropic.mockResolvedValue('ok');
  mocks.pingClassifier.mockResolvedValue('ok');
  mocks.pingSupabase.mockResolvedValue('ok');
  mocks.pingUpstash.mockResolvedValue('ok');
  mocks.pingExa.mockResolvedValue('ok');
  // Default: live classifier call succeeds (Plan 05-12 launch fix).
  // WR-01: throwing variant resolves with real ClassifierVerdict on success.
  mocks.classifyUserMessageOrThrow.mockResolvedValue({ label: 'normal', confidence: 0.9 });
});

describe('POST /api/cron/heartbeat', () => {
  it('returns 401 with no auth header', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
  });

  it('returns 401 with GET method even with correct token', async () => {
    const res = await POST(makeReq({ method: 'GET', auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(401);
  });

  it('returns 200 + writes heartbeat:anthropic key when LLM prewarm enabled', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: {
        cache_read_input_tokens: 85000,
        cache_creation_input_tokens: 0,
        input_tokens: 100,
        output_tokens: 1,
      },
    });
    mocks.redisSet.mockResolvedValue('OK');

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);

    // Anthropic invoked with cached system prompt (Pitfall 5 — buildSystemPrompt())
    expect(mocks.messagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 1,
        system: [
          expect.objectContaining({
            type: 'text',
            text: 'CACHED-SYSTEM-PROMPT',
            cache_control: { type: 'ephemeral' },
          }),
        ],
        messages: [{ role: 'user', content: 'ping' }],
      }),
    );
    // Heartbeat key written so /api/health stays green during business hours
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:anthropic',
      expect.any(Number),
      { ex: 120 },
    );
    // heartbeat log includes cache_read_tokens + cost_cents
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'heartbeat',
        anthropic_cache_read_tokens: 85000,
        cost_cents: 3, // 85000 / 1M * 30 = 2.55 → Math.round = 3
        prewarm_enabled: true,
      }),
    );
    // cron_run log emitted at end
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'cron_run', cron_name: 'heartbeat', status: 'ok' }),
    );
  });

  it('skips Anthropic call when HEARTBEAT_LLM_PREWARM=false but still refreshes heartbeat keys from live pings (WR-04)', async () => {
    mocks.HEARTBEAT_LLM_PREWARM = 'false';
    mocks.redisSet.mockResolvedValue('OK');

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
    // WR-04: with prewarm disabled, the live anthropic + classifier pings
    // still refresh their heartbeat keys so /admin/health doesn't go yellow.
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:classifier',
      expect.any(Number),
      { ex: 120 },
    );
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:anthropic',
      expect.any(Number),
      { ex: 120 },
    );
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'heartbeat',
        anthropic_cache_read_tokens: 0,
        cost_cents: 0,
        prewarm_enabled: false,
      }),
    );
  });

  it('returns 200 when Anthropic call throws (best-effort heartbeat)', async () => {
    mocks.messagesCreate.mockRejectedValue(new Error('rate limited'));
    mocks.redisSet.mockResolvedValue('OK');

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'heartbeat_anthropic_failed' }),
      'warn',
    );
    // The Anthropic prewarm threw, so heartbeat:anthropic is NOT written
    // (warmPromptCache returned ok:false). The classifier ping still
    // succeeds and refreshes heartbeat:classifier (WR-04).
    expect(mocks.redisSet).not.toHaveBeenCalledWith(
      'heartbeat:anthropic',
      expect.any(Number),
      expect.anything(),
    );
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:classifier',
      expect.any(Number),
      { ex: 120 },
    );
  });

  it('refreshes heartbeat:classifier on every successful run (WR-04)', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1, output_tokens: 1 },
    });
    mocks.redisSet.mockResolvedValue('OK');

    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    // Both anthropic (from warmPromptCache) and classifier (from live ping)
    // heartbeat keys must be refreshed so /admin/health stays green even on
    // low-traffic days when /api/chat isn't invoked.
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:anthropic',
      expect.any(Number),
      { ex: 120 },
    );
    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:classifier',
      expect.any(Number),
      { ex: 120 },
    );
  });

  it('does not write heartbeat:classifier when live classifier call throws (Plan 05-12 launch fix)', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1, output_tokens: 1 },
    });
    mocks.redisSet.mockResolvedValue('OK');
    // The classifier-call replaces the chicken-and-egg pingClassifier check
    // (which previously read a stale heartbeat:classifier and could never
    // recover). When the actual call throws, the heartbeat key is not refreshed.
    mocks.classifyUserMessageOrThrow.mockRejectedValue(new Error('classifier down'));

    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    expect(mocks.redisSet).not.toHaveBeenCalledWith(
      'heartbeat:classifier',
      expect.any(Number),
      expect.anything(),
    );
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'heartbeat_classifier_failed' }),
      'warn',
    );
  });

  // WR-01: the prior WR-03 fail-closed-sentinel branch is GONE. The throwing
  // variant either resolves (heartbeat:classifier refreshed, banner ok) or
  // throws (try/catch fires, banner degraded). A legitimate offtopic+1.0
  // Haiku response must no longer false-flag the classifier as degraded.
  it('treats legitimate offtopic+1.0 verdict as classifier-ok (WR-01 — no sentinel-shape special-casing)', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1, output_tokens: 1 },
    });
    mocks.redisSet.mockResolvedValue('OK');
    // A real (not sentinel) offtopic-1.0 verdict — e.g. Haiku confidently
    // classifying a weather question. The route must NOT special-case this
    // shape: classifier responded successfully -> heartbeat:classifier ok.
    mocks.classifyUserMessageOrThrow.mockResolvedValue({ label: 'offtopic', confidence: 1.0 });

    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:classifier',
      expect.any(Number),
      { ex: 120 },
    );
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'heartbeat',
        statuses: expect.objectContaining({ classifier: 'ok' }),
      }),
    );
  });

  it('writes heartbeat:exa unconditionally on every successful run (Plan 05-12 launch fix)', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1, output_tokens: 1 },
    });
    mocks.redisSet.mockResolvedValue('OK');
    // pingExa was previously HEAD-pinging api.exa.ai (which always returned
    // 404 → permanent 'degraded'). Now switched to heartbeat-trust; the
    // cron-side write is the authoritative refresh (no live ping precondition).
    mocks.pingExa.mockResolvedValue('degraded');

    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    expect(mocks.redisSet).toHaveBeenCalledWith(
      'heartbeat:exa',
      expect.any(Number),
      { ex: 120 },
    );
    // statuses.exa in heartbeat log reflects the post-write state ('ok'),
    // not the pre-write ping read ('degraded').
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'heartbeat',
        statuses: expect.objectContaining({ exa: 'ok' }),
      }),
    );
  });

  it('logs classifier=ok in heartbeat statuses on successful live call (Plan 05-12 launch fix)', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1, output_tokens: 1 },
    });
    mocks.redisSet.mockResolvedValue('OK');
    // pingClassifier read returned 'degraded' (stale pre-write state) but the
    // live call succeeded — log should reflect the live result, not the stale read.
    mocks.pingClassifier.mockResolvedValue('degraded');

    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    // WR-01 follow-up: probe phrase changed from 'health check ping' (could
    // legitimately classify as offtopic with confidence 1.0 → indistinguishable
    // from the fail-closed sentinel) to a Joe-relevant phrase that anchors as
    // 'normal' in the classifier system prompt examples.
    expect(mocks.classifyUserMessageOrThrow).toHaveBeenCalledWith("Tell me about Joe's PM experience");
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'heartbeat',
        statuses: expect.objectContaining({ classifier: 'ok' }),
      }),
    );
  });

  it('pings all 5 deps and records latencies in heartbeat log', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1, output_tokens: 1 },
    });
    mocks.redisSet.mockResolvedValue('OK');
    // Plan 05-12 launch fix: pingExa pre-write state is irrelevant for the
    // logged status — the cron-side write happens unconditionally and the
    // log reflects the post-write state ('ok'). Pre-write ping is still
    // recorded in latencies_ms for ops visibility.
    mocks.pingExa.mockResolvedValue('degraded');

    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    expect(mocks.pingSupabase).toHaveBeenCalled();
    expect(mocks.pingUpstash).toHaveBeenCalled();
    expect(mocks.pingExa).toHaveBeenCalled();
    expect(mocks.pingAnthropic).toHaveBeenCalled();
    expect(mocks.pingClassifier).toHaveBeenCalled();

    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'heartbeat',
        deps_pinged: ['supabase', 'upstash', 'exa', 'anthropic', 'classifier'],
        // exa is now 'ok' post-write (heartbeat-trust pattern); supabase + upstash
        // pass through their live ping result.
        statuses: expect.objectContaining({
          exa: 'ok',
          supabase: 'ok',
          upstash: 'ok',
        }),
      }),
    );
  });
});
