// tests/api/chat-bl17-session-error.test.ts
// BL-17 regression: /api/chat must distinguish genuine session-not-found
// (Supabase PGRST116 = .single() got 0 rows → 404) from infrastructure
// failure (network / auth / DB error → 503). Conflating them returned 404
// on Supabase outage, which useChat treats as graceful-end and silently
// absorbs — defeating the 2-consecutive-500 redirect protection in ChatUI.
//
// Mock layout follows tests/api/chat-six-gate-order.test.ts so module
// imports resolve to lightweight stubs and the test exits at the
// session-lookup gate without reaching streamText / persistence / etc.
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const sessionsSingle = vi.fn();
const sessionsChain = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({ single: sessionsSingle })),
  })),
};
const supabaseAdmin = {
  from: vi.fn((table: string) => {
    if (table === 'sessions') return sessionsChain;
    throw new Error(`unexpected table: ${table}`);
  }),
};

vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn(), get: vi.fn(), ping: vi.fn() },
  checkRateLimits: vi.fn(async () => ({ ok: true })),
  isOverCap: vi.fn(async () => false),
  incrementSpend: vi.fn(),
  incrementIpCost: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin }));
vi.mock('@/lib/classifier', () => ({
  classifyUserMessage: vi.fn(async () => ({ label: 'normal', confidence: 0.95 })),
}));
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response('stream', { status: 200 }),
    })),
  };
});
vi.mock('@/lib/persistence', () => ({
  persistNormalTurn: vi.fn(),
  persistDeflectionTurn: vi.fn(),
  persistToolCallTurn: vi.fn(),
}));
vi.mock('@/lib/system-prompt', () => ({
  buildSystemPrompt: () => 'SYS',
}));
vi.mock('@/lib/anthropic', () => ({
  anthropicProvider: () => ({}),
  MODELS: { MAIN: 'claude-sonnet-4-6', CLASSIFIER: 'claude-haiku-4-5' },
}));
vi.mock('@/lib/cost', () => ({
  computeCostCents: () => 0,
  normalizeAiSdkUsage: () => ({
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }),
}));
vi.mock('@/lib/email', () => ({
  claimAndSendSessionEmail: vi.fn(),
}));
vi.mock('@vercel/functions', () => ({ ipAddress: () => 'test-ip' }));

function makeRequest(): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      session_id: '01JABCDEFGHJKMNPQRSTVWXYZ0',
      messages: [
        {
          id: 'u1',
          role: 'user',
          parts: [{ type: 'text', text: 'hi' }],
        },
      ],
    }),
  });
}

describe('BL-17: /api/chat session-lookup error discrimination', () => {
  beforeEach(() => {
    sessionsSingle.mockReset();
  });

  it('returns 404 when sessionErr.code is PGRST116 (genuine session-not-found)', async () => {
    sessionsSingle.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
      },
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Session unknown');
  });

  it('returns 503 when sessionErr is a network/connectivity failure (not PGRST116)', async () => {
    sessionsSingle.mockResolvedValue({
      data: null,
      error: {
        code: undefined,
        message: 'TypeError: fetch failed',
        details: 'getaddrinfo ENOTFOUND fake.supabase.co',
      },
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('Service unavailable');
  });

  it('returns 503 on any non-PGRST116 PostgREST error code', async () => {
    sessionsSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST301', message: 'gateway timeout' },
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
  });

  it('returns 404 when session genuinely has ended_at set', async () => {
    sessionsSingle.mockResolvedValue({
      data: {
        email: 'r@x.com',
        email_domain: 'x.com',
        ended_at: '2026-05-08T00:00:00Z',
      },
      error: null,
    });
    const { POST } = await import('@/app/api/chat/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Session ended');
  });
});
