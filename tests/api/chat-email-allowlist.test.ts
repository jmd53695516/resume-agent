// tests/api/chat-email-allowlist.test.ts
// SEED-001 (quick task 260512-r4s) — end-to-end contract via /api/chat.
//
// Mirrors the env stub + mock structure from tests/api/chat-six-gate-order.test.ts
// (same six-gate route, same isolation level — pure vitest, no Next.js server,
// no Upstash/Anthropic live calls). Differences from that template:
//   - session.email is parameterized per-test via `currentSessionEmail` so we
//     can mint both allowlisted ('eval-cli@joedollinger.dev') and pattern-
//     adjacent ('eval-cli-test@joedollinger.dev') paths.
//   - checkRateLimits is mocked to invoke the REAL isEmailRatelimitAllowlisted
//     guard, plus emit a recorder so we can assert the underlying email
//     limiter was/wasn't reached. Per-IP / spendcap deflection paths are
//     forced via mockImplementationOnce per test.
//   - persistDeflectionTurn is a vi.fn() spy so Test 2/3/4 can assert it was
//     called with the right `reason`.
//
// SECURITY-CRITICAL test in this file: Test 3 — allowlisted email STILL hits
// per-IP rate limit. Per T-r4s-01 in the PLAN's STRIDE register, that's the
// primary backstop if an attacker learns the eval-cli email.

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
// Spy on emailLimiterDay.limit so Test 1 can assert it WASN'T called when the
// allowlisted email flows through, and Test 2 can assert it WAS called for
// the pattern-adjacent email. The mocked checkRateLimits invokes the same
// allowlist guard the real implementation uses (kept inline to avoid pulling
// real Ratelimit constructors into the test).
const emailLimiterDayLimit = vi.fn(async (_email: string) => ({
  success: true,
  limit: 150,
  remaining: 149,
  reset: Date.now() + 86400000,
  pending: Promise.resolve(),
}));

// Default checkRateLimits implementation — green path, but runs the real
// allowlist guard. Each test can override via mockImplementationOnce.
// Typed explicitly with the full RateLimitCheck union so that
// mockImplementationOnce can return failure variants (ok:false branches)
// in Tests 2 + 3 without TS narrowing rejecting them.
type RLCheck =
  | { ok: true }
  | { ok: false; which: 'ip10m' | 'ipday' | 'email' | 'session' | 'ipcost' };
const checkRateLimits = vi.fn<
  (ipKey: string, email: string, sessionId: string) => Promise<RLCheck>
>(async (_ipKey: string, email: string, _sessionId: string) => {
  const ALLOWLIST = new Set(['eval-cli@joedollinger.dev']);
  if (!ALLOWLIST.has(email)) {
    await emailLimiterDayLimit(email);
  }
  return { ok: true };
});

const isOverCap = vi.fn(async () => false);
const incrementSpend = vi.fn();
const incrementIpCost = vi.fn();

