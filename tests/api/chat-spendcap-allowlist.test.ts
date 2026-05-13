// tests/api/chat-spendcap-allowlist.test.ts
// SEED-001 (quick task 260512-ro4) — end-to-end contract via /api/chat for
// the SPEND-CAP half of the eval-cli allowlist. Sibling to
// tests/api/chat-email-allowlist.test.ts (rate-limit half).
//
// Mirrors the env stub + mock structure from chat-email-allowlist.test.ts
// (same six-gate route, same isolation level — pure vitest, no Next.js
// server, no Upstash/Anthropic live calls). Differences:
//   - The @/lib/redis mock exports a real-shape isEmailSpendCapAllowlisted
//     spy that returns true only for 'eval-cli@joedollinger.dev' — mirrors
//     the production exact-match contract so the route's gate-4 short-
//     circuit behaves as it does in prod.
//   - The streamText mock CAPTURES the onFinish callback so Test 4 can
//     invoke it manually and assert incrementSpend was called with the
//     email opts arg (the streamText mock returns a synthetic Response
//     and never naturally invokes onFinish).
//
// SECURITY-CRITICAL test in this file: Test 3 — per-IP cost cap (SAFE-08,
// 150¢/day per IP) STILL trips for an eval-cli@ session. T-ro4-04 in the
// PLAN's STRIDE register treats this as the load-bearing last-line cost
// backstop now that SAFE-04 global cap is bypassed for eval-cli traffic.

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
// Each spy here mirrors the production-function shape so the route's gate-4
// short-circuit and onFinish increment paths behave as they do in prod.
const isOverCap = vi.fn(async () => false);
const incrementSpend = vi.fn(async (_cents: number, _opts?: { email?: string }) => {});
const incrementIpCost = vi.fn(async (_ipKey: string, _cents: number) => {});
const isEmailSpendCapAllowlisted = vi.fn(
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

// ---- streamText stub — captures onFinish for Test 4 ------------------------
// The mock returns a synthetic Response and DOES NOT invoke the onFinish
// callback the route passes in. Test 4 needs to assert post-onFinish state
// (incrementSpend called with email opts), so we capture the callback at
// streamText() call time and invoke it manually inside the test.
type OnFinishEvent = {
  usage: unknown;
  text: string;
  finishReason: string;
  steps: unknown[];
  response: { id: string };
};
let capturedOnFinish: ((event: OnFinishEvent) => Promise<void>) | undefined;
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: vi.fn(
      (opts: { onFinish?: (event: OnFinishEvent) => Promise<void> }) => {
        capturedOnFinish = opts.onFinish;
        return {
          toUIMessageStreamResponse: () => new Response('stream', { status: 200 }),
        };
      },
    ),
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

// ---- remaining stubs (parity with chat-email-allowlist.test.ts) -----------
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
  capturedOnFinish = undefined;
  currentSessionEmail = 'eval-cli@joedollinger.dev';

  // Restore default happy-path implementations after clearAllMocks.
  isOverCap.mockImplementation(async () => false);
  checkRateLimits.mockImplementation(async () => ({ ok: true }) as const);
  isEmailSpendCapAllowlisted.mockImplementation(
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

describe('/api/chat — SEED-001 spend-cap allowlist contract', () => {
  it('SEED-001 spend-cap AC: exact-match — eval-cli@joedollinger.dev bypasses gate 4 (cap tripped, request still reaches classifier)', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    // Global cap IS tripped — non-allowlisted traffic would deflect here.
    isOverCap.mockImplementation(async () => true);

    const res = await postChat();

    // Route reached gate 6 — proves the gate-4 short-circuit fired.
    expect(classifyUserMessage).toHaveBeenCalledTimes(1);
    // No spendcap deflection emitted.
    expect(persistDeflectionTurn).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'spendcap' }),
    );
    // The allowlist guard WAS consulted with the canonical email.
    expect(isEmailSpendCapAllowlisted).toHaveBeenCalledWith('eval-cli@joedollinger.dev');
    expect(res.status).toBe(200);
  });

  it('SEED-001 spend-cap AC: pattern-adjacent eval-cli-test@joedollinger.dev does NOT bypass — spendcap deflection fires', async () => {
    currentSessionEmail = 'eval-cli-test@joedollinger.dev';
    isOverCap.mockImplementation(async () => true);

    await postChat();

    // Deflection emitted with reason=spendcap.
    expect(persistDeflectionTurn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'spendcap' }),
    );
    // Gate 4 short-circuit consulted the allowlist for the pattern-adjacent
    // email and returned false — isOverCap then ran (returned true) and
    // deflected. Later gates must NOT have run.
    expect(isEmailSpendCapAllowlisted).toHaveBeenCalledWith('eval-cli-test@joedollinger.dev');
    expect(checkRateLimits).not.toHaveBeenCalled();
    expect(classifyUserMessage).not.toHaveBeenCalled();
  });

  it('SEED-001 spend-cap AC: per-IP cost cap (SAFE-08) STILL trips for eval-cli email — T-ro4-04 last-line backstop', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    // Global cap NOT tripped (would bypass anyway), but per-IP cost cap fires.
    isOverCap.mockImplementation(async () => false);
    checkRateLimits.mockImplementationOnce(async () => ({
      ok: false,
      which: 'ipcost' as const,
    }));

    await postChat();

    // Route maps 'ipcost' (gate 5 failure mode) → reason 'ratelimit' (see
    // route.ts line 224). Allowlisted email is STILL ratelimited at the IP
    // cost layer — this is the security-critical last-line backstop.
    expect(persistDeflectionTurn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'ratelimit' }),
    );
    expect(classifyUserMessage).not.toHaveBeenCalled();
  });

  it('SEED-001 spend-cap AC: onFinish passes session.email to incrementSpend AND still calls incrementIpCost (D-A-01 wiring; SAFE-08 preserved)', async () => {
    currentSessionEmail = 'eval-cli@joedollinger.dev';
    isOverCap.mockImplementation(async () => false);
    checkRateLimits.mockImplementation(async () => ({ ok: true }) as const);

    await postChat();
    // Trigger the captured onFinish callback manually since the streamText
    // mock does not invoke it naturally. The shape mirrors the AI SDK v6
    // onFinish event the route consumes (event.usage, event.text, etc.).
    expect(capturedOnFinish).toBeDefined();
    await capturedOnFinish?.({
      usage: { input_tokens: 100, output_tokens: 50 },
      text: 'response',
      finishReason: 'stop',
      steps: [],
      response: { id: 'msg_x' },
    });

    // D-A-01: incrementSpend was called with session.email threaded through
    // as opts.email. The SKIP itself lives inside incrementSpend (unit-
    // tested in tests/lib/redis.test.ts Test I) — this test verifies the
    // WIRING from route.ts is correct.
    expect(incrementSpend).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ email: 'eval-cli@joedollinger.dev' }),
    );
    // T-ro4-07: incrementIpCost was STILL called — SAFE-08 per-IP cost cap
    // is the load-bearing last-line backstop. If a future executor gates
    // this call by email, this assertion fails noisily.
    expect(incrementIpCost).toHaveBeenCalled();
  });
});
