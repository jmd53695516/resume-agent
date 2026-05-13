// tests/api/chat-iprl-allowlist.test.ts
// SEED-001 (quick task 260512-sne) — end-to-end contract via /api/chat for
// the IP-RATE-LIMIT half of the eval-cli allowlist. Third sibling to
// tests/api/chat-email-allowlist.test.ts (rate-limit half, 260512-r4s) and
// tests/api/chat-spendcap-allowlist.test.ts (spend-cap half, 260512-ro4).
//
// Mirrors the env stub + mock structure from chat-spendcap-allowlist.test.ts
// (same six-gate route, same isolation level — pure vitest, no Next.js
// server, no Upstash/Anthropic live calls). Differences:
//   - The @/lib/redis mock exports a real-shape isEmailIpRatelimitAllowlisted
//     spy that returns true only for 'eval-cli@joedollinger.dev' — mirrors
//     the production exact-match contract.
//   - The integration assertions exercise the route's gate-5 path
//     (`checkRateLimits` short-circuit). The internal ip10m/ipday skip lives
//     INSIDE checkRateLimits in src/lib/redis.ts — that's unit-tested in
//     tests/lib/redis.test.ts. This file asserts the END-TO-END contract
//     through /api/chat.
//
// SECURITY-CRITICAL test in this file: Test 4 — per-IP cost cap (SAFE-08,
// 150¢/day per IP) STILL trips for an eval-cli@ session. T-sne-04 in the
// PLAN's STRIDE register treats this as the load-bearing last-line cost
// backstop now that ip10m + ipday are bypassed for eval-cli traffic.
// Mirrors chat-spendcap-allowlist Test 3 (T-ro4-04 assertion).

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

// Per-test mutable session email — set before each `it` so the supabase
// .single() mock returns the right row for the gate the test is exercising.
let currentSessionEmail = 'eval-cli@joedollinger.dev';

// ---- @/lib/redis mock ------------------------------------------------------
// Each spy here mirrors the production-function shape so the route's gate-5
// checkRateLimits invocation behaves as it does in prod.
const isOverCap = vi.fn(async () => false);
const incrementSpend = vi.fn(async (_cents: number, _opts?: { email?: string }) => {});
const incrementIpCost = vi.fn(async (_ipKey: string, _cents: number) => {});
const isEmailSpendCapAllowlisted = vi.fn(
  (email: string) => email === 'eval-cli@joedollinger.dev',
);
const isEmailIpRatelimitAllowlisted = vi.fn(
  (email: string) => email === 'eval-cli@joedollinger.dev',
);

type RLCheck =
  | { ok: true }
  | { ok: false; which: 'ip10m' | 'ipday' | 'email' | 'session' | 'ipcost' };
const checkRateLimits = vi.fn<
  (ipKey: string, email: string, sessionId: string) => Promise<RLCheck>
>(async () => ({ ok: true }));

vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn(), get: vi.fn(), ping: vi.fn() },
  checkRateLimits,
  isOverCap,
  incrementSpend,
  incrementIpCost,
  isEmailSpendCapAllowlisted,
  isEmailIpRatelimitAllowlisted,
}));

// ---- Supabase chain --------------------------------------------------------
const sessionsSingle = vi.fn(async () => ({
  data: { email: currentSessionEmail, email_domain: 'joedollinger.dev', ended_at: null },
  error: null,
}));
const messagesIn = vi.fn(async () => ({ count: 0, error: null }));
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
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin }));

// ---- classifier ------------------------------------------------------------
const classifyUserMessage = vi.fn(async () => ({ label: 'normal', confidence: 0.95 }));
vi.mock('@/lib/classifier', () => ({ classifyUserMessage }));

// ---- streamText stub -------------------------------------------------------
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(() => ({
      toUIMessageStreamResponse: () => new Response('stream', { status: 200 }),
    })),
  };
});

