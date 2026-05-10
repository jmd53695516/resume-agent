// tests/lib/eval/agent-client.test.ts
// Phase 5 Plan 05-03 Task 4 — TDD coverage for the shared /api/chat helper.
// Plan-spec path was src/lib/__tests__/eval/agent-client.test.ts; vitest config
// only includes tests/**/*.test.{ts,tsx}, so tests live here per the established
// session deviation (see types/cost/yaml-loader/judge/storage tests).
//
// Quick task 260509-q00 added mintEvalSession + 5 tests for the eval-CLI
// session-mint helper (success / non-200 / missing-id / network-error /
// request-shape).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock @/lib/logger — mintEvalSession calls childLogger().info on success.
// Pattern mirrors Plan 03-00 vi.mock factory; only .info is invoked but we
// stub the full Level interface for safety.
vi.mock('@/lib/logger', () => ({
  childLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { parseChatStream, callAgent, mintEvalSession } from '@/lib/eval/agent-client';

describe('parseChatStream — synthetic fixtures', () => {
  // Phase 05.1 Item #7: parseChatStream returns ParsedStream { text, deflection }
  // (was: string). Tests assert on `.text` for the assistant text channel and
  // `.deflection` for the optional sideband signal. See agent-client.ts JSDoc
  // and 05.1-CONTEXT.md D-E-02.
  it('returns concatenated text from a single text-delta event', () => {
    const body =
      'data: {"type":"text-start","id":"a"}\n\n' +
      'data: {"type":"text-delta","id":"a","delta":"hello"}\n\n' +
      'data: {"type":"text-end","id":"a"}\n\n' +
      'data: [DONE]\n';
    const parsed = parseChatStream(body);
    expect(parsed.text).toBe('hello');
    expect(parsed.deflection).toBeNull();
  });

  it('concatenates multiple text-delta events in order', () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"foo"}\n\n' +
      'data: {"type":"text-delta","id":"a","delta":" bar"}\n\n';
    expect(parseChatStream(body).text).toBe('foo bar');
  });

  it('ignores tool-call / text-start / text-end / [DONE] events', () => {
    const body =
      'data: {"type":"text-start","id":"a"}\n\n' +
      'data: {"type":"text-delta","id":"a","delta":"hi"}\n\n' +
      'data: {"type":"tool-call","id":"t1","toolName":"research_company"}\n\n' +
      'data: {"type":"tool-result","id":"t1","output":{"x":1}}\n\n' +
      'data: {"type":"text-end","id":"a"}\n\n' +
      'data: [DONE]\n';
    expect(parseChatStream(body).text).toBe('hi');
  });

  it('returns empty string on empty body without throwing', () => {
    const parsed = parseChatStream('');
    expect(parsed.text).toBe('');
    expect(parsed.deflection).toBeNull();
  });

  it('silently skips malformed JSON lines and returns the rest', () => {
    const body =
      'data: {bad json here\n\n' +
      'data: {"type":"text-delta","id":"a","delta":"good"}\n\n' +
      'data: not-json-at-all\n\n';
    expect(parseChatStream(body).text).toBe('good');
  });

  it('handles preserved whitespace and embedded JSON-escaped quotes in deltas', () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"He said \\"yes\\"."}\n\n';
    expect(parseChatStream(body).text).toBe('He said "yes".');
  });

  it('handles \\r\\n line endings (Windows / Vercel)', () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"win"}\r\n\r\n' +
      'data: [DONE]\r\n';
    expect(parseChatStream(body).text).toBe('win');
  });

  // Phase 05.1 Item #7: data-deflection sideband chunk is parsed and surfaced
  // as { reason } on the deflection field. The text-delta path is unaffected.
  it('surfaces a data-deflection chunk as deflection: { reason }', () => {
    const body =
      'data: {"type":"data-deflection","data":{"reason":"ratelimit"},"transient":true}\n\n' +
      'data: {"type":"text-start","id":"a"}\n\n' +
      'data: {"type":"text-delta","id":"a","delta":"You\'ve been at this a bit"}\n\n' +
      'data: {"type":"text-end","id":"a"}\n\n' +
      'data: [DONE]\n';
    const parsed = parseChatStream(body);
    expect(parsed.deflection).toEqual({ reason: 'ratelimit' });
    expect(parsed.text).toBe("You've been at this a bit");
  });

  it('keeps deflection null when no data-deflection chunk is present', () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"normal"}\n\n' +
      'data: [DONE]\n';
    expect(parseChatStream(body).deflection).toBeNull();
  });
});