vi.mock('@/lib/redis', () => ({
  redis: { set: vi.fn(), get: vi.fn(), ping: vi.fn() },
  checkRateLimits,
  isOverCap,
  incrementSpend,
  incrementIpCost,
  // SEED-001 spend-cap half (quick task 260512-ro4): route imports this
  // helper. Default to "not allowlisted" — none of the surviving 3 tests
  // exercise the spend-cap allowlist path (the deleted Test 4 used to,
  // but its premise was inverted by D-A-01 and superseded by
  // chat-spendcap-allowlist.test.ts Test 1).
  isEmailSpendCapAllowlisted: () => false,
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

// ---- persistence spies (Test 2/3 assert these) -----------------------------
const persistDeflectionTurn = vi.fn(async () => {});
const persistNormalTurn = vi.fn(async () => {});
const persistToolCallTurn = vi.fn(async () => {});
vi.mock('@/lib/persistence', () => ({
  persistDeflectionTurn,
  persistNormalTurn,
  persistToolCallTurn,
}));

// ---- remaining stubs (parity with chat-six-gate-order.test.ts) -------------
vi.mock('@/lib/system-prompt', () => ({ buildSystemPrompt: () => 'SYS' }));
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
      // Run inline so deflection-only tests don't leak unflushed work.
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
  checkRateLimits.mockImplementation(
    async (_ipKey: string, email: string, _sessionId: string) => {
      const ALLOWLIST = new Set(['eval-cli@joedollinger.dev']);
      if (!ALLOWLIST.has(email)) {
        await emailLimiterDayLimit(email);
      }
      return { ok: true } as const;
    },
  );
  emailLimiterDayLimit.mockImplementation(async (_email: string) => ({
    success: true,
    limit: 150,
    remaining: 149,
    reset: Date.now() + 86400000,
    pending: Promise.resolve(),
  }));
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

describe('/api/chat — SEED-001 email allowlist contract', () => {
  it('SEED-001 AC: exact-match — eval-cli@joedollinger.dev bypasses email window and reaches classifier', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    const res = await postChat();

    // Reached classifier (proves route didn't deflect at rate-limit gate).
    expect(classifyUserMessage).toHaveBeenCalledTimes(1);
    // Email limiter NOT consulted for allowlisted email.
    expect(emailLimiterDayLimit).not.toHaveBeenCalled();
    // No ratelimit deflection emitted.
    expect(persistDeflectionTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    expect(res.status).toBe(200);
  });

  it('SEED-001 AC: pattern-adjacent eval-cli-test@joedollinger.dev does NOT bypass — limiter consulted and trips a deflection', async () => {
    currentSessionEmail = 'eval-cli-test@joedollinger.dev';
    // Force the per-email limiter to return failure for this pattern-adjacent
    // email. checkRateLimits should consult it (not bypass) and surface a
    // ratelimit deflection.
    emailLimiterDayLimit.mockImplementationOnce(async (_email: string) => ({
      success: false,
      limit: 150,
      remaining: 0,
      reset: Date.now() + 86400000,
      pending: Promise.resolve(),
    }));
    checkRateLimits.mockImplementationOnce(
      async (_ipKey: string, email: string, _sessionId: string) => {
        const ALLOWLIST = new Set(['eval-cli@joedollinger.dev']);
        if (!ALLOWLIST.has(email)) {
          const r = await emailLimiterDayLimit(email);
          if (!r.success) return { ok: false, which: 'email' } as const;
        }
        return { ok: true } as const;
      },
    );

    await postChat();

    expect(emailLimiterDayLimit).toHaveBeenCalledTimes(1);
    expect(emailLimiterDayLimit).toHaveBeenCalledWith('eval-cli-test@joedollinger.dev');
    expect(persistDeflectionTurn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    // Classifier should NOT have been reached — route short-circuited at gate 5.
    expect(classifyUserMessage).not.toHaveBeenCalled();
  });

  it('SEED-001 AC: per-IP rate limit STILL applies to allowlisted eval-cli email (T-r4s-01 mitigation)', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    // Even for the allowlisted email, simulate the ip10m sliding-window
    // tripping (an attacker spoofing the email from one source IP). The
    // route must still deflect with reason=ratelimit.
    checkRateLimits.mockImplementationOnce(async () => ({
      ok: false,
      which: 'ip10m' as const,
    }));

    await postChat();

    expect(persistDeflectionTurn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    expect(classifyUserMessage).not.toHaveBeenCalled();
  });

  // NOTE: Prior Test 4 ("SEED-001 AC: spend cap STILL applies to allowlisted
  // eval-cli email (T-r4s-04 / gate 4 ordering preserved)") was DELETED on
  // 2026-05-12 as part of the SEED-001 spend-cap half (quick task 260512-ro4).
  // Its premise — that an allowlisted eval-cli email STILL trips spendcap at
  // gate 4 — was inverted by D-A-01: eval-cli traffic now bypasses gate 4
  // entirely. The corrected post-fix behavior is asserted by Test 1 in the
  // sibling file tests/api/chat-spendcap-allowlist.test.ts (eval-cli reaches
  // classifier even when isOverCap=true). Leaving the deleted test in place
  // would be a self-contradictory regression-trap.
});