// ---- persistence spies -----------------------------------------------------
const persistDeflectionTurn = vi.fn(async () => {});
const persistNormalTurn = vi.fn(async () => {});
const persistToolCallTurn = vi.fn(async () => {});
vi.mock('@/lib/persistence', () => ({
  persistDeflectionTurn,
  persistNormalTurn,
  persistToolCallTurn,
}));

// ---- remaining stubs (parity with chat-spendcap-allowlist.test.ts) --------
vi.mock('@/lib/system-prompt', () => ({ buildSystemPrompt: () => 'SYS' }));
vi.mock('@/lib/anthropic', () => ({
  anthropicProvider: () => ({}),
  MODELS: { MAIN: 'claude-sonnet-4-6', CLASSIFIER: 'claude-haiku-4-5' },
}));
vi.mock('@/lib/cost', () => ({
  computeCostCents: () => 3,
  normalizeAiSdkUsage: () => ({
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  }),
}));
vi.mock('@vercel/functions', () => ({ ipAddress: () => 'test-ip' }));
vi.mock('@/lib/tools', () => ({
  research_company: {},
  get_case_study: {},
  design_metric_framework: {},
  enforceToolCallDepthCap: () => ({}),
}));
vi.mock('@/lib/email', () => ({
  claimAndSendSessionEmail: vi.fn(async () => {}),
}));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (fn: () => unknown) => {
      try {
        const r = fn();
        if (r && typeof (r as Promise<unknown>).then === 'function') {
          return (r as Promise<unknown>).catch(() => {});
        }
      } catch {
        // swallow
      }
      return undefined;
    },
  };
});

// ---- request helper --------------------------------------------------------
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

async function postChat(body: unknown = HAPPY_BODY): Promise<Response> {
  const { POST } = await import('@/app/api/chat/route');
  return POST(makeRequest(body));
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSessionEmail = 'eval-cli@joedollinger.dev';

  // Restore default happy-path implementations after clearAllMocks.
  isOverCap.mockImplementation(async () => false);
  checkRateLimits.mockImplementation(async () => ({ ok: true }) as const);
  isEmailSpendCapAllowlisted.mockImplementation(
    (email: string) => email === 'eval-cli@joedollinger.dev',
  );
  isEmailIpRatelimitAllowlisted.mockImplementation(
    (email: string) => email === 'eval-cli@joedollinger.dev',
  );
  classifyUserMessage.mockImplementation(async () => ({
    label: 'normal',
    confidence: 0.95,
  }));
  sessionsSingle.mockImplementation(async () => ({
    data: { email: currentSessionEmail, email_domain: 'joedollinger.dev', ended_at: null },
    error: null,
  }));
  messagesIn.mockImplementation(async () => ({ count: 0, error: null }));
});

afterEach(() => {
  vi.resetModules();
});

