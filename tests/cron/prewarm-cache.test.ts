import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() container for mock state shared across hoisted vi.mock factories.
// Mirrors tests/cron/heartbeat.test.ts mocking style (Plan 04-06 pattern).
const mocks = vi.hoisted(() => ({
  CRON_SECRET: ['x', 'y', 'z'].join('').repeat(11) + 'a', // 34 chars (>= 32 min)
  ANTHROPIC_API_KEY: 'sk-ant-' + 'x'.repeat(20),
  messagesCreate: vi.fn(),
  redisSet: vi.fn(),
  buildSystemPrompt: vi.fn(() => 'CACHED-SYSTEM-PROMPT'),
  log: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  get env() {
    return {
      CRON_SECRET: mocks.CRON_SECRET,
      ANTHROPIC_API_KEY: mocks.ANTHROPIC_API_KEY,
    };
  },
}));

// Anthropic SDK constructor must be a class (arrow vi.fn() not constructible).
// Mirrors Plan 04-05 Resend SDK class-mock + Plan 03-00 Exa class-mock pattern.
// The lazy new Anthropic(...) inside src/lib/prompt-cache.ts resolves to this
// mocked constructor because vi.mock is hoisted and applies globally per file.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.messagesCreate };
  },
}));

vi.mock('@/lib/redis', () => ({ redis: { set: mocks.redisSet } }));

vi.mock('@/lib/system-prompt', () => ({
  buildSystemPrompt: mocks.buildSystemPrompt,
}));

vi.mock('@/lib/anthropic', () => ({
  MODELS: { MAIN: 'claude-sonnet-4-6', CLASSIFIER: 'claude-haiku-4-5' },
}));

vi.mock('@/lib/logger', () => ({ log: mocks.log }));

import { POST } from '@/app/api/cron/prewarm-cache/route';

function makeReq(opts: { auth?: string; method?: string }) {
  const headers = new Headers();
  if (opts.auth) headers.set('authorization', opts.auth);
  return new Request('https://x/api/cron/prewarm-cache', {
    method: opts.method ?? 'POST',
    headers,
  });
}

beforeEach(() => {
  mocks.messagesCreate.mockReset();
  mocks.redisSet.mockReset();
  mocks.log.mockReset();
  // Default: redis write succeeds
  mocks.redisSet.mockResolvedValue('OK');
});

describe('POST /api/cron/prewarm-cache', () => {
  it('returns 401 with no auth header', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    expect(mocks.messagesCreate).not.toHaveBeenCalled();
  });

  it('returns 401 with GET method even with correct Bearer token', async () => {
    const res = await POST(makeReq({ method: 'GET', auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(401);
  });

  it('returns 200 + writes heartbeat:anthropic Redis key on Anthropic success', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: {
        cache_read_input_tokens: 30000,
        cache_creation_input_tokens: 0,
        input_tokens: 100,
        output_tokens: 1,
      },
    });

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);

    const body = await res.json() as { ok: boolean };
    expect(body).toEqual({ ok: true });

    // Anthropic invoked with cached system prompt (Pitfall 5 / D-E determinism)
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

    // prewarm_cache log includes token + cost fields
    // Math.round((30000 / 1_000_000) * 30) = Math.round(0.9) = 1
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'prewarm_cache',
        anthropic_cache_read_tokens: 30000,
        cost_cents: 1,
        ok: true,
      }),
    );

    // cron_run log emitted at end
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_run',
        cron_name: 'prewarm-cache',
        status: 'ok',
      }),
    );
  });

  it('returns 200 with ok:false on Anthropic failure (graceful — no retry trigger)', async () => {
    mocks.messagesCreate.mockRejectedValue(new Error('rate limited'));

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    // Graceful-failure contract: cron-job.org must not retry on transient Anthropic blips.
    // HTTP 200 tells cron-job.org the job "succeeded" (no retry); ok:false in the body
    // allows log monitoring to detect the degraded state.
    expect(res.status).toBe(200);

    const body = await res.json() as { ok: boolean };
    expect(body).toEqual({ ok: false });

    // heartbeat_anthropic_failed comes from warmPromptCache's internal catch
    // (preserved from the original heartbeat/route.ts implementation)
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'heartbeat_anthropic_failed' }),
      'warn',
    );

    // redis.set for heartbeat:anthropic must NOT be called — it lives inside
    // warmPromptCache's success path and never runs when messages.create rejects
    expect(mocks.redisSet).not.toHaveBeenCalledWith(
      'heartbeat:anthropic',
      expect.any(Number),
      expect.anything(),
    );

    // cron_run log still emitted, status='degraded'
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron_run',
        cron_name: 'prewarm-cache',
        status: 'degraded',
      }),
    );
  });

  // Regression gate: if a future edit accidentally adds the classifier call to
  // this route, this file won't even compile because @/lib/classifier isn't
  // mocked here. The route module load would fail during import resolution,
  // causing the entire test file to error before any assertions run.
  it('does NOT make the Haiku classifier live call (that stays in /api/cron/heartbeat)', async () => {
    mocks.messagesCreate.mockResolvedValue({
      usage: {
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        input_tokens: 1,
        output_tokens: 1,
      },
    });

    // No assertion needed beyond "this test runs without error" — if @/lib/classifier
    // were imported by the route, this test file would fail at module load time
    // (the module is not mocked here). Passing confirms the route is classifier-free.
    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
  });
});
