// tests/lib/eval/agent-client.test.ts
// Phase 5 Plan 05-03 Task 4 — TDD coverage for the shared /api/chat helper.
// Plan-spec path was src/lib/__tests__/eval/agent-client.test.ts; vitest config
// only includes tests/**/*.test.{ts,tsx}, so tests live here per the established
// session deviation (see types/cost/yaml-loader/judge/storage tests).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseChatStream, callAgent } from '@/lib/eval/agent-client';

describe('parseChatStream — synthetic fixtures', () => {
  it('returns concatenated text from a single text-delta event', () => {
    const body =
      'data: {"type":"text-start","id":"a"}\n\n' +
      'data: {"type":"text-delta","id":"a","delta":"hello"}\n\n' +
      'data: {"type":"text-end","id":"a"}\n\n' +
      'data: [DONE]\n';
    expect(parseChatStream(body)).toBe('hello');
  });

  it('concatenates multiple text-delta events in order', () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"foo"}\n\n' +
      'data: {"type":"text-delta","id":"a","delta":" bar"}\n\n';
    expect(parseChatStream(body)).toBe('foo bar');
  });

  it('ignores tool-call / text-start / text-end / [DONE] events', () => {
    const body =
      'data: {"type":"text-start","id":"a"}\n\n' +
      'data: {"type":"text-delta","id":"a","delta":"hi"}\n\n' +
      'data: {"type":"tool-call","id":"t1","toolName":"research_company"}\n\n' +
      'data: {"type":"tool-result","id":"t1","output":{"x":1}}\n\n' +
      'data: {"type":"text-end","id":"a"}\n\n' +
      'data: [DONE]\n';
    expect(parseChatStream(body)).toBe('hi');
  });

  it('returns empty string on empty body without throwing', () => {
    expect(parseChatStream('')).toBe('');
  });

  it('silently skips malformed JSON lines and returns the rest', () => {
    const body =
      'data: {bad json here\n\n' +
      'data: {"type":"text-delta","id":"a","delta":"good"}\n\n' +
      'data: not-json-at-all\n\n';
    expect(parseChatStream(body)).toBe('good');
  });

  it('handles preserved whitespace and embedded JSON-escaped quotes in deltas', () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"He said \\"yes\\"."}\n\n';
    expect(parseChatStream(body)).toBe('He said "yes".');
  });

  it('handles \\r\\n line endings (Windows / Vercel)', () => {
    const body =
      'data: {"type":"text-delta","id":"a","delta":"win"}\r\n\r\n' +
      'data: [DONE]\r\n';
    expect(parseChatStream(body)).toBe('win');
  });
});

describe('parseChatStream — real captured fixture', () => {
  it('extracts the deflection text from .eval-tmp/sample-stream.txt', () => {
    const path = resolve(process.cwd(), '.eval-tmp', 'sample-stream.txt');
    const body = readFileSync(path, 'utf8');
    const text = parseChatStream(body);
    // Deflection text from src/app/api/chat/route.ts DEFLECTIONS.borderline
    // (classifier flagged "hi" as borderline; the exact assertion is the
    // recognizable opener of the deflection so we don't pin to whitespace).
    expect(text.length).toBeGreaterThan(20);
    expect(text).toMatch(/Not sure|caught|background|tools/);
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
