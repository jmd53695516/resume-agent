// tests/api/chat-six-gate-order.test.ts
// Plan 03-02 Task 3 (W7) — durable defense against future executors
// reordering the six-gate prelude in src/app/api/chat/route.ts.
//
// Strategy: each gate's underlying call is mocked with a recorder that pushes
// a fixed identifier into a shared array. On the happy path all six fire in
// the canonical sequence; on a tripped early gate, later gates do NOT appear.
//
// Canonical order (verified against current route.ts lines 86-202):
//   1. body_parse        → req.json() / BodySchema.safeParse
//   2. session_lookup    → supabaseAdmin.from('sessions').select(...).eq('id', ...).single()
//   3. turnRows_check    → supabaseAdmin.from('messages').select(...).eq('session_id', ...).in('role', ...)
//   4. over_cap_check    → isOverCap()
//   5. rate_limit_check  → checkRateLimits(...)
//   6. classifier        → classifyUserMessage(...)
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

// Module-scope recorder array — every gate mock pushes its identifier.
const gateOrderRecorder: string[] = [];

// Each happy-path mock records, then returns the value the route expects.
const isOverCap = vi.fn(async () => {
  gateOrderRecorder.push('over_cap_check');
  return false;
});
const checkRateLimits = vi.fn(async () => {
  gateOrderRecorder.push('rate_limit_check');
  return { ok: true };
});
const incrementSpend = vi.fn();
const incrementIpCost = vi.fn();
const classifyUserMessage = vi.fn(async () => {
  gateOrderRecorder.push('classifier');
  return { label: 'normal', confidence: 0.95 };
});

// Supabase chain — distinguishes 'sessions' vs 'messages' tables to record
// the correct gate identifier. The route uses .single() for sessions and
// .in('role', [...]) for messages — match the real signatures.
const sessionsSingle = vi.fn(async () => {
  gateOrderRecorder.push('session_lookup');
  return { data: { email: 'r@x.com', email_domain: 'x.com', ended_at: null }, error: null };
});
const messagesIn = vi.fn(async () => {
  gateOrderRecorder.push('turnRows_check');
  return { count: 0, error: null };
});

const sessionsChain = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({ single: sessionsSingle })),
  })),
};
const messagesChain = {
  select: vi.fn(() => ({
    eq: vi.fn(() => ({ in: messagesIn })),
  })),
};
const supabaseAdmin = {
  from: vi.fn((table: string) => {
    if (table === 'sessions') return sessionsChain;
    if (table === 'messages') return messagesChain;
    throw new Error(`unexpected table: ${table}`);
  }),
};

vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn(), get: vi.fn(), ping: vi.fn() },
  checkRateLimits,
  isOverCap,
  incrementSpend,
  incrementIpCost,
  // SEED-001 spend-cap half (quick task 260512-ro4): route imports this
  // helper. Default to "not allowlisted" so the six-gate order test's
  // r@x.com email still triggers isOverCap (gate 4 still records the
  // 'over_cap_check' entry — six-gate canonical sequence preserved).
  isEmailSpendCapAllowlisted: () => false,
  // SEED-001 ip-rl half (quick task 260512-sne): route module load resolves.
  // Happy-path uses r@x.com (not allowlisted) so gate 5 still records
  // 'rate_limit_check' via the mocked checkRateLimits.
  isEmailIpRatelimitAllowlisted: () => false,
}));
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin }));
vi.mock('@/lib/classifier', () => ({ classifyUserMessage }));

// streamText: no-op stub. We never reach it on the deflection-path tests, and
// on the happy-path test we don't care about the stream — only the gate order.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response('stream', { status: 200 }),
    })),
  };
});

// Persistence: deflection paths call persistDeflectionTurn — mock to no-op.
vi.mock('@/lib/persistence', () => ({
  persistNormalTurn: vi.fn(),
  persistDeflectionTurn: vi.fn(),
  persistToolCallTurn: vi.fn(),
}));

// buildSystemPrompt + anthropic + cost — keep stubs cheap.
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
vi.mock('@vercel/functions', () => ({ ipAddress: () => 'test-ip' }));

// Spy on Request.prototype.json to record body_parse as the first gate. The
// route handler calls req.json() at line ~87, BEFORE BodySchema.safeParse,
// and BEFORE any other gate-side-effect can run.
let originalJson: typeof Request.prototype.json;

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// 260512-tku: gates 4 + 5 are now behind SAFETY_GATES_ENABLED env flag.
// Default OFF. Per-test enablement via process.env mutation; afterEach restores.
function withGatesEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.SAFETY_GATES_ENABLED;
  process.env.SAFETY_GATES_ENABLED = 'true';
  return fn().finally(() => {
    if (prev === undefined) delete process.env.SAFETY_GATES_ENABLED;
    else process.env.SAFETY_GATES_ENABLED = prev;
  });
}

const HAPPY_BODY = {
  session_id: 'sess_1234567890',
  messages: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
};

beforeEach(() => {
  gateOrderRecorder.length = 0;
  vi.clearAllMocks();
  // Restore default happy-path implementations after clearAllMocks:
  isOverCap.mockImplementation(async () => {
    gateOrderRecorder.push('over_cap_check');
    return false;
  });
  checkRateLimits.mockImplementation(async () => {
    gateOrderRecorder.push('rate_limit_check');
    return { ok: true };
  });
  classifyUserMessage.mockImplementation(async () => {
    gateOrderRecorder.push('classifier');
    return { label: 'normal', confidence: 0.95 };
  });
  sessionsSingle.mockImplementation(async () => {
    gateOrderRecorder.push('session_lookup');
    return { data: { email: 'r@x.com', email_domain: 'x.com', ended_at: null }, error: null };
  });
  messagesIn.mockImplementation(async () => {
    gateOrderRecorder.push('turnRows_check');
    return { count: 0, error: null };
  });

  // Spy req.json to record 'body_parse' before zod parse.
  originalJson = Request.prototype.json;
  Request.prototype.json = async function (this: Request) {
    gateOrderRecorder.push('body_parse');
    return originalJson.call(this);
  } as typeof Request.prototype.json;
});

