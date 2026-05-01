// tests/lib/logger.test.ts
// Plan 03-00 Task 2: Pino swap. Asserts the structured-log shape is preserved
// (string-name level, ISO ts, no pid/hostname) so route.ts call sites remain
// drop-in compatible. Pino writes directly to process.stdout.write — spy there.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { log, childLogger } from '../../src/lib/logger';

describe('logger (Pino swap)', () => {
  let writes: string[] = [];

  beforeEach(() => {
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: Parameters<typeof process.stdout.write>[0]) => {
      writes.push(typeof chunk === 'string' ? chunk : (chunk as Buffer).toString());
      return true;
    });
  });

  it('emits JSON with string-name level (info)', () => {
    log({ event: 'chat', tokens: 100 });
    const last = writes[writes.length - 1];
    const parsed = JSON.parse(last.trim());
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('chat');
    expect(parsed.tokens).toBe(100);
  });

  it('omits pid and hostname (base: undefined)', () => {
    log({ event: 'noise-suppression-check' });
    const last = writes[writes.length - 1];
    const parsed = JSON.parse(last.trim());
    expect(parsed).not.toHaveProperty('pid');
    expect(parsed).not.toHaveProperty('hostname');
  });

  it('respects level argument (warn)', () => {
    log({ event: 'oops' }, 'warn');
    const last = writes[writes.length - 1];
    const parsed = JSON.parse(last.trim());
    expect(parsed.level).toBe('warn');
  });

  it('respects level argument (error)', () => {
    log({ event: 'broken' }, 'error');
    const last = writes[writes.length - 1];
    const parsed = JSON.parse(last.trim());
    expect(parsed.level).toBe('error');
  });

  it('respects level argument (debug)', () => {
    log({ event: 'trace' }, 'debug');
    const last = writes[writes.length - 1];
    const parsed = JSON.parse(last.trim());
    // In dev, debug emits; in production it would be filtered. Tests run with
    // NODE_ENV !== 'production' (vitest default), so debug should appear.
    expect(parsed.level).toBe('debug');
  });

  it('output is JSON-parseable (no trailing junk, no fences)', () => {
    log({ event: 'parse-check', n: 1 });
    const last = writes[writes.length - 1];
    expect(() => JSON.parse(last.trim())).not.toThrow();
  });

  it('includes ISO-8601 time field', () => {
    log({ event: 'ts-check' });
    const last = writes[writes.length - 1];
    const parsed = JSON.parse(last.trim());
    // pino.stdTimeFunctions.isoTime emits a `time` field with a string ISO date.
    expect(typeof parsed.time).toBe('string');
    expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('childLogger merges bindings into every line', () => {
    const c = childLogger({ session_id: 'sess_1' });
    c.info({ event: 'tool_call' });
    const last = writes[writes.length - 1];
    const parsed = JSON.parse(last.trim());
    expect(parsed.session_id).toBe('sess_1');
    expect(parsed.event).toBe('tool_call');
    expect(parsed.level).toBe('info');
  });
});
