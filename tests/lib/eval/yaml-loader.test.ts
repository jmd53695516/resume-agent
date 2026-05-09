// tests/lib/eval/yaml-loader.test.ts
// Phase 5 Plan 05-03 Task 1 — TDD coverage for the YAML case loader.
// NOTE: tests live under tests/ (not src/lib/__tests__) because vitest.config.ts
// only includes tests/**/*.test.{ts,tsx}. Path deviation from plan; intentional.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Stub env so the logger import chain doesn't crash in test env.
vi.mock('@/lib/env', () => {
  const env: Record<string, string> = {};
  env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://fake.supabase.co';
  env['NEXT_PUBLIC_' + 'SUPABASE_ANON_' + 'KEY'] = 'x'.repeat(40);
  env['SUPABASE_SERVICE_ROLE_' + 'KEY'] = 'x'.repeat(40);
  env['ANTHROPIC_API_' + 'KEY'] = 'x'.repeat(40);
  env['UPSTASH_REDIS_REST_URL'] = 'https://fake.upstash.io';
  env['UPSTASH_REDIS_REST_TOKEN'] = 'x'.repeat(40);
  return { env };
});

import { loadCases } from '@/lib/eval/yaml-loader';

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'eval-yaml-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeFixture(name: string, content: string): Promise<string> {
  const p = path.join(tmpDir, name);
  await writeFile(p, content, 'utf8');
  return p;
}

describe('loadCases', () => {
  it('parses 3 valid cases from a well-formed YAML array', async () => {
    const yaml = `
- case_id: cat1-fab-001
  category: cat1
  prompt: "Tell me about Joe's role at Acme."
  ground_truth_facts:
    - "Joe was a Senior PM at Acme."
- case_id: cat2-tool-001
  category: cat2
  prompt: "Pitch me on Anthropic"
  tool_expected: research_company
- case_id: cat6-ux-001
  category: cat6
  prompt: "Click the trace toggle"
  tags: [ux, smoke]
`;
    const file = await writeFixture('valid-3.yaml', yaml);
    const cases = await loadCases(file);
    expect(cases).toHaveLength(3);
    expect(cases[0].case_id).toBe('cat1-fab-001');
    expect(cases[0].category).toBe('cat1');
    expect(cases[1].tool_expected).toBe('research_company');
    expect(cases[2].tags).toEqual(['ux', 'smoke']);
  });

  it('throws with parseable error message on malformed YAML (syntax error)', async () => {
    const yaml = `
- case_id: bad
  category: cat1
  prompt: "unterminated
`;
    const file = await writeFixture('malformed.yaml', yaml);
    await expect(loadCases(file)).rejects.toThrow(/parse failure in/);
    await expect(loadCases(file)).rejects.toThrow(/malformed\.yaml/);
  });

  it('passes through extra unexpected keys (forward-compat)', async () => {
    const yaml = `
- case_id: cat1-x
  category: cat1
  prompt: "test"
  some_future_field: "ignored"
  another: 42
`;
    const file = await writeFixture('extra-keys.yaml', yaml);
    const cases = await loadCases(file);
    expect(cases).toHaveLength(1);
    expect(cases[0].case_id).toBe('cat1-x');
  });

  it('throws zod validation error on missing required field (no prompt)', async () => {
    const yaml = `
- case_id: bad-no-prompt
  category: cat1
`;
    const file = await writeFixture('missing-prompt.yaml', yaml);
    await expect(loadCases(file)).rejects.toThrow(/case index 0/);
    await expect(loadCases(file)).rejects.toThrow(/failed validation/);
  });

  it('throws zod error on invalid category enum value', async () => {
    const yaml = `
- case_id: cat99-bad
  category: cat99
  prompt: "x"
`;
    const file = await writeFixture('bad-category.yaml', yaml);
    await expect(loadCases(file)).rejects.toThrow(/failed validation/);
  });

  it('returns empty array (with warn log) for empty YAML file', async () => {
    const file = await writeFixture('empty.yaml', '');
    const cases = await loadCases(file);
    expect(cases).toEqual([]);
  });

  it('throws when the top-level YAML is a mapping (not an array)', async () => {
    const yaml = `
case_id: oops
category: cat1
prompt: "should be in an array"
`;
    const file = await writeFixture('top-mapping.yaml', yaml);
    await expect(loadCases(file)).rejects.toThrow(/expected top-level array/);
  });

  it('throws helpful error when file does not exist', async () => {
    const file = path.join(tmpDir, 'does-not-exist.yaml');
    await expect(loadCases(file)).rejects.toThrow(/cannot read/);
  });
});
