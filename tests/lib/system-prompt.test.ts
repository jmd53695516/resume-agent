// tests/lib/system-prompt.test.ts
// CHAT-04 + SAFE-11 determinism guarantee. This test is the product's
// primary defense against Pitfall 2 (runaway cost from silent cache regression).
// Source: RESEARCH.md Code Examples + CONTEXT.md D-E-04.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSystemPrompt } from '../../src/lib/system-prompt';
import { __resetKBCacheForTests } from '../../src/lib/kb-loader';

describe('buildSystemPrompt determinism', () => {
  beforeEach(() => {
    __resetKBCacheForTests();
  });

  it('is byte-identical across invocations (strict equality)', () => {
    const a = buildSystemPrompt();
    const b = buildSystemPrompt();
    expect(a).toBe(b); // reference equality — same memoized KB + pure concatenation
    __resetKBCacheForTests();
    const c = buildSystemPrompt();
    expect(a).toEqual(c); // value equality after cache reset
  });

  it('contains all required KB section markers', () => {
    const p = buildSystemPrompt();
    expect(p).toMatch(/<!-- kb: resume -->/);
    expect(p).toMatch(/<!-- kb: guardrails -->/);
    expect(p).toMatch(/<!-- kb: voice -->/);
    expect(p).toMatch(/VOICE RULES/);
    expect(p).toMatch(/HALLUCINATION RULES/);
  });

  it('falls within sanity length bounds', () => {
    const p = buildSystemPrompt();
    expect(p.length).toBeGreaterThan(500);
    expect(p.length).toBeLessThan(200_000);
  });

  it('contains no dynamic content patterns (SAFE-11 guard)', () => {
    const p = buildSystemPrompt();
    // No ISO timestamps: 2026-04-21T14:02:00Z
    expect(p).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // No UUIDs: 550e8400-e29b-41d4-a716-446655440000
    expect(p).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    // No session-id-shaped tokens: session_id: V1StGXR8_Z5jdHi6B-myT
    expect(p).not.toMatch(/session[_-]?id[:\s=]+[A-Za-z0-9_-]{10,25}/i);
  });

  it('source file retains the Phase 2 cache-breakpoint comment (CHAT-05)', () => {
    // Open-question #4 resolution: keep the // PHASE 2: marker as a
    // future-readability anchor for Phase 2's first refactor commit.
    const src = readFileSync(path.join(process.cwd(), 'src/lib/system-prompt.ts'), 'utf-8');
    expect(src).toMatch(/\/\/ PHASE 2:/);
  });
});
