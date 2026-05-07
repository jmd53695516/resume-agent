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
  mocks.HEARTBEAT_LLM_PREWARM = 'true';
  // Reset ping defaults to 'ok'
  mocks.pingAnthropic.mockResolvedValue('ok');
  mocks.pingClassifier.mockResolvedValue('ok');
  mocks.pingSupabase.mockResolvedValue('ok');
  mocks.pingUpstash.mockResolvedValue('ok');
  mocks.pingExa.mockResolvedValue('ok');
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

  it('skips Anthropic call when HEARTBEAT_LLM_PREWARM=false', async () => {
    mocks.HEARTBEAT_LLM_PREWARM = 'false';

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
    expect(mocks.redisSet).not.toHaveBeenCalled();
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

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'heartbeat_anthropic_failed' }),
      'warn',
    );
    // No heartbeat key written on failed prewarm
    expect(mocks.redisSet).not.toHaveBeenCalled();
  });

  it('pings all 5 deps and records latencies in heartbeat log', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 1, output_tokens: 1 },
    });
    mocks.redisSet.mockResolvedValue('OK');
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
        statuses: expect.objectContaining({ exa: 'degraded' }),
      }),
    );
  });
});
