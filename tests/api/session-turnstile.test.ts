// tests/api/session-turnstile.test.ts
// SAFE-13 — Verify the conditional Turnstile preflight in POST /api/session.
//
// We test the route handler directly by importing POST and calling it with a
// constructed Request. fetch() to Cloudflare's siteverify endpoint is stubbed
// via globalThis.fetch override. The Supabase client is mocked at the module
// level so the success-path test never hits a real database — the test
// suite is hermetic and runs without any environment configuration.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock supabase-server so route handlers can import it without env validation
// blowing up and without needing real DB creds. The mock returns { error: null }
// for every insert, so the post-Turnstile success path lands at the 200 branch.
vi.mock('@/lib/supabase-server', () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return {
    supabaseAdmin: {
      from: vi.fn(() => ({ insert })),
    },
  };
});

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function mockFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

async function postBody(body: unknown): Promise<Response> {
  // Re-import per-test so any module-scope env reads are re-evaluated. The
  // route handler reads process.env at call time, so this is belt-and-
  // suspenders, but cheap.
  const { POST } = await import('@/app/api/session/route');
  // The route signature uses NextRequest, but at runtime a plain Request
  // works for our purposes since we only call body.json() and headers.get().
  return POST(
    new Request('http://localhost/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
  );
}

describe('POST /api/session — Turnstile verification (SAFE-13)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Suppress expected console.error noise from misconfig + network paths.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('skips verification when NEXT_PUBLIC_TURNSTILE_ENABLED is absent (no widget, no preflight)', async () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_ENABLED;
    // Mock fetch to throw if called — proves siteverify is NOT invoked.
    const restore = mockFetch(async (input) => {
      if (String(input).includes('siteverify')) {
        throw new Error('siteverify called when flag is off — should NOT happen');
      }
      return new Response('{}', { status: 200 });
    });
    try {
      const res = await postBody({ email: 'no-turnstile@example.com' });
      // Supabase mock returns success → expect 200 with id.
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.error).toBeUndefined();
      expect(typeof json.id).toBe('string');
      expect(json.id.length).toBeGreaterThan(0);
    } finally {
      restore();
    }
  });

  it('returns 500 turnstile_misconfigured when flag on but TURNSTILE_SECRET_KEY missing', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = 'true';
    delete process.env.TURNSTILE_SECRET_KEY;
    const res = await postBody({
      email: 'misconfig@example.com',
      turnstile_token: 'whatever',
    });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('turnstile_misconfigured');
  });

  it('returns 400 turnstile_missing when flag on and token absent', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = 'true';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const res = await postBody({ email: 'no-token@example.com' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('turnstile_missing');
  });

  it('returns 400 turnstile_failed when Cloudflare reports invalid token', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = 'true';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const restore = mockFetch(async (input) => {
      expect(String(input)).toBe(SITEVERIFY_URL);
      return new Response(
        JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    try {
      const res = await postBody({
        email: 'bad-token@example.com',
        turnstile_token: 'bad-token',
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('turnstile_failed');
      expect(json.errorCodes).toContain('invalid-input-response');
    } finally {
      restore();
    }
  });

  it('proceeds to session create (200 + id) when Cloudflare reports success', async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_ENABLED = 'true';
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const restore = mockFetch(async (input) => {
      expect(String(input)).toBe(SITEVERIFY_URL);
      return new Response(JSON.stringify({ success: true, hostname: 'test.local' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    try {
      const res = await postBody({
        email: `ok-${Date.now()}@example.com`,
        turnstile_token: 'good-token',
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.error).toBeUndefined();
      expect(typeof json.id).toBe('string');
    } finally {
      restore();
    }
  });
});