describe('parseChatStream — real captured fixture', () => {
  it('extracts the deflection text from .eval-tmp/sample-stream.txt', () => {
    const path = resolve(process.cwd(), '.eval-tmp', 'sample-stream.txt');
    const body = readFileSync(path, 'utf8');
    const parsed = parseChatStream(body);
    // Deflection text from src/app/api/chat/route.ts DEFLECTIONS.borderline
    // (classifier flagged "hi" as borderline; the exact assertion is the
    // recognizable opener of the deflection so we don't pin to whitespace).
    expect(parsed.text.length).toBeGreaterThan(20);
    expect(parsed.text).toMatch(/Not sure|caught|background|tools/);
  });
});

describe('callAgent — mocked fetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns response + httpStatus + rawBody on 200', async () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"OK"}\n\n' +
      'data: [DONE]\n';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(body, { status: 200, statusText: 'OK' }),
    );
    const result = await callAgent({
      targetUrl: 'http://localhost:3000',
      prompt: 'hi',
      sessionId: 'sess_test_001',
    });
    expect(result.httpStatus).toBe(200);
    expect(result.response).toBe('OK');
    expect(result.rawBody).toContain('text-delta');
  });

  it('throws with status + statusText on non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"Service unavailable"}', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );
    await expect(
      callAgent({
        targetUrl: 'http://localhost:3000',
        prompt: 'hi',
        sessionId: 'sess_test_503',
      }),
    ).rejects.toThrow(/callAgent failed: 503/);
  });

  it('throws with original error.message on fetch network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed: ENOTFOUND nope.invalid'),
    );
    await expect(
      callAgent({
        targetUrl: 'http://nope.invalid',
        prompt: 'hi',
        sessionId: 'sess_test_dns',
      }),
    ).rejects.toThrow(/callAgent network error.*ENOTFOUND/);
  });
});

describe('mintEvalSession — mocked fetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the id from /api/session on a 200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc123xyz789def456' }), {
        status: 200,
        statusText: 'OK',
      }),
    );
    const id = await mintEvalSession('http://localhost:3000');
    expect(id).toBe('abc123xyz789def456');
  });

  it('throws with status code on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"Invalid email."}', {
        status: 400,
        statusText: 'Bad Request',
      }),
    );
    await expect(mintEvalSession('http://localhost:3000')).rejects.toThrow(
      /mintEvalSession failed: 400/,
    );
  });

  it('throws when response is 200 but missing the id field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"foo":"bar"}', { status: 200, statusText: 'OK' }),
    );
    await expect(mintEvalSession('http://localhost:3000')).rejects.toThrow(
      /mintEvalSession.*missing.*id/i,
    );
  });

  it('throws with original error.message on fetch network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:3000'),
    );
    await expect(mintEvalSession('http://localhost:3000')).rejects.toThrow(
      /mintEvalSession network error.*ECONNREFUSED/,
    );
  });

  it('POSTs JSON to ${targetUrl}/api/session with synthetic email and no turnstile_token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'sess_xyz' }), {
        status: 200,
        statusText: 'OK',
      }),
    );
    await mintEvalSession('http://localhost:3000');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/session');
    expect(init?.method).toBe('POST');
    // headers may be a plain object or a Headers instance; normalize for assertion
    const headers = init?.headers as Record<string, string> | undefined;
    const ct =
      headers?.['content-type'] ??
      headers?.['Content-Type'] ??
      (init?.headers instanceof Headers ? init.headers.get('content-type') : undefined);
    expect(ct).toMatch(/application\/json/);
    const body = init?.body as string;
    expect(body).toContain('"email":"eval-cli@joedollinger.dev"');
    expect(body).not.toContain('turnstile_token');
  });
});
