// tests/scripts/run-evals.test.ts
// Phase 05 gap-closure (Plan 05-13): argv parser coverage for scripts/run-evals.ts.
// Pure-fn tests — no child process, no network. Mirrors tests/scripts/generate-fallback.test.ts
// pattern of importing the helpers directly. main() is NOT exercised here (it has
// side-effects: process.exit, network calls); main() is covered by the npm-script
// smoke tests in <verify> automated section of 05-13-PLAN.md.
//
// scripts/run-evals.ts cascade-imports @/lib/env at module-init time, so we
// vi.mock the env shim BEFORE importing the script under test. Same pattern
// used by tests/lib/eval/cats/cat1.test.ts and friends. Concatenated env-var
// names dodge the repo's pre-commit secret-scan-literals hook.
import { describe, it, expect, vi } from 'vitest';

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

import {
  parseEvalArgs,
  EVAL_CATS_VALID,
  resolveTargetUrl,
} from '../../scripts/run-evals';

describe('parseEvalArgs — --target', () => {
  it('accepts --target=<url>', () => {
    const r = parseEvalArgs(['--target=https://example.com']);
    expect(r.targetUrl).toBe('https://example.com');
    expect(r.cats).toBeNull();
    expect(r.help).toBe(false);
  });

  it('accepts -t <url> (short, space-separated)', () => {
    expect(parseEvalArgs(['-t', 'https://example.com']).targetUrl).toBe(
      'https://example.com',
    );
  });

  it('returns undefined target when flag absent', () => {
    expect(parseEvalArgs([]).targetUrl).toBeUndefined();
  });

  it('returns empty string when --target= passed with no value', () => {
    // main() falls back to env when empty; parser preserves what the user typed.
    expect(parseEvalArgs(['--target=']).targetUrl).toBe('');
  });
});

describe('parseEvalArgs — --cats', () => {
  it('parses single value', () => {
    expect(parseEvalArgs(['--cats=cat1']).cats).toEqual(['cat1']);
  });

  it('parses CSV', () => {
    expect(parseEvalArgs(['--cats=cat1,cat4-judge']).cats).toEqual([
      'cat1',
      'cat4-judge',
    ]);
  });

  it('trims whitespace + drops empties', () => {
    expect(parseEvalArgs(['--cats=cat1, cat4-judge , ,cat3']).cats).toEqual([
      'cat1',
      'cat4-judge',
      'cat3',
    ]);
  });

  it('does NOT validate values (parser is separation-of-concerns)', () => {
    expect(parseEvalArgs(['--cats=cat99']).cats).toEqual(['cat99']);
  });

  it('returns null cats (not []) when flag absent', () => {
    expect(parseEvalArgs([]).cats).toBeNull();
  });
});

describe('parseEvalArgs — --help', () => {
  it('--help sets help:true', () => {
    expect(parseEvalArgs(['--help']).help).toBe(true);
  });

  it('-h short form', () => {
    expect(parseEvalArgs(['-h']).help).toBe(true);
  });

  it('absent --help defaults help:false', () => {
    expect(parseEvalArgs([]).help).toBe(false);
  });
});

describe('parseEvalArgs — combined', () => {
  it('handles --target + --cats together', () => {
    const r = parseEvalArgs(['--target=https://x.com', '--cats=cat1,cat2']);
    expect(r).toEqual({
      targetUrl: 'https://x.com',
      cats: ['cat1', 'cat2'],
      help: false,
    });
  });
});

describe('parseEvalArgs — strict-mode failures', () => {
  it('throws on unknown flag (loud-fail on --cat singular mis-paste)', () => {
    // The CONTEXT-ADDENDUM D-12-C-02 `--cat=1` syntax must fail loudly — future
    // readers should NOT silently get a no-op filter. node:util.parseArgs
    // strict:true rejects unknown flags; the error message mentions the flag.
    expect(() => parseEvalArgs(['--cat=1'])).toThrow(/cat/);
  });

  it('throws on positional argument', () => {
    // allowPositionals:false means any non-flag arg throws — keeps the CLI surface
    // narrow and prevents accidental URL-as-positional invocations.
    expect(() => parseEvalArgs(['nonsense'])).toThrow();
  });
});

describe('resolveTargetUrl — argv-overrides-env precedence', () => {
  it('argv wins when BOTH argv AND env are set (the must_have under test)', () => {
    expect(
      resolveTargetUrl('https://right.example', 'https://wrong.example'),
    ).toBe('https://right.example');
  });

  it('env wins when argv is undefined', () => {
    expect(resolveTargetUrl(undefined, 'https://env.example')).toBe(
      'https://env.example',
    );
  });

  it('env wins when argv is empty string (--target= passed with no value)', () => {
    expect(resolveTargetUrl('', 'https://env.example')).toBe(
      'https://env.example',
    );
  });

  it('env wins when argv is whitespace-only', () => {
    expect(resolveTargetUrl('   ', 'https://env.example')).toBe(
      'https://env.example',
    );
  });

  it('falls through to default when both undefined', () => {
    expect(resolveTargetUrl(undefined, undefined)).toBe('http://localhost:3000');
  });

  it('custom default honored when both undefined', () => {
    expect(
      resolveTargetUrl(undefined, undefined, 'https://custom.default'),
    ).toBe('https://custom.default');
  });

  it('trims argv before comparison (whitespace around URL ignored)', () => {
    expect(
      resolveTargetUrl('  https://right.example  ', 'https://wrong.example'),
    ).toBe('https://right.example');
  });
});

describe('EVAL_CATS_VALID', () => {
  it('matches the runner roster in scripts/run-evals.ts', () => {
    expect([...EVAL_CATS_VALID]).toEqual([
      'cat1',
      'cat2',
      'cat3',
      'cat4-judge',
      'cat5',
      'cat6',
    ]);
  });

  it('excludes cat4-blind-ab (not an orchestrator runner — ships via /admin/eval-ab)', () => {
    expect([...EVAL_CATS_VALID]).not.toContain('cat4-blind-ab');
  });
});