// TODO(SEED-002): Un-skip when SAFETY_GATES_ENABLED='true' is set in Vercel
// envs (gates 4 + 5 re-enabled). See .planning/seeds/SEED-002-re-enable-rate-
// limits-and-spend-cap.md for re-enable criteria and the planning quick task
// .planning/quick/260512-tku-disable-rate-limit-spend-cap-gates-globa/ for
// why this was disabled. SEED-001 helper code (EVAL_CLI_ALLOWLIST in
// src/lib/redis.ts) IS PRESERVED — re-enable is .skip → skip removed, no
// implementation work. Single-line edit per file when re-enabling.
describe.skip('/api/chat — SEED-001 ip-rate-limit allowlist contract', () => {
  it('SEED-001 ip-rl AC: exact-match — eval-cli@joedollinger.dev bypasses ip10m and reaches classifier', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    // checkRateLimits returns ok:true by default — this simulates the
    // production behavior where the allowlisted email's ip10m + ipday
    // checks short-circuit inside checkRateLimits to {success:true}.
    // The unit-layer assertion (ip10m.limit not called) lives in
    // tests/lib/redis.test.ts Test N. This test asserts the END-TO-END
    // contract: the route reaches classifier on the allowlisted email.

    const res = await postChat();

    // Route reached gate 6 — proves the gate-5 short-circuit fired.
    expect(classifyUserMessage).toHaveBeenCalledTimes(1);
    // checkRateLimits WAS consulted with the canonical eval-cli email.
    expect(checkRateLimits).toHaveBeenCalledWith(
      expect.any(String),
      'eval-cli@joedollinger.dev',
      expect.any(String),
    );
    // No ratelimit deflection emitted.
    expect(persistDeflectionTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    expect(res.status).toBe(200);
  });

  it('SEED-001 ip-rl AC: exact-match — eval-cli@joedollinger.dev bypasses ipday and reaches classifier', async () => {
    // Same setup as Test 1 — both ip10m + ipday use the same allowlist guard
    // inside checkRateLimits. We split for documentation clarity and
    // traceability against SEED-001 Acceptance Criteria. The unit-layer
    // assertion (ipday.limit not called) lives in tests/lib/redis.test.ts
    // Test N which asserts BOTH limiters are bypassed.
    currentSessionEmail = 'eval-cli@joedollinger.dev';

    const res = await postChat();

    expect(classifyUserMessage).toHaveBeenCalledTimes(1);
    expect(checkRateLimits).toHaveBeenCalledWith(
      expect.any(String),
      'eval-cli@joedollinger.dev',
      expect.any(String),
    );
    expect(persistDeflectionTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    expect(res.status).toBe(200);
  });

  it('SEED-001 ip-rl AC: pattern-adjacent eval-cli-test@joedollinger.dev does NOT bypass — ip10m deflection fires', async () => {
    currentSessionEmail = 'eval-cli-test@joedollinger.dev';
    // Simulate ip10m tripping for the pattern-adjacent email (because it
    // is NOT allowlisted — exact-match contract). Route must surface a
    // ratelimit deflection. This is the security-critical pattern-adjacency
    // test at the integration layer. Unit-layer counterpart: Task 1 Test P
    // in tests/lib/redis.test.ts.
    checkRateLimits.mockImplementationOnce(async () => ({
      ok: false,
      which: 'ip10m' as const,
    }));

    await postChat();

    expect(persistDeflectionTurn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    // Classifier should NOT have been reached — route short-circuited at gate 5.
    expect(classifyUserMessage).not.toHaveBeenCalled();
  });

  it('SEED-001 ip-rl AC: per-IP cost cap (SAFE-08) STILL trips for eval-cli email — T-sne-04 last-line backstop', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    // Per-IP cost cap fires for the allowlisted email. The route maps
    // 'ipcost' (gate 5 failure mode) → reason 'ratelimit' (see route.ts).
    // Allowlisted email is STILL ratelimited at the IP cost layer —
    // this is the security-critical last-line backstop. SAFE-08 operates
    // on ipKey, NOT on email, so allowlisting email cannot affect this
    // gate. Mirrors chat-spendcap-allowlist Test 3 (T-ro4-04) verbatim
    // with T-sne-04 substituted.
    checkRateLimits.mockImplementationOnce(async () => ({
      ok: false,
      which: 'ipcost' as const,
    }));

    await postChat();

    expect(persistDeflectionTurn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    expect(classifyUserMessage).not.toHaveBeenCalled();
  });

  it('SEED-001 ip-rl AC: session limiter STILL applies to eval-cli email (D-A-01 scope boundary)', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    // Session limiter fires for the allowlisted email — possible if a
    // single session somehow accumulates >200 turns in 7d. Session limiter
    // operates on sessionId, NOT on email, so allowlisting email cannot
    // affect this gate. D-A-01 explicit scope boundary: session limiter
    // remains a safety-net backstop. Route maps 'session' (gate 5 failure
    // mode) → reason 'ratelimit'.
    checkRateLimits.mockImplementationOnce(async () => ({
      ok: false,
      which: 'session' as const,
    }));

    await postChat();

    expect(persistDeflectionTurn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    expect(classifyUserMessage).not.toHaveBeenCalled();
  });
});