afterEach(() => {
  Request.prototype.json = originalJson;
  // 260512-tku: paranoid cleanup — never let SAFETY_GATES_ENABLED leak between
  // tests. The withGatesEnabled helper does its own restoration, but if a test
  // throws before the finally block runs (or if a future test sets the env
  // var directly), this guarantees the next test sees the default-OFF state.
  delete process.env.SAFETY_GATES_ENABLED;
});

async function postChat(body: unknown = HAPPY_BODY): Promise<Response> {
  const { POST } = await import('@/app/api/chat/route');
  return POST(makeRequest(body));
}

describe('/api/chat six-gate canonical order (W7 — durable defense; 260512-tku flag-aware)', () => {
  it('fires gates 1/2/3/6 in canonical order on happy-path with SAFETY_GATES_ENABLED unset (default — 260512-tku flag-off)', async () => {
    await postChat();
    expect(gateOrderRecorder).toEqual([
      'body_parse',
      'session_lookup',
      'turnRows_check',
      'classifier',
    ]);
    // Gates 4 + 5 must NOT have fired — kill-switch is off by default.
    expect(isOverCap).not.toHaveBeenCalled();
    expect(checkRateLimits).not.toHaveBeenCalled();
  });

  it('fires ALL six gates in canonical order on happy-path when SAFETY_GATES_ENABLED=true (260512-tku flag-on)', async () => {
    await withGatesEnabled(async () => {
      await postChat();
    });
    expect(gateOrderRecorder).toEqual([
      'body_parse',
      'session_lookup',
      'turnRows_check',
      'over_cap_check',
      'rate_limit_check',
      'classifier',
    ]);
  });

  it('stops at session_lookup when session is missing (no later gates fire)', async () => {
    sessionsSingle.mockImplementationOnce(async () => {
      gateOrderRecorder.push('session_lookup');
      // session-not-found short-circuits the route — null data is the
      // production behavior; cast satisfies the inferred mock signature
      // without leaking happy-path types into the negative test.
      return { data: null as unknown as { email: string; email_domain: string; ended_at: null }, error: null };
    });
    await postChat();
    expect(gateOrderRecorder).toEqual(['body_parse', 'session_lookup']);
  });

  it('stops at turnRows_check when count >= 60', async () => {
    messagesIn.mockImplementationOnce(async () => {
      gateOrderRecorder.push('turnRows_check');
      return { count: 60, error: null };
    });
    await postChat();
    expect(gateOrderRecorder).toEqual(['body_parse', 'session_lookup', 'turnRows_check']);
  });

  it('stops at over_cap_check when isOverCap returns true AND SAFETY_GATES_ENABLED=true (legacy six-gate behavior; 260512-tku flag-on)', async () => {
    isOverCap.mockImplementationOnce(async () => {
      gateOrderRecorder.push('over_cap_check');
      return true;
    });
    await withGatesEnabled(async () => {
      await postChat();
    });
    expect(gateOrderRecorder).toEqual([
      'body_parse',
      'session_lookup',
      'turnRows_check',
      'over_cap_check',
    ]);
  });

  it('stops at rate_limit_check when checkRateLimits returns ok:false AND SAFETY_GATES_ENABLED=true (legacy six-gate behavior; 260512-tku flag-on)', async () => {
    checkRateLimits.mockImplementationOnce(async () => {
      gateOrderRecorder.push('rate_limit_check');
      return { ok: false, which: 'ip10m' as const };
    });
    await withGatesEnabled(async () => {
      await postChat();
    });
    expect(gateOrderRecorder).toEqual([
      'body_parse',
      'session_lookup',
      'turnRows_check',
      'over_cap_check',
      'rate_limit_check',
    ]);
  });

  it('SAFETY_GATES_ENABLED unset (default): isOverCap=true does NOT trigger spendcap deflection — gate 4 is fully skipped (260512-tku regression trap)', async () => {
    isOverCap.mockImplementation(async () => {
      gateOrderRecorder.push('over_cap_check'); // would record if called
      return true;
    });
    await postChat();
    // Gate 4 NEVER consulted — over_cap_check absent from recorder.
    expect(gateOrderRecorder).not.toContain('over_cap_check');
    expect(isOverCap).not.toHaveBeenCalled();
    // Route reached classifier (gate 6).
    expect(gateOrderRecorder).toContain('classifier');
  });

  it('SAFETY_GATES_ENABLED unset (default): checkRateLimits returning ok:false does NOT trigger ratelimit deflection — gate 5 is fully skipped (260512-tku regression trap)', async () => {
    checkRateLimits.mockImplementation(async () => {
      gateOrderRecorder.push('rate_limit_check'); // would record if called
      return { ok: false, which: 'ip10m' as const };
    });
    await postChat();
    expect(gateOrderRecorder).not.toContain('rate_limit_check');
    expect(checkRateLimits).not.toHaveBeenCalled();
    expect(gateOrderRecorder).toContain('classifier');
  });
});
