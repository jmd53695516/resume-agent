// tests/api/chat-tools.test.ts
// Plan 03-02 Task 2 — integration tests for the tool wiring + W4 decoupled
// heartbeat behavior in /api/chat onFinish.
//
// Strategy: mock streamText so we can capture the config it was passed AND
// invoke the onFinish callback with controlled event.steps to assert that
// (a) tools + prepareStep are wired into the streamText config,
// (b) onFinish writes both heartbeat keys via redis.set,
// (c) onFinish calls persistToolCallTurn with event.steps,
// (d) W4: heartbeat redis.set runs even when persistNormalTurn rejects,
// (e) W4: persistNormalTurn runs even when redis.set rejects.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- env stub --------------------------------------------------------------
vi.mock('@/lib/env', () => {
  const env: Record<string, string> = {};
  env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://fake.supabase.co';
  env['NEXT_PUBLIC_' + 'SUPABASE_ANON_' + 'KEY'] = 'x'.repeat(40);
  env['SUPABASE_SERVICE_ROLE_' + 'KEY'] = 'x'.repeat(40);
  env['ANTHROPIC_API_' + 'KEY'] = 'x'.repeat(40);
  env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io';
  env['UPSTASH_REDIS_REST_TOKEN'] = 'x'.repeat(40);
  env['EXA_API_' + 'KEY'] = 'x'.repeat(40);
  return { env };
});

// ---- AI SDK streamText mock -------------------------------------------------
// We capture the config and the onFinish callback so each test can invoke it
// with a synthetic event payload.
const streamTextMock = vi.fn();
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: streamTextMock,
  };
});

// ---- persistence mocks ------------------------------------------------------
const persistNormalTurn = vi.fn();
const persistDeflectionTurn = vi.fn();
const persistToolCallTurn = vi.fn();
vi.mock('@/lib/persistence', () => ({
  persistNormalTurn,
  persistDeflectionTurn,
  persistToolCallTurn,
}));

// ---- redis mock (heartbeat + spend cap + rate limits) -----------------------
const redisSet = vi.fn();
const redisGet = vi.fn();
const checkRateLimits = vi.fn();
const isOverCap = vi.fn();
const incrementSpend = vi.fn();
const incrementIpCost = vi.fn();
vi.mock('@/lib/redis', () => ({
  redis: { set: redisSet, get: redisGet, ping: vi.fn() },
  checkRateLimits,
  isOverCap,
  incrementSpend,
  incrementIpCost,
  // SEED-001 spend-cap half (quick task 260512-ro4): route imports this
  // helper at module load. Default to "not allowlisted" so these tests'
  // happy-path session.email triggers the production gate-4 isOverCap
  // call exactly as before — onFinish wiring tests remain semantics-
  // identical to the pre-spend-cap-exemption behavior.
  isEmailSpendCapAllowlisted: () => false,
}));

// ---- supabase mock — happy-path session lookup + 0 turn rows ----------------
const sessionSingle = vi.fn();
const messagesCount = vi.fn();
function makeSupabase() {
  const sessionsChain = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: sessionSingle,
      })),
    })),
  };
  const messagesChain = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() => messagesCount()),
      })),
    })),
  };
  return {
    from: vi.fn((table: string) => {
      if (table === 'sessions') return sessionsChain;
      if (table === 'messages') return messagesChain;
      throw new Error(`unexpected table: ${table}`);
    }),
  };
}
vi.mock('@/lib/supabase-server', () => ({
  get supabaseAdmin() {
    return makeSupabase();
  },
}));

// ---- classifier mock — happy-path normal verdict ----------------------------
const classifyUserMessage = vi.fn();
vi.mock('@/lib/classifier', () => ({ classifyUserMessage }));

// ---- ipAddress / vercel functions -------------------------------------------
vi.mock('@vercel/functions', () => ({
  ipAddress: () => 'test-ip',
}));

// ---- next/server `after` mock ----------------------------------------------
// onFinish (Plan 04-05) calls `after(callback)` from `next/server` to schedule
// the per-session email. Real `after` requires a Next.js request scope; these
// unit tests invoke onFinish directly, so we intercept and run the callback
// inline. The email-send path itself is exercised in tests/lib/email.test.ts.
const afterMock = vi.fn(async (cb: () => Promise<void>) => {
  await cb();
});
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, after: afterMock };
});

// ---- email mock (Plan 04-05 — claimAndSendSessionEmail) ---------------------
const claimAndSendSessionEmail = vi.fn(async () => undefined);
vi.mock('@/lib/email', () => ({ claimAndSendSessionEmail }));

// ---- buildSystemPrompt — return short string to keep tests fast --------------
vi.mock('@/lib/system-prompt', () => ({
  buildSystemPrompt: () => 'SYS',
}));

// ---- anthropic provider stub ------------------------------------------------
vi.mock('@/lib/anthropic', () => ({
  anthropicProvider: () => ({}),
  MODELS: { MAIN: 'claude-sonnet-4-6', CLASSIFIER: 'claude-haiku-4-5' },
}));

