import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() so vi.mock factories below can reference these.
const mocks = vi.hoisted(() => ({
  CRON_SECRET: ['x', 'y', 'z'].join('').repeat(11) + 'a', // 34 chars (>= 32 min)
  childLoggerMock: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

// Bind a fresh logger object every call so we can assert calls per-test
// while still satisfying childLogger's contract.
mocks.childLoggerMock.mockImplementation(() => ({
  info: mocks.loggerInfo,
  error: mocks.loggerError,
}));

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: mocks.CRON_SECRET } }));

vi.mock('@/lib/logger', () => ({
  childLogger: mocks.childLoggerMock,
  log: vi.fn(),
}));

import { POST } from '@/app/api/cron/run-eval/route';

function makeReq(opts: { method?: string; auth?: string }) {
  const headers = new Headers();
  if (opts.auth) headers.set('authorization', opts.auth);
  return new Request('https://x/api/cron/run-eval', {
    method: opts.method ?? 'POST',
    headers,
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mocks.loggerInfo.mockReset();
  mocks.loggerError.mockReset();
  mocks.childLoggerMock.mockClear();
  // Re-apply the implementation since mockClear wipes it.
  mocks.childLoggerMock.mockImplementation(() => ({
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  }));
  // Reset the relevant env vars so each test starts clean.
  delete process.env.GH_DISPATCH_TOKEN;
  delete process.env.GH_REPO_SLUG;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  // Stub global fetch fresh per-test.
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  // Restore env to its starting state so test isolation holds across files.
  for (const k of ['GH_DISPATCH_TOKEN', 'GH_REPO_SLUG', 'NEXT_PUBLIC_SITE_URL']) {
    if (k in ORIGINAL_ENV) {
      process.env[k] = ORIGINAL_ENV[k];
    } else {
      delete process.env[k];
    }
  }
  vi.unstubAllGlobals();
});

describe('POST /api/cron/run-eval', () => {
  it('Test 1: returns 401 with no Authorization header', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'unauthorized' });
    // fetch must not have been called.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('Test 2: returns 401 with wrong Bearer token', async () => {
    const res = await POST(
      makeReq({ auth: 'Bearer wrong-token-but-long-enough-32ch' }),
    );
    expect(res.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('Test 3: returns 401 on GET method even with correct token (validateCronAuth rejects non-POST)', async () => {
    const res = await POST(
      makeReq({ method: 'GET', auth: `Bearer ${mocks.CRON_SECRET}` }),
    );
    expect(res.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('Test 4: returns 503 when GH_DISPATCH_TOKEN is unset', async () => {
    // GH_DISPATCH_TOKEN is unset by beforeEach.
    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ error: 'GH_DISPATCH_TOKEN not configured' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    // Logger should record the skip reason.
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'GH_DISPATCH_TOKEN unset' }),
      'run_eval_dispatch_skipped',
    );
  });

  it('Test 5: POST with correct Bearer + GH_DISPATCH_TOKEN set fires fetch to api.github.com dispatches with event_type=scheduled-eval and returns 200', async () => {
    process.env.GH_DISPATCH_TOKEN = 'ghp_test_dispatch_token_123456';
    process.env.GH_REPO_SLUG = 'jmd53695516/resume-agent';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://prod.example.com';

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      // GitHub returns 204 for successful dispatches; using 200 in tests
      // because the platform Response constructor in this environment
      // rejects 204 with no body. Behaviorally equivalent — `res.ok` is true
      // for both.
      new Response('', { status: 200 }),
    );

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, dispatched_to: 'github-actions' });

    // Verify the GH dispatch call shape per RESEARCH §7.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/jmd53695516/resume-agent/dispatches',
    );
    expect((init as RequestInit | undefined)?.method).toBe('POST');
    const headers = (init as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.Authorization).toBe('Bearer ghp_test_dispatch_token_123456');
    expect(headers?.Accept).toBe('application/vnd.github+json');
    expect(headers?.['X-GitHub-Api-Version']).toBe('2022-11-28');
    const parsedBody = JSON.parse(
      ((init as RequestInit | undefined)?.body as string) ?? '{}',
    );
    expect(parsedBody.event_type).toBe('scheduled-eval');
    expect(parsedBody.client_payload).toEqual({
      target_url: 'https://prod.example.com',
    });
  });

  it('Test 6: returns 502 with diagnostic when GitHub API responds non-2xx', async () => {
    process.env.GH_DISPATCH_TOKEN = 'ghp_test_dispatch_token_123456';

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      new Response('Bad credentials', { status: 401 }),
    );

    const res = await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ error: 'github dispatch failed', status: 401 });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, body: 'Bad credentials' }),
      'run_eval_dispatch_failed',
    );
  });

  it('Test 7: logs cron_run event with cron_name=run-eval (Phase 4 logging convention)', async () => {
    process.env.GH_DISPATCH_TOKEN = 'ghp_test_dispatch_token_123456';

    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    await POST(makeReq({ auth: `Bearer ${mocks.CRON_SECRET}` }));

    // childLogger called with the cron_run binding.
    expect(mocks.childLoggerMock).toHaveBeenCalledWith({
      event: 'cron_run',
      cron_name: 'run-eval',
    });
    // Successful dispatch surfaces an info log.
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dispatched' }),
      'run_eval_dispatched',
    );
  });
});