// ---- cost stub --------------------------------------------------------------
vi.mock('@/lib/cost', () => ({
  computeCostCents: () => 10,
  normalizeAiSdkUsage: () => ({
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }),
}));

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const HAPPY_BODY = {
  session_id: 'sess_1234567890',
  messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy-path behavior:
  sessionSingle.mockResolvedValue({
    data: { email: 'r@x.com', email_domain: 'x.com', ended_at: null },
    error: null,
  });
  messagesCount.mockResolvedValue({ count: 0, error: null });
  isOverCap.mockResolvedValue(false);
  checkRateLimits.mockResolvedValue({ ok: true });
  classifyUserMessage.mockResolvedValue({ label: 'normal', confidence: 0.95 });
  incrementSpend.mockResolvedValue(undefined);
  incrementIpCost.mockResolvedValue(undefined);
  redisSet.mockResolvedValue('OK');
  persistNormalTurn.mockResolvedValue(undefined);
  persistToolCallTurn.mockResolvedValue(undefined);
  // streamText returns an object with toUIMessageStreamResponse so route can return it.
  streamTextMock.mockImplementation(() => ({
    toUIMessageStreamResponse: () => new Response('stream', { status: 200 }),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function postChat(body: unknown = HAPPY_BODY): Promise<Response> {
  const { POST } = await import('@/app/api/chat/route');
  return POST(makeRequest(body));
}

describe('/api/chat tools wiring', () => {
  it('passes tools + prepareStep + stopWhen + maxOutputTokens to streamText', async () => {
    await postChat();
    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const config = streamTextMock.mock.calls[0][0];
    expect(config.tools).toBeDefined();
    expect(config.tools.research_company).toBeDefined();
    expect(config.tools.get_case_study).toBeDefined();
    expect(config.tools.design_metric_framework).toBeDefined();
    expect(config.prepareStep).toBeDefined();
    expect(typeof config.prepareStep).toBe('function');
    // Phase 2 caps preserved:
    expect(config.stopWhen).toBeDefined();
    expect(config.maxOutputTokens).toBe(1500);
    expect(typeof config.onFinish).toBe('function');
  });

  it('onFinish writes heartbeat keys with TTL 120 AND persists tool calls', async () => {
    await postChat();
    const config = streamTextMock.mock.calls[0][0];
    const event = {
      text: 'hello',
      finishReason: 'stop',
      usage: {},
      steps: [
        {
          toolCalls: [{ toolCallId: 'tc_1', toolName: 'research_company', input: { name: 'X' } }],
          toolResults: [{ toolCallId: 'tc_1', output: { recent: false, results: [] } }],
        },
      ],
      response: { id: 'resp_1' },
    };
    await config.onFinish(event);

    // Heartbeat: BOTH keys, both with ex: 120
    const heartbeatCalls = redisSet.mock.calls.filter((c) =>
      String(c[0]).startsWith('heartbeat:'),
    );
    expect(heartbeatCalls.length).toBe(2);
    const heartbeatKeys = heartbeatCalls.map((c) => c[0]);
    expect(heartbeatKeys).toContain('heartbeat:anthropic');
    expect(heartbeatKeys).toContain('heartbeat:classifier');
    // TTL 120 on both:
    for (const c of heartbeatCalls) {
      expect(c[2]).toEqual({ ex: 120 });
    }

    // persistNormalTurn called:
    expect(persistNormalTurn).toHaveBeenCalledTimes(1);
    // persistToolCallTurn called with the same steps:
    expect(persistToolCallTurn).toHaveBeenCalledTimes(1);
    expect(persistToolCallTurn.mock.calls[0][0]).toMatchObject({
      session_id: 'sess_1234567890',
      steps: event.steps,
    });
    // Spend tracking still runs:
    expect(incrementSpend).toHaveBeenCalledTimes(1);
    expect(incrementIpCost).toHaveBeenCalledTimes(1);
  });

  it('W4: heartbeat writes survive even when persistNormalTurn throws', async () => {
    persistNormalTurn.mockRejectedValueOnce(new Error('db down'));
    await postChat();
    const config = streamTextMock.mock.calls[0][0];
    await config.onFinish({
      text: 'hello',
      finishReason: 'stop',
      usage: {},
      steps: [],
      response: { id: 'r' },
    });

    // Heartbeats fired despite persistence failure
    expect(redisSet).toHaveBeenCalledTimes(2);
    const keys = redisSet.mock.calls.map((c) => c[0]);
    expect(keys).toContain('heartbeat:anthropic');
    expect(keys).toContain('heartbeat:classifier');
  });

  it('W4: persistence runs even when heartbeat redis.set throws', async () => {
    redisSet.mockRejectedValue(new Error('redis down'));
    persistNormalTurn.mockResolvedValue(undefined);
    await postChat();
    const config = streamTextMock.mock.calls[0][0];
    await config.onFinish({
      text: 'hello',
      finishReason: 'stop',
      usage: {},
      steps: [],
      response: { id: 'r' },
    });

    // persistNormalTurn ran despite heartbeat failures
    expect(persistNormalTurn).toHaveBeenCalledTimes(1);
  });

  it('W4: heartbeat is awaited BEFORE persistNormalTurn (call-order recorder)', async () => {
    const order: string[] = [];
    redisSet.mockImplementation(async (key: string) => {
      order.push(`redis:${key}`);
      return 'OK';
    });
    persistNormalTurn.mockImplementation(async () => {
      order.push('persist_normal');
    });
    persistToolCallTurn.mockImplementation(async () => {
      order.push('persist_tool');
    });
    await postChat();
    const config = streamTextMock.mock.calls[0][0];
    await config.onFinish({
      text: 'hello',
      finishReason: 'stop',
      usage: {},
      steps: [],
      response: { id: 'r' },
    });

    // Heartbeat keys appear BEFORE persistNormalTurn in invocation order:
    const idxAnthropic = order.indexOf('redis:heartbeat:anthropic');
    const idxClassifier = order.indexOf('redis:heartbeat:classifier');
    const idxPersist = order.indexOf('persist_normal');
    expect(idxAnthropic).toBeGreaterThanOrEqual(0);
    expect(idxClassifier).toBeGreaterThanOrEqual(0);
    expect(idxPersist).toBeGreaterThanOrEqual(0);
    expect(idxAnthropic).toBeLessThan(idxPersist);
    expect(idxClassifier).toBeLessThan(idxPersist);
  });
});
